import { openDatabaseSync } from 'expo-sqlite';

import { runMigrations } from './migrations';
import type { SqliteDatabase } from './types';

/**
 * Opens `traverser.db` and migrates it. **This is the only module that imports `expo-sqlite`** —
 * everything else in `src/db` takes a {@link SqliteDatabase}, which is what lets the schema and the
 * queue be tested against a real SQLite off-device (see `types.ts`).
 */
const DATABASE_NAME = 'traverser.db';

let database: SqliteDatabase | null = null;

/**
 * Set at open, outside any transaction: `journal_mode` cannot change inside one and
 * `foreign_keys` is silently a no-op inside one — a pragma that appears to apply and does not.
 *
 * `synchronous = FULL`, not `NORMAL` (tech-04 §6.1). `NORMAL` can lose the last transaction, which
 * here is frequently the delta write that just consumed a health read.
 */
const PRAGMAS = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = FULL;
`;

/**
 * Opens the database once and holds it for the process lifetime (tech-04 §6). Migrations run here,
 * at boot, **before anything reads**.
 */
export function openTraverserDatabase(): SqliteDatabase {
  if (database !== null) {
    return database;
  }

  // Narrowing, not widening: expo's `runSync` is overloaded (variadic *or* array), and TypeScript
  // will not structurally match an overload set against a single signature.
  const db = openDatabaseSync(DATABASE_NAME) as unknown as SqliteDatabase;

  db.execSync(PRAGMAS);
  runMigrations(db);

  database = db;

  return db;
}

/** Throws rather than opening lazily — a caller arriving before boot would read an unmigrated db. */
export function getDatabase(): SqliteDatabase {
  if (database === null) {
    throw new Error('The database is not open yet. Call openTraverserDatabase() during boot.');
  }

  return database;
}

/** Tests and teardown only — production holds one connection for the process lifetime. */
export function closeTraverserDatabase(): void {
  database?.closeSync();
  database = null;
}
