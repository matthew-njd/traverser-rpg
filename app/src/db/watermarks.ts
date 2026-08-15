import { type OutboxKind, enqueueAll } from './outbox';
import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * The high-water marks that make a cumulative read safe to feed an additive merge (tech-03 §8).
 *
 * tech-02 §6.1 merges with `col = col + delta` and tech-03 §4.1 re-reads reported days, so
 * sending the observed total would multiply a day by the number of app opens.
 */

// ---- Steps (tech-03 §8.1) --------------------------------------------------------------------

export function stepHighWater(db: SqliteDatabase, activityDate: string): number {
  return (
    db.getFirstSync<{ reported_high_water: number }>(
      'SELECT reported_high_water FROM step_watermark WHERE activity_date = ?',
      [activityDate],
    )?.reported_high_water ?? 0
  );
}

/**
 * The delta to mint, or 0 for "mint nothing".
 *
 * A negative difference is a downward revision by the provider: mint nothing and do not lower the
 * mark, or the same steps re-send once the count recovers (fixtures §11.7).
 */
export function stepDelta(db: SqliteDatabase, activityDate: string, observedTotal: number): number {
  return Math.max(0, observedTotal - stepHighWater(db, activityDate));
}

/** Raises the mark. Never lowers it — {@link stepDelta} explains why. */
export function raiseStepHighWater(db: SqliteDatabase, activityDate: string, observedTotal: number): void {
  db.runSync(
    `INSERT INTO step_watermark (activity_date, reported_high_water)
     VALUES (?, ?)
     ON CONFLICT (activity_date) DO UPDATE
       SET reported_high_water = MAX(step_watermark.reported_high_water, excluded.reported_high_water)`,
    [activityDate, observedTotal],
  );
}

// ---- HR minutes (tech-03 §8.2) ----------------------------------------------------------------

export function hrMinutesReported(db: SqliteDatabase, activityDate: string, tier: number): number {
  return (
    db.getFirstSync<{ reported_minutes: number }>(
      'SELECT reported_minutes FROM hr_minute_watermark WHERE activity_date = ? AND tier = ?',
      [activityDate, tier],
    )?.reported_minutes ?? 0
  );
}

export function hrMinuteDelta(
  db: SqliteDatabase,
  activityDate: string,
  tier: number,
  observedMinutes: number,
): number {
  return Math.max(0, observedMinutes - hrMinutesReported(db, activityDate, tier));
}

export function raiseHrMinutesReported(
  db: SqliteDatabase,
  activityDate: string,
  tier: number,
  observedMinutes: number,
): void {
  db.runSync(
    `INSERT INTO hr_minute_watermark (activity_date, tier, reported_minutes)
     VALUES (?, ?, ?)
     ON CONFLICT (activity_date, tier) DO UPDATE
       SET reported_minutes = MAX(hr_minute_watermark.reported_minutes, excluded.reported_minutes)`,
    [activityDate, tier, observedMinutes],
  );
}

// ---- The read watermark (tech-03 §4.1, §8.4) --------------------------------------------------

/** End of the last consumed read. Null before the first, which is what triggers §4.1's 72h floor. */
export function readWatermark(db: SqliteDatabase): string | null {
  return (
    db.getFirstSync<{ consumed_through: string }>(
      'SELECT consumed_through FROM read_watermark WHERE one_row = 1',
    )?.consumed_through ?? null
  );
}

/**
 * Never call this directly from a read — §8.4 orders the advance strictly after the deltas are
 * queued. {@link commitReadCycle} is the only correct caller.
 */
function setReadWatermark(db: SqliteDatabase, consumedThrough: string): void {
  db.runSync(
    `INSERT INTO read_watermark (one_row, consumed_through)
     VALUES (1, ?)
     ON CONFLICT (one_row) DO UPDATE SET consumed_through = excluded.consumed_through`,
    [consumedThrough],
  );
}

export interface ReadCycle {
  readonly deltas: readonly { clientOpId: string; kind: OutboxKind; payload: unknown; createdAt: string }[];
  readonly stepMarks: readonly { activityDate: string; observedTotal: number }[];
  readonly hrMarks: readonly { activityDate: string; tier: number; observedMinutes: number }[];
  /** The end of the window just consumed. */
  readonly consumedThrough: string;
}

