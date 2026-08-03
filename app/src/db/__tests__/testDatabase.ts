import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '../migrations';
import type { SqlParam, SqliteDatabase } from '../types';

/**
 * Binds the {@link SqliteDatabase} port to Node's built-in `node:sqlite`.
 *
 * ↯ Why not `expo-sqlite` directly: it is a native module, so under Jest it resolves to a mock with
 * no SQL engine behind it — every assertion about a migration, a FIFO drain or a watermark would be
 * checking a stub's return value. `node:sqlite` is a real SQLite (Node 24 ships it built in, so this
 * costs no dependency), which means the DDL and the SQL under test are the ones that ship.
 *
 * What this does *not* cover, and must not be claimed: the native binding itself, the pragmas in
 * `open.ts`, and anything about how Android handles the file. Those are proven on the device at P9.
 */
class NodeSqliteAdapter implements SqliteDatabase {
  constructor(private readonly db: DatabaseSync) {}

  execSync(sql: string): void {
    this.db.exec(sql);
  }

  runSync(sql: string, params: SqlParam[] = []): { changes: number } {
    return { changes: Number(this.db.prepare(sql).run(...params).changes) };
  }

  getAllSync<T>(sql: string, params: SqlParam[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  getFirstSync<T>(sql: string, params: SqlParam[] = []): T | null {
    return (this.db.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  closeSync(): void {
    this.db.close();
  }
}

/** Mirrors `open.ts`'s pragmas, minus WAL — an in-memory or short-lived test file gains nothing. */
function applyPragmas(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON');
}

/** A migrated in-memory database. Enough for everything that does not need to survive a reopen. */
export function memoryDatabase(): SqliteDatabase {
  const raw = new DatabaseSync(':memory:');

  applyPragmas(raw);

  const db = new NodeSqliteAdapter(raw);

  runMigrations(db);

  return db;
}

/**
 * A database backed by a real file, so it can be closed and reopened — which is how "survives
 * process death" is actually tested rather than asserted. Android kills a backgrounded app without
 * warning and without a callback (tech-04 §5.3), so this is the ordinary case, not an edge case.
 */
export class FileDatabase {
  private readonly directory = mkdtempSync(join(tmpdir(), 'traverser-test-'));

  private current: { adapter: NodeSqliteAdapter; raw: DatabaseSync } | null = null;

  get path(): string {
    return join(this.directory, 'traverser.db');
  }

  /** Opens (or reopens) and migrates, exactly as boot does. */
  open(): SqliteDatabase {
    const raw = new DatabaseSync(this.path);

    applyPragmas(raw);

    const adapter = new NodeSqliteAdapter(raw);

    runMigrations(adapter);
    this.current = { adapter, raw };

    return adapter;
  }

  /** Closes without ceremony — the closest a test can get to the process simply ending. */
  kill(): void {
    this.current?.raw.close();
    this.current = null;
  }

  cleanup(): void {
    this.kill();
    rmSync(this.directory, { recursive: true, force: true });
  }
}
