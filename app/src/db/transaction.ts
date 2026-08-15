import type { SqliteDatabase } from './types';

/**
 * A **re-entrant** transaction. Use this everywhere; never call `BEGIN` directly.
 *
 * ↯ `expo-sqlite`'s `withTransactionSync` cannot be used: it issues a bare `BEGIN`, and SQLite has
 * no nested transactions, so one transactional function calling another throws. Nesting is required
 * here — `commitReadCycle` wraps an enqueue that is itself atomic (tech-03 §8.4, tech-02 §5).
 *
 * Outermost call opens a real transaction; inner calls open a `SAVEPOINT`. Depth is per database
 * instance, so production and a test file never see each other's nesting.
 */
const depths = new WeakMap<SqliteDatabase, number>();

export function transact(db: SqliteDatabase, task: () => void): void {
  const depth = depths.get(db) ?? 0;

  depths.set(db, depth + 1);

  try {
    if (depth === 0) {
      db.execSync('BEGIN');

      try {
        task();
        db.execSync('COMMIT');
      } catch (error) {
        db.execSync('ROLLBACK');
        throw error;
      }

      return;
    }

    // Names come from the depth, never from a caller: SQLite cannot bind an identifier.
    const savepoint = `traverser_sp_${depth}`;

    db.execSync(`SAVEPOINT ${savepoint}`);

    try {
      task();
      db.execSync(`RELEASE ${savepoint}`);
    } catch (error) {
      // ROLLBACK TO leaves the savepoint on the stack — RELEASE removes it. Skipping it leaks one
      // per failed inner block and eventually deadlocks the outer commit.
      db.execSync(`ROLLBACK TO ${savepoint}`);
      db.execSync(`RELEASE ${savepoint}`);
      throw error;
    }
  } finally {
    depths.set(db, depth);
  }
}
