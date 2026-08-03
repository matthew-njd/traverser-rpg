import { type OutboxKind, enqueueAll } from './outbox';
import { transact } from './transaction';
import type { SqliteDatabase } from './types';

/**
 * The high-water marks that make a *cumulative* health read safe to feed an *additive* merge
 * (tech-03 §8).
 *
 * ↯ The whole reason these exist: tech-02 §6.1 merges steps with `col = col + delta`, and tech-03
 * §4.1 re-reads days that were already reported. Sending the day's observed total on every sync
 * would multiply a day's steps by the number of times the app was opened.
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
 * The delta to mint for an observed total, or 0 for "mint nothing".
 *
 * ↯ A **negative** difference means the provider revised a total downward — a duplicate record was
 * removed, or a source was disconnected. Mint nothing, and do not lower the mark either: XP already
 * granted is never taken back (GDD 1 §1), and lowering the mark would re-send the same steps once
 * the count recovered. fixtures §11.7 walks the four-read case this protects.
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

/**
 * The end instant of the last successfully-consumed read. Null before the first one, which is what
 * makes the first window fall back to tech-03 §4.1's `now − 72h` floor.
 */
export function readWatermark(db: SqliteDatabase): string | null {
  return (
    db.getFirstSync<{ consumed_through: string }>(
      'SELECT consumed_through FROM read_watermark WHERE one_row = 1',
    )?.consumed_through ?? null
  );
}

/**
 * ↯ **Do not call this directly from a read.** tech-03 §8.4 orders the advance strictly after the
 * resulting deltas are durably queued; {@link commitReadCycle} is the only correct caller, and it
 * exists so that ordering cannot be got wrong by accident at a call site.
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
 * Commits one health-read cycle: queue the deltas, raise the per-date marks, then advance the read
 * watermark — **all in one transaction**.
 *
 * ↯ This function is tech-03 §8.4 made unbreakable. The rule is that the watermark advances only
 * after the deltas are durably queued: not after a successful *read*, and not after a successful
 * *upload*. A crash between read and enqueue must re-read the same window and produce the same
 * deltas; a crash after enqueue is already covered by the queue's durability and the server's
 * idempotency ledger. Ordering it the other way loses activity in exactly the case the entire delta
 * protocol exists to protect against — and it loses it silently, because the app comes back up
 * looking perfectly healthy with a watermark past the activity it never queued.
 *
 * Wrapping all three writes in one transaction is what makes "queued before advanced" true even
 * under process death rather than merely true in the order the statements are written. It is also
 * why tech-04 §6.1 insists on `synchronous = FULL` — `NORMAL` can lose the last transaction on a
 * crash, which would put a hole in precisely this guarantee.
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
 * Records a session the first time it is seen, and **freezes its `started_at`**.
 *
 * ↯ On a later read the same session keeps this start even if newly-backfilled earlier samples
 * would now place it earlier (tech-03 §6.1). The session id is derived from the start instant, so a
 * start that moves is an id that moves — the server would then hold two sessions for one workout,
 * double-counting encounter rolls and re-arming the overactivity warning. Only `ended_at` grows.
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
 * tech-03 §6.2 — two previously-separate sessions grew into each other when backfill closed the gap
 * below 10 minutes. **The earlier id wins**: the later session's minutes fold into it, and the later
 * id is tombstoned locally and never sent again.
 */
export function mergeSessions(db: SqliteDatabase, survivingId: string, tombstonedId: string): void {
  transact(db, () => {
    const surviving = findSession(db, survivingId);
    const tombstoned = findSession(db, tombstonedId);

    if (surviving === null || tombstoned === null) {
      throw new Error(`Cannot merge unknown sessions ${survivingId} / ${tombstonedId}.`);
    }

    // Guards the invariant rather than trusting the caller — "earlier wins" is the whole rule, and
    // getting it backwards would move a frozen start, which §6.1 exists to prevent.
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
