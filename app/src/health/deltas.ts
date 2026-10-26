import { MAX_ATTEMPTS, type OutboxKind, acknowledge, enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import {
  type ReadCycle,
  commitReadCycle,
  hrMinuteDelta,
  liveSessions,
  mergeSessions,
  recordSession,
  stepDelta,
} from '../db/watermarks';
import { type DerivedSession, type Tier, rollUpTierMinutes, sessionIdFor } from './derive';
import type { LocalDateResolver } from './localDate';
import { mintUuidV7 } from './deltaId';
import type { HealthSnapshot } from './provider';

/**
 * tech-03 §8 — derived minutes into the tech-02 §5 queue.
 *
 * The read is cumulative, the merge is additive. Ship a day's observed *total* and tech-02 §6.1
 * multiplies it by the number of times the app was opened. Everything here sends the increment.
 */

/** Domain shape, not wire shape — the only snake_case boundary is `dto.ts` (tech-04 §8.1). */
export interface MintedDelta {
  readonly clientDeltaId: string;
  readonly activityDate: string;
  readonly source: 'steps' | 'hr';
  readonly stepsDelta: number;
  readonly minutesDelta: number;
  /** 1–3, and always present when `source` is `hr`. */
  readonly hrTier: Tier | null;
  readonly recordedAt: string;
}

export interface ResolvedSession {
  readonly sessionId: string;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
  readonly open: boolean;
}

export interface HealthReadResult {
  readonly deltas: readonly MintedDelta[];
  readonly sessions: readonly ResolvedSession[];
}

const DELTA_KIND: OutboxKind = 'sync_delta';

/** Table names are literals here, never input. */
const isEmpty = (db: SqliteDatabase, table: 'step_watermark' | 'hr_minute_watermark'): boolean =>
  (db.getFirstSync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)?.n ?? 0) === 0;

const toOutboxEntry = (delta: MintedDelta) => ({
  clientOpId: delta.clientDeltaId,
  kind: DELTA_KIND,
  payload: delta,
  createdAt: delta.recordedAt,
});

/**
 * tech-03 §6.1/§6.2 — resolve derived sessions against the ledger.
 *
 * The start instant must stay frozen: the id is `hr:{started_at}`, so backfill that moves the
 * start would split one workout into two server rows. An overlapping entry's id *and* start win.
 * When backfill grows two sessions together the earlier id wins (§6.2, fixtures §11.8).
 */
function resolveSessions(
  db: SqliteDatabase,
  derived: readonly DerivedSession[],
): ResolvedSession[] {
  const resolved: ResolvedSession[] = [];

  for (const session of derived) {
    const overlapping = liveSessions(db)
      .map((entry) => ({
        ...entry,
        startedAtMs: Date.parse(entry.startedAt),
        endedAtMs: Date.parse(entry.endedAt),
      }))
      .filter(
        (entry) => session.startedAt <= entry.endedAtMs && entry.startedAtMs <= session.endedAt,
      )
      .sort((a, b) => a.startedAtMs - b.startedAtMs);

    const anchor = overlapping[0];
    const startedAt = anchor === undefined ? session.startedAt : anchor.startedAtMs;
    const sessionId = anchor === undefined ? sessionIdFor(startedAt) : anchor.sessionId;

    for (const loser of overlapping.slice(1)) {
      mergeSessions(db, sessionId, loser.sessionId);
    }

    const endedAt = Math.max(
      session.endedAt,
      ...overlapping.map((entry) => entry.endedAtMs),
    );

    recordSession(db, {
      sessionId,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
    });

    resolved.push({
      sessionId,
      startedAt,
      endedAt,
      tier1Minutes: session.tier1Minutes,
      tier2Minutes: session.tier2Minutes,
      tier3Minutes: session.tier3Minutes,
      open: session.open,
    });
  }

  return resolved;
}

/**
 * tech-03 §8.1 — steps as the difference against the per-date high-water mark.
 *
 * A negative difference is a downward revision by the provider: mint nothing, and do **not** lower
 * the mark, or the same steps re-send once the count recovers (fixtures §11.7, read 4).
 */
function mintStepDeltas(
  db: SqliteDatabase,
  dailySteps: ReadonlyMap<string, number>,
  recordedAt: string,
  now: number,
): { deltas: MintedDelta[]; marks: { activityDate: string; observedTotal: number }[] } {
  const deltas: MintedDelta[] = [];
  const marks: { activityDate: string; observedTotal: number }[] = [];

  for (const [activityDate, observedTotal] of [...dailySteps].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    marks.push({ activityDate, observedTotal });

    const delta = stepDelta(db, activityDate, observedTotal);

    if (delta === 0) {
      continue;
    }

    deltas.push({
      clientDeltaId: mintUuidV7(db, now),
      activityDate,
      source: 'steps',
      stepsDelta: delta,
      minutesDelta: 0,
      hrTier: null,
      recordedAt,
    });
  }

  return { deltas, marks };
}

/**
 * tech-03 §8.2 — HR minutes per `(activity_date, tier)`.
 *
 * The `sync_delta` is the only path to `activity_day` and therefore to XP; the `hr_session` row is
 * bookkeeping and never rolls up. Both carry tier minutes — crediting from both counts a workout
 * twice. Minutes ship raw and uncapped at Tier 3 (§5.5).
 */
