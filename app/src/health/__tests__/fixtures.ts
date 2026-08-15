import type { SqliteDatabase } from '../../db/types';
import type { HrSample } from '../derive';
import { MINUTE_MS, fixedOffsetDates } from '../localDate';

/**
 * Shared scaffolding for the fixtures §11 assertions.
 *
 * fixtures §11 declares America/New_York (UTC−4) as part of the fixture. No timeline crosses a DST
 * transition, so a fixed −4 offset reproduces them exactly and the suite ignores the host timezone.
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
 * Marks a database as having already consumed one read. Most tests are about the steady state after
 * the baseline, and say so explicitly rather than getting it by accident.
 */
export function pastFirstRead(db: SqliteDatabase, at = '2026-07-01T00:00:00.000Z'): void {
  db.runSync(
    `INSERT INTO read_watermark (one_row, consumed_through) VALUES (1, ?)
     ON CONFLICT (one_row) DO UPDATE SET consumed_through = excluded.consumed_through`,
    [at],
  );

  // Per source, because the baseline is. A 0 mark on an unasserted date says "read" without
  // pretending anything was earned.
  db.runSync(
    `INSERT INTO step_watermark (activity_date, reported_high_water) VALUES ('1970-01-01', 0)
     ON CONFLICT (activity_date) DO NOTHING`,
  );
  db.runSync(
    `INSERT INTO hr_minute_watermark (activity_date, tier, reported_minutes)
     VALUES ('1970-01-01', 1, 0) ON CONFLICT (activity_date, tier) DO NOTHING`,
  );
}

/**
 * Records every statement, for the structural assertions no black-box test can make — chiefly
 * §8.4's "all in one transaction", where the failure is invisible in the resulting rows.
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

/** Both sources read — the ordinary case once permission and birth year are in place. */
export const READ_BOTH = { steps: true, heartRate: true } as const;
