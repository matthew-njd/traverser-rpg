import { DatabaseSync } from 'node:sqlite';

import { CONTENT_TABLES, CONTENT_TABLE_NAMES } from '../../content/schema';
import { LATEST_VERSION, MIGRATIONS, currentVersion, runMigrations } from '../migrations';
import { FileDatabase, memoryDatabase } from './testDatabase';

describe('schema migrations', () => {
  it('applies from empty and reports the latest version', () => {
    const db = memoryDatabase();

    expect(currentVersion(db)).toBe(LATEST_VERSION);
    expect(LATEST_VERSION).toBeGreaterThan(0);
  });

  it('creates every table the schema needs and nothing else', () => {
    const db = memoryDatabase();

    const tables = db
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name)
      .sort();

    expect(tables).toEqual(
      [
        // The M1 subset of the tech-01 §4 mirror.
        'activity_day',
        'player',
        'player_settings',
        'player_zone_progress',
        'streak_state',
        // tech-04 §6.2's five device-only tables.
        'hr_minute_watermark',
        'hr_session_ledger',
        'outbox',
        'read_watermark',
        'step_watermark',
        // tech-01 §3's content set (T4 §5.1), plus its version row.
        'content_version',
        ...CONTENT_TABLE_NAMES,
      ].sort(),
    );
  });

  /**
   * The DDL and `CONTENT_TABLES` are two spellings of one schema — the spec drives the INSERT
   * column list, so a column here that the DDL lacks fails at write time on a device, with the
   * bundle half-stored. Checked column by column rather than by table name for that reason.
   */
  it('gives every content column in the spec a column in the table', () => {
    const db = memoryDatabase();

    for (const table of CONTENT_TABLE_NAMES) {
      const actual = db
        .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
        .map((row) => row.name)
        .sort();

      expect({ table, columns: actual }).toEqual({
        table,
        columns: Object.keys(CONTENT_TABLES[table].columns).sort(),
      });
    }
  });

  it('is idempotent — a second run applies nothing', () => {
    const db = memoryDatabase();

    expect(runMigrations(db)).toBe(LATEST_VERSION);
    expect(runMigrations(db)).toBe(LATEST_VERSION);
  });

  /**
   * The path every shipped device takes and an all-at-once test never exercises: an older
   * database upgraded in place with its rows intact.
   */
  it('upgrades an older database in place, keeping its rows', () => {
    const db = memoryDatabase();

    // Rewind to a device that is still on version 1 by dropping what came after it.
    db.execSync('DROP TABLE player');
    db.execSync('DROP TABLE content_version');
    for (const table of CONTENT_TABLE_NAMES) {
      db.execSync(`DROP TABLE ${table}`);
    }
    for (const statement of MIGRATIONS[0]?.statements ?? []) {
      if (statement.includes('CREATE TABLE player ')) {
        db.execSync(statement);
      }
    }
    db.execSync('PRAGMA user_version = 1');
    db.runSync(
      `INSERT INTO player (one_row, id, traverser_name, timezone, created_at)
       VALUES (1, 'p1', 'Matthew', 'America/New_York', '2026-08-03T00:00:00Z')`,
    );

    expect(runMigrations(db)).toBe(LATEST_VERSION);

    // The row survived, and the new column arrived with its default rather than as null.
    expect(
      db.getFirstSync<{ id: string; provisional: number }>(
        'SELECT id, provisional FROM player',
      ),
    ).toEqual({ id: 'p1', provisional: 0 });
  });

  it('survives close and reopen without reapplying', () => {
    const file = new FileDatabase();

    try {
      const first = file.open();

      first.runSync(
        `INSERT INTO player (one_row, id, traverser_name, timezone, created_at)
         VALUES (1, 'p1', 'Matthew', 'America/New_York', '2026-08-03T00:00:00Z')`,
      );

      file.kill();

      const reopened = file.open();

      expect(currentVersion(reopened)).toBe(LATEST_VERSION);
      expect(reopened.getFirstSync<{ id: string }>('SELECT id FROM player')?.id).toBe('p1');
    } finally {
      file.cleanup();
    }
  });

  /**
   * The bump is inside the DDL's transaction, so a migration that throws leaves neither behind.
   * Outside it, a database reports itself migrated and is not — and with no down-migrations the
   * only recovery is an uninstall, which destroys the profile (tech-04 §6.5).
   */
  it('rolls the version back with the DDL when a migration throws', () => {
    const raw = new DatabaseSync(':memory:');

    const db = {
      execSync: (sql: string) => {
        // Fail on the bump specifically — the interleaving that would strand a half-migrated db.
        if (sql.includes('user_version =')) {
          throw new Error('simulated crash mid-migration');
        }

        raw.exec(sql);
      },
      runSync: (sql: string) => ({ changes: Number(raw.prepare(sql).run().changes) }),
      getAllSync: <T>(sql: string) => raw.prepare(sql).all() as T[],
      getFirstSync: <T>(sql: string) => (raw.prepare(sql).get() as T | undefined) ?? null,
      closeSync: () => raw.close(),
    };

    expect(() => runMigrations(db)).toThrow('simulated crash mid-migration');

    expect(db.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(0);

    const tables = db
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).not.toContain('player');
    expect(tables).not.toContain('outbox');
  });

  /** Unique and ascending, so "append only" is checkable rather than merely intended. */
  it('declares strictly ascending, unique versions starting at 1', () => {
    const versions = MIGRATIONS.map((m) => m.version);

    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions[0]).toBe(1);
  });

  it('enforces foreign keys', () => {
    const db = memoryDatabase();

    expect(() =>
      db.runSync(
        `INSERT INTO activity_day (player_id, activity_date, step_goal_snapshot)
         VALUES ('nobody', '2026-08-03', 7000)`,
      ),
    ).toThrow();
  });

  /** One device, one player, forever (tech-04 §6.5) — a second row would be a split mirror. */
  it('permits only one player row', () => {
    const db = memoryDatabase();

    const insert = (id: string) =>
      db.runSync(
        `INSERT INTO player (one_row, id, traverser_name, timezone, created_at)
         VALUES (1, ?, 'Matthew', 'UTC', '2026-08-03T00:00:00Z')`,
        [id],
      );

    insert('p1');

    expect(() => insert('p2')).toThrow();
  });
});
