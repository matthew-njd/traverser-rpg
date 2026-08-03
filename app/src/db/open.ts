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
 * ↯ Set at open and outside any transaction. `journal_mode` cannot be changed inside one, and
 * `foreign_keys` is silently a no-op inside one — a pragma that appears to apply and does not is
 * worse than an error, because the app then runs without referential integrity and nothing says so.
 *
 * `synchronous = FULL` rather than the usual `NORMAL` (tech-04 §6.1). The normal argument for
 * `NORMAL` is that a crash can lose the last transaction and that this is fine for a cache. It is
 * not fine here: the last transaction is frequently *the delta queue write that just consumed a
 * health read*, and tech-03 §8.4 orders the watermark advance strictly after that write precisely
 * so nothing is lost. `NORMAL` would put a hole in the middle of that guarantee, for a few
 * milliseconds on writes that happen a handful of times per session.
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

  // The cast is narrowing, not widening: expo's `SQLiteDatabase` has every method the port declares
  // with the same runtime behaviour, but its `runSync` is overloaded (variadic *or* array params)
  // and TypeScript will not structurally match an overload set against a single signature. The
  // array form is the one used everywhere here.
  const db = openDatabaseSync(DATABASE_NAME) as unknown as SqliteDatabase;

  db.execSync(PRAGMAS);
  runMigrations(db);

  database = db;

  return db;
}

/**
 * The open database. Throws rather than opening lazily: a caller reaching this before boot has
 * finished is reading a database whose migrations may not have run, and returning one anyway would
 * turn an ordering bug into a corrupt read.
 */
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
