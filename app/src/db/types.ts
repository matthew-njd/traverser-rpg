/**
 * The narrow slice of `expo-sqlite`'s **synchronous** API this app actually uses.
 *
 * ↯ This interface exists so the storage layer can be tested without a device. `expo-sqlite` is a
 * native module: under Jest it resolves to a mock with no SQL engine behind it, so every test of a
 * migration, a FIFO drain, or a watermark would be testing a stub. Production binds this to
 * `expo-sqlite`; tests bind it to Node's built-in `node:sqlite`, which is a real SQLite with the
 * same semantics — so the SQL under test is the SQL that ships.
 *
 * The seam is deliberately this thin. It is not a query builder and not an ORM; anything richer
 * would start having behaviour of its own, and then the tests would be exercising the seam instead
 * of the schema.
 */
export type SqlParam = string | number | null;

export interface SqliteDatabase {
  /** Multi-statement DDL. No parameters — `expo-sqlite` does not bind them here either. */
  execSync(sql: string): void;

  runSync(sql: string, params?: SqlParam[]): { changes: number };

  getAllSync<T>(sql: string, params?: SqlParam[]): T[];

  getFirstSync<T>(sql: string, params?: SqlParam[]): T | null;

  closeSync(): void;
}