/**
 * Queue the deltas, raise the marks, advance the watermark — all in one transaction.
 *
 * tech-03 §8.4: the watermark advances only after the deltas are durably queued — not after a
 * successful read, and not after a successful upload. The reverse loses activity silently, because
 * the app returns looking healthy with a watermark past a walk it never queued. The single
 * transaction is what makes that true under process death, and why tech-04 §6.1 wants
 * `synchronous = FULL`: `NORMAL` can lose the last transaction on a crash.
 */
export function commitReadCycle(db: SqliteDatabase, cycle: ReadCycle): void {
  transact(db, () => {
    enqueueAll(db, cycle.deltas);

    for (const mark of cycle.stepMarks) {
      raiseStepHighWater(db, mark.activityDate, mark.observedTotal);
    }

    for (const mark of cycle.hrMarks) {
      raiseHrMinutesReported(db, mark.activityDate, mark.tier, mark.observedMinutes);
    }

    setReadWatermark(db, cycle.consumedThrough);
  });
}

// ---- Session ledger (tech-03 §6.1) ------------------------------------------------------------

export interface LedgerSession {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly tombstonedInto: string | null;
}

interface LedgerRow {
  session_id: string;
  started_at: string;
  ended_at: string;
  tombstoned_into: string | null;
}

const toSession = (row: LedgerRow): LedgerSession => ({
  sessionId: row.session_id,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  tombstonedInto: row.tombstoned_into,
});

export function findSession(db: SqliteDatabase, sessionId: string): LedgerSession | null {
  const row = db.getFirstSync<LedgerRow>(
    'SELECT session_id, started_at, ended_at, tombstoned_into FROM hr_session_ledger WHERE session_id = ?',
    [sessionId],
  );

  return row === null ? null : toSession(row);
}

/**
 * Records a session the first time it is seen and freezes its `started_at` (tech-03 §6.1).
 *
 * The id derives from the start instant, so a start that moves is an id that moves — two server
 * sessions for one workout. Only `ended_at` grows.
 */
export function recordSession(
  db: SqliteDatabase,
  session: { sessionId: string; startedAt: string; endedAt: string },
): void {
  db.runSync(
    `INSERT INTO hr_session_ledger (session_id, started_at, ended_at)
     VALUES (?, ?, ?)
     ON CONFLICT (session_id) DO UPDATE
       SET ended_at = MAX(hr_session_ledger.ended_at, excluded.ended_at)`,
    [session.sessionId, session.startedAt, session.endedAt],
  );
}

/**
 * tech-03 §6.2 — backfill closed the gap between two sessions. The earlier id wins; the later is
 * tombstoned locally and never sent again.
 */
export function mergeSessions(db: SqliteDatabase, survivingId: string, tombstonedId: string): void {
  transact(db, () => {
    const surviving = findSession(db, survivingId);
    const tombstoned = findSession(db, tombstonedId);

    if (surviving === null || tombstoned === null) {
      throw new Error(`Cannot merge unknown sessions ${survivingId} / ${tombstonedId}.`);
    }

    // Guards the invariant rather than trusting the caller: backwards would move a frozen start.
    if (surviving.startedAt > tombstoned.startedAt) {
      throw new Error(
        `Merge must keep the earlier session: ${survivingId} starts after ${tombstonedId}.`,
      );
    }

    db.runSync(
      `UPDATE hr_session_ledger
       SET ended_at = MAX(ended_at, ?)
       WHERE session_id = ?`,
      [tombstoned.endedAt, survivingId],
    );

    db.runSync('UPDATE hr_session_ledger SET tombstoned_into = ? WHERE session_id = ?', [
      survivingId,
      tombstonedId,
    ]);
  });
}

/** Sessions that are still their own — tombstoned ones are never sent again. */
export function liveSessions(db: SqliteDatabase): LedgerSession[] {
  return db
    .getAllSync<LedgerRow>(
      `SELECT session_id, started_at, ended_at, tombstoned_into
       FROM hr_session_ledger
       WHERE tombstoned_into IS NULL
       ORDER BY started_at`,
    )
    .map(toSession);
}
