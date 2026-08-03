import { DatabaseSync } from 'node:sqlite';

import { LATEST_VERSION, MIGRATIONS, currentVersion, runMigrations } from '../migrations';
import { FileDatabase, memoryDatabase } from './testDatabase';

describe('schema migrations', () => {
  it('applies from empty and reports the latest version', () => {
    const db = memoryDatabase();

    expect(currentVersion(db)).toBe(LATEST_VERSION);
    expect(LATEST_VERSION).toBeGreaterThan(0);
  });

  it('creates every table the M1 schema needs', () => {
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
      ].sort(),
    );
  });

  /**
   * M1 plan decision §3.2 defers the content bundle to M2, and M1's client reads no seeded content
   * at all. An empty content table would look like a bundle that failed to arrive.
   */
  it('creates no content tables', () => {
    const db = memoryDatabase();

    const tables = db
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => row.name);

    expect(tables).not.toContain('enemy');
    expect(tables).not.toContain('item_def');
    expect(tables).not.toContain('xp_curve');
  });

  it('is idempotent — a second run applies nothing', () => {
    const db = memoryDatabase();

    expect(runMigrations(db)).toBe(LATEST_VERSION);
    expect(runMigrations(db)).toBe(LATEST_VERSION);
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
   * ↯ The crash-safety guarantee tech-04 §6.3 depends on. The `user_version` bump lives inside the
   * same transaction as the DDL, so a migration that throws part-way leaves *neither* the tables nor
   * the version behind and the next boot re-applies cleanly. Bumping outside the transaction would
   * strand a database that reports itself migrated and is not — and since there are no
   * down-migrations, the only recovery from that is an uninstall, which destroys the profile
   * (tech-04 §6.5).
   */
  it('rolls the version back with the DDL when a migration throws', () => {
    const raw = new DatabaseSync(':memory:');

    const db = {
      execSync: (sql: string) => {
        // Fail on the version bump specifically: the DDL has already run inside the transaction, so
        // this is the exact interleaving that would strand a half-migrated database.
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

  /**
   * Editing a shipped migration is invisible to a device that already applied it, so the two
   * devices diverge with no error anywhere. Versions must be unique and ascending so "append only"
   * is checkable rather than merely intended.
   */
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
