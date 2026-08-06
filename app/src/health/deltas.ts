import type { OutboxKind } from '../db/outbox';
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
 * tech-03 §8 — the bridge from §5's derived minutes into tech-02 §5's queue.
 *
 * ↯ This is the subtlest part of T3, and the reason is one sentence: **the read is cumulative and
 * the merge is additive.** tech-02 §6.1 merges steps with `col = col + delta` and tech-03 §4.1
 * re-reads days that were already reported, so shipping the day's observed total on every sync would
 * multiply a day's steps by the number of times the app was opened. Everything below exists to send
 * the *increment over what has already been queued*.
 */

/**
 * The domain shape of a `sync_delta`. Deliberately camelCase and deliberately not the wire shape:
 * tech-04 §8.1 puts the single `snake_case` boundary in P7's `dto.ts`, and nowhere else in the app
 * sees a wire key. What lands in the outbox is this, serialised.
 */
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

/** A session as the ledger now holds it, after identity has been resolved against earlier reads. */
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

/** Has this device ever recorded a mark for this source? Table names are literals, never input. */
const isEmpty = (db: SqliteDatabase, table: 'step_watermark' | 'hr_minute_watermark'): boolean =>
  (db.getFirstSync<{ n: number }>(`SELECT count(*) AS n FROM ${table}`)?.n ?? 0) === 0;

const toOutboxEntry = (delta: MintedDelta) => ({
  clientOpId: delta.clientDeltaId,
  kind: DELTA_KIND,
  payload: delta,
  createdAt: delta.recordedAt,
});

/**
 * tech-03 §6.1/§6.2 — resolve each derived session against the local ledger.
 *
 * ↯ **The start instant must be frozen.** The session id is `hr:{started_at}`, so a start that moves
 * is an id that moves — and a watch syncing late, backfilling earlier samples, moves it. The server
 * would then hold two sessions for one workout, double-counting encounter rolls and re-arming the
 * overactivity warning. A derived session overlapping a ledger entry therefore adopts that entry's
 * id *and* its start, even when the fresh derivation would now place the start earlier.
 *
 * ↯ **When backfill grows two sessions into each other, the earlier id wins** (§6.2, fixtures §11.8).
 * The later id is tombstoned locally and never sent again. The server keeps the orphaned row — it is
 * inert once nothing references it, and deleting server rows from the client is not a capability
 * this protocol has or should have.
 *
 * This is also what makes tech-02 §6.3's set-semantics safe: an open session restates its absolute
 * totals on every sync, which would double a workout if the id were not stable. §6.1 and §6.3 must
 * not be reasoned about separately.
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
 * tech-03 §8.1 — steps, as the difference against the per-date high-water mark.
 *
 * ↯ A **negative** difference means the provider revised the total downward: a duplicate record was
 * removed, or a source was disconnected. Mint nothing and do **not** lower the mark. XP already
 * granted is never taken back (GDD 1 §1), and a lowered mark would re-send the same steps once the
 * count recovered — fixtures §11.7's fourth read is exactly that trap, where the correct delta is
 * 200 against the unlowered mark and not 500 against the revised observation.
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
 * tech-03 §8.2 — HR minutes, per `(activity_date, tier)`.
 *
 * ↯ **The `sync_delta` is the authoritative path to `activity_day` and therefore to XP**; the
 * `hr_session` row is session bookkeeping only and never rolls up into a day. Both payloads carry
 * tier minutes and it must be unambiguous which one credits the player, or a workout is counted
 * twice. An open session that gains 7 Tier 2 minutes between syncs emits a `minutes_delta: 7` *and*
 * restates the session's full Tier 2 total; both are correct, they answer different questions.
 *
 * ↯ Minutes are shipped **raw and uncapped** at Tier 3 (§5.5) — see {@link rollUpTierMinutes}.
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
 * Consume one health read: resolve session identity, mint the deltas, queue them, raise the marks
 * and advance the read watermark — **all in one transaction**.
 *
 * ↯ tech-03 §8.4's ordering is the whole point, and `commitReadCycle` is where it is enforced: the
 * watermark advances only after the deltas are durably queued. A crash between read and enqueue must
 * re-read the same window and produce the same deltas. Getting it the other way round loses activity
 * silently, because the app comes back up looking perfectly healthy with a watermark past a walk it
 * never queued.
 *
 * ↯ **The first read of a device's life credits nothing** — it only establishes the marks. tech-03
 * §4.1's window falls back to `now − 72h` when there is no watermark, and on a fresh install there
 * never is, so without this rule the app harvests whatever history Health Connect already holds and
 * the player arrives several levels deep before taking a step *in the game*. Observed at P9: a first
 * sync read four days back and landed on Level 6.
 *
 * That is wrong three times over. It contradicts the design intent that every Traverser starts at
 * Level 1; it breaks GDD 10 §6's tutorial battle, which is scripted with verified damage values
 * against Level 1 stats and fights an enemy whose level always equals the player's; and it
 * **double-credits a restore**, because the marks live in device-only tables (tech-04 §6.2) that
 * come back empty on a new phone — so the client would re-mint fresh delta ids for days the server
 * already holds, and tech-02 §6.1's additive merge would add them a second time. The idempotency
 * ledger cannot catch that: the ids are genuinely new.
 *
 * One rule fixes all three, because all three are the same situation — a device that has never
 * consumed a read has no basis for claiming any of the history it can see.
 *
 * The transaction is re-entrant (`transact`), which is what lets this compose `commitReadCycle`,
 * `mergeSessions` and `recordSession` — each of which is itself transactional — into one unit of
 * work rather than five.
 */
export function commitHealthRead(
  db: SqliteDatabase,
  snapshot: HealthSnapshot,
  dates: LocalDateResolver,
  now: number,
): HealthReadResult {
  const recordedAt = new Date(now).toISOString();

  // ↯ Per source, not per device. Steps and heart rate become readable at *different moments*:
  // heart rate additionally needs a birth year, which only exists from registration onward, so the
  // first pass of a fresh install reads steps and not HR. A single device-wide flag is consumed by
  // that pass, and the first HR read then lands *after* the baseline and credits the whole history.
  // Observed at P9: steps correctly baselined to a 62-step delta while HR credited 142 Tier-1
  // minutes for the same day — 431 XP on an app that had not been walked with yet.
  const firstSteps = snapshot.readSources.steps && isEmpty(db, 'step_watermark');
  const firstHr = snapshot.readSources.heartRate && isEmpty(db, 'hr_minute_watermark');

  let result: HealthReadResult = { deltas: [], sessions: [] };

  transact(db, () => {
    const sessions = resolveSessions(db, snapshot.sessions);
    const steps = mintStepDeltas(db, snapshot.dailySteps, recordedAt, now);
    const hr = mintHrDeltas(db, snapshot.sessions, dates, recordedAt, now);

    // The marks are raised either way — that is precisely what makes the baseline a baseline. Only
    // the deltas are dropped, so everything observed before this moment is treated as already
    // accounted for rather than as newly earned.
    const deltas = [
      ...(firstSteps ? [] : steps.deltas),
      ...(firstHr ? [] : hr.deltas),
    ];

    // ↯ A source read with nothing to show for it still has to leave a mark, or "never read" and
    // "read, found nothing" stay indistinguishable and the *next* read baselines all over again —
    // which is the same bug one day later. Registering at 6am, before moving, is enough to hit it.
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

    result = { deltas, sessions };
  });

  return result;
}