function mintHrDeltas(
  db: SqliteDatabase,
  sessions: readonly DerivedSession[],
  dates: LocalDateResolver,
  recordedAt: string,
  now: number,
): {
  deltas: MintedDelta[];
  marks: { activityDate: string; tier: number; observedMinutes: number }[];
} {
  const deltas: MintedDelta[] = [];
  const marks: { activityDate: string; tier: number; observedMinutes: number }[] = [];
  const days = rollUpTierMinutes(
    sessions.flatMap((session) => session.minutes),
    dates,
  );

  for (const day of days) {
    const observed: [Tier, number][] = [
      [1, day.tier1Minutes],
      [2, day.tier2Minutes],
      [3, day.tier3Minutes],
    ];

    for (const [tier, observedMinutes] of observed) {
      if (observedMinutes === 0) {
        continue;
      }

      marks.push({ activityDate: day.activityDate, tier, observedMinutes });

      const delta = hrMinuteDelta(db, day.activityDate, tier, observedMinutes);

      if (delta === 0) {
        continue;
      }

      deltas.push({
        clientDeltaId: mintUuidV7(db, now),
        activityDate: day.activityDate,
        source: 'hr',
        stepsDelta: 0,
        minutesDelta: delta,
        hrTier: tier,
        recordedAt,
      });
    }
  }

  return { deltas, marks };
}

/**
 * Consume one health read — resolve identity, mint, queue, raise marks, advance the watermark, all
 * in one transaction.
 *
 * tech-03 §8.4's ordering: the watermark advances only after the deltas are durably queued, so a
 * crash re-reads the same window. The reverse loses a walk silently.
 *
 * A device's first read of a source credits nothing — it only sets the marks (tech-03 §4.1).
 */
export function commitHealthRead(
  db: SqliteDatabase,
  snapshot: HealthSnapshot,
  dates: LocalDateResolver,
  now: number,
): HealthReadResult {
  const recordedAt = new Date(now).toISOString();

  // Per source, not per device. HR additionally needs a birth year, so a fresh install's first
  // pass reads steps and not HR — one device-wide flag is consumed by steps and HR then credits the
  // whole 72-hour history.
  const firstSteps = snapshot.readSources.steps && isEmpty(db, 'step_watermark');
  const firstHr = snapshot.readSources.heartRate && isEmpty(db, 'hr_minute_watermark');

  let result: HealthReadResult = { deltas: [], sessions: [] };

  transact(db, () => {
    const sessions = resolveSessions(db, snapshot.sessions);
    const steps = mintStepDeltas(db, snapshot.dailySteps, recordedAt, now);
    const hr = mintHrDeltas(db, snapshot.sessions, dates, recordedAt, now);

    // Marks are raised either way — that is what makes it a baseline rather than amnesia.
    const deltas = [
      ...(firstSteps ? [] : steps.deltas),
      ...(firstHr ? [] : hr.deltas),
    ];

    // A source read with nothing to show still leaves a mark, or "never read" and "read, found
    // nothing" stay indistinguishable and the next read baselines again.
    const today = dates.dateOf(snapshot.consumedThrough);
    const stepMarks = snapshot.readSources.steps && steps.marks.length === 0
      ? [{ activityDate: today, observedTotal: 0 }]
      : steps.marks;
    const hrMarks = snapshot.readSources.heartRate && hr.marks.length === 0
      ? [{ activityDate: today, tier: 1, observedMinutes: 0 }]
      : hr.marks;

    const cycle: ReadCycle = {
      deltas: deltas.map(toOutboxEntry),
      stepMarks,
      hrMarks,
      consumedThrough: new Date(snapshot.consumedThrough).toISOString(),
    };

    commitReadCycle(db, cycle);
    coalesceQueue(db, now);

    result = { deltas, sessions };
  });

  return result;
}

/** tech-02 §5's queue cap. */
export const QUEUE_CAP = 5_000;

/**
 * tech-02 §5 — past the cap, the oldest deltas sharing a date, source and tier merge into one under a
 * fresh id. Every step and minute is kept. The tier is in the key because it sets a minute's XP rate.
 *
 * ponytail: originals that reached the server under a lost response credit twice once merged; T2
 * accepts it at 5,000 entries (DECISIONS 2026-10-25).
 */
export function coalesceQueue(db: SqliteDatabase, now: number, cap: number = QUEUE_CAP): void {
  const rows = db.getAllSync<{ client_op_id: string; payload: string; created_at: string }>(
    `SELECT client_op_id, payload, created_at FROM outbox
      WHERE kind = ? AND attempts < ? ORDER BY created_at, client_op_id`,
    [DELTA_KIND, MAX_ATTEMPTS],
  );

  let count = rows.length;

  if (count <= cap) {
    return;
  }

  // In order of each group's oldest entry, so the oldest merge first.
  const groups = new Map<string, { id: string; delta: MintedDelta; createdAt: string }[]>();

  for (const row of rows) {
    const delta = JSON.parse(row.payload) as MintedDelta;
    const key = `${delta.activityDate}|${delta.source}|${delta.hrTier ?? ''}`;

    groups.set(key, [...(groups.get(key) ?? []), { id: row.client_op_id, delta, createdAt: row.created_at }]);
  }

  for (const group of groups.values()) {
    if (count <= cap) {
      break;
    }

    const [first] = group;
    const last = group[group.length - 1];

    if (group.length < 2 || first === undefined || last === undefined) {
      continue;
    }

    const merged: MintedDelta = {
      ...first.delta,
      clientDeltaId: mintUuidV7(db, now),
      stepsDelta: group.reduce((sum, entry) => sum + entry.delta.stepsDelta, 0),
      minutesDelta: group.reduce((sum, entry) => sum + entry.delta.minutesDelta, 0),
      recordedAt: last.delta.recordedAt,
    };

    transact(db, () => {
      acknowledge(db, group.map((entry) => entry.id));
      // The oldest entry's queue position, so the merge drains where its first part would have.
      enqueue(db, { clientOpId: merged.clientDeltaId, kind: DELTA_KIND, payload: merged, createdAt: first.createdAt });
    });

    count -= group.length - 1;
  }
}
