import type { SqliteDatabase } from '../../db/types';
import type { HrSample } from '../derive';
import { MINUTE_MS, fixedOffsetDates } from '../localDate';

/**
 * Shared scaffolding for the fixtures §11 assertions.
 *
 * ↯ fixtures §11 declares its timezone as part of the fixture — *"All local times are
 * **America/New_York (UTC−4, EDT)** and the offset is part of the fixture — session IDs are
 * epoch-derived"*. None of its timelines crosses a DST transition, so a fixed −4 offset reproduces
 * them exactly rather than approximately, and the suite does not depend on the timezone of whatever
 * machine runs it.
 */
export const EDT_OFFSET_MINUTES = -4 * 60;

export const edtDates = fixedOffsetDates(EDT_OFFSET_MINUTES);

/** `edt('2026-07-19T10:00')` — a fixture's local wall-clock time as an instant. */
export const edt = (localTime: string): number => Date.parse(`${localTime}:00-04:00`);

/** age 30 → HRmax 190, bounds 95 / 133 / 162 (fixtures §11.1). */
export const TIER_1_BPM = 100;
export const TIER_2_BPM = 140;
export const TIER_3_BPM = 170;

/** One sample per minute for `count` consecutive minutes from a fixture's local start time. */
export function minutes(startLocal: string, count: number, bpm: number): HrSample[] {
  const start = edt(startLocal);

  return Array.from({ length: count }, (_, index) => ({ at: start + index * MINUTE_MS, bpm }));
}

/**
 * Wraps a database so every statement it executes is recorded. Used for the structural assertions
 * that no black-box test can make — chiefly tech-03 §8.4's "all of it in one transaction", where the
 * failure being guarded against is invisible in the resulting rows.
 */
export function recordingDatabase(db: SqliteDatabase): {
  db: SqliteDatabase;
  statements: string[];
} {
  const statements: string[] = [];

  return {
    statements,
    db: {
      execSync: (sql) => {
        statements.push(sql.trim());

        return db.execSync(sql);
      },
      runSync: (sql, params) => {
        statements.push(sql.trim());

        return db.runSync(sql, params);
      },
      getAllSync: (sql, params) => db.getAllSync(sql, params),
      getFirstSync: (sql, params) => db.getFirstSync(sql, params),
      closeSync: () => db.closeSync(),
    },
  };
}
