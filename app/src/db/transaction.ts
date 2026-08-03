import type { SqliteDatabase } from './types';

/**
 * A **re-entrant** transaction. Use this everywhere; never call `BEGIN` directly.
 *
 * ↯ Why this exists rather than `expo-sqlite`'s `withTransactionSync`: that helper issues a bare
 * `BEGIN`, and SQLite has no nested transactions — so the moment one transactional function calls
 * another, it throws `cannot start a transaction within a transaction`. That is not a hypothetical
 * arrangement here, it is the required one: tech-03 §8.4 makes `commitReadCycle` wrap the delta
 * enqueue *and* the watermark advance in a single unit of work, and the enqueue is itself atomic
 * because tech-02 §5 says a batch must not land half-written.
 *
 * Found by the P5 test suite — the un-nested version would have thrown on every health read cycle
 * on the device, which is to say on the app's main loop.
 *
 * The outermost call opens a real transaction; inner calls open a `SAVEPOINT`, which rolls back to
 * its own boundary and leaves the outer transaction intact. Depth is tracked per database instance,
 * so two databases (production and a test file) never see each other's nesting.
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

    // Savepoint names are generated from the depth, never from anything a caller supplies —
    // SQLite has no way to bind an identifier, so the only safe name is one we compute.
    const savepoint = `traverser_sp_${depth}`;

    db.execSync(`SAVEPOINT ${savepoint}`);

    try {
      task();
      db.execSync(`RELEASE ${savepoint}`);
    } catch (error) {
      // ROLLBACK TO leaves the savepoint on the stack; RELEASE is what removes it. Skipping the
      // release would leak a savepoint per failed inner block and eventually deadlock the outer
      // transaction's commit.
      db.execSync(`ROLLBACK TO ${savepoint}`);
      db.execSync(`RELEASE ${savepoint}`);
      throw error;
    }
  } finally {
    depths.set(db, depth);
  }
}
