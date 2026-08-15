/**
 * The narrow slice of `expo-sqlite`'s **synchronous** API this app actually uses.
 *
 * ↯ `expo-sqlite` is a native module and resolves to an engine-less mock under Jest, so every
 * schema test would be testing a stub. Tests bind this to `node:sqlite` instead — real SQLite, same
 * semantics — so the SQL under test is the SQL that ships.
 *
 * Deliberately thin: anything richer would have behaviour of its own to test.
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
