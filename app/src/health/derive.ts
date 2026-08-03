import { MINUTE_MS, type LocalDateResolver, minuteOf } from './localDate';

/**
 * tech-03 §5 — raw heart-rate samples to the integer tier minutes the rest of the system consumes.
 *
 * Everything in this module is a **pure function over plain data**: no Health Connect type, no Expo
 * module, no clock, no database. That is not tidiness, it is tech-03 §11's only standing obligation
 * — §5–§9 must not reach for a platform type, so that an iOS port would be one new reader rather
 * than a second derivation. It is also what lets fixtures §11 be asserted with no device.
 *
 * ↯ The privacy constraint that shapes all of it (tech-03 §1.1): **raw heart rate never leaves the
 * device.** BPM enters here and integers leave. Nothing downstream of this file has a BPM to leak.
 */

/** One heart-rate sample, flattened out of whatever record the provider grouped it into. */
export interface HrSample {
  /** Epoch milliseconds. */
  readonly at: number;
  readonly bpm: number;
}

/** 0 is *untiered* — below Tier 1, contributing to nothing. */
export type Tier = 0 | 1 | 2 | 3;

export interface TierThresholds {
  readonly hrMax: number;
  /** Inclusive lower bound in BPM. */
  readonly tier1: number;
  readonly tier2: number;
  readonly tier3: number;
}

/**
 * tech-03 §5.1 — `HRmax = 220 − age`, GDD 1 §2.2's zones converted to BPM bounds.
 *
 * ↯ `ceil`, not `round`, so a minute is never promoted into a tier it is fractionally below.
 * fixtures §11.1 pins this on age 55: three of its five bounds are non-integral before rounding, and
 * a `round` implementation reports Tier 1 at 82 BPM instead of 83.
 *
 * The percentage is applied as an integer numerator before the divide. `hrMax × 0.7` is not always
 * exact in binary — 165 × 0.7 evaluates to 115.49999999999999 — whereas `hrMax × 70 / 100` is.
 * No age in a plausible range currently diverges between the two; this is the form that cannot.
 */
export function thresholdsForAge(age: number): TierThresholds {
  const hrMax = 220 - age;

  return {
    hrMax,
    tier1: Math.ceil((hrMax * 50) / 100),
    tier2: Math.ceil((hrMax * 70) / 100),
    tier3: Math.ceil((hrMax * 85) / 100),
  };
}

/** Age in whole years, from the birth year collected at onboarding (tech-03 §1.4). */
export function ageFromBirthYear(birthYear: number, now: number, dates: LocalDateResolver): number {
  return Number(dates.dateOf(now).slice(0, 4)) - birthYear;
}

/** Bounds are **inclusive** — fixtures §11.2's exact-133 row. */
export function tierForBpm(bpm: number, thresholds: TierThresholds): Tier {
  if (bpm >= thresholds.tier3) {
    return 3;
  }

  if (bpm >= thresholds.tier2) {
    return 2;
  }

  if (bpm >= thresholds.tier1) {
    return 1;
  }

  return 0;
}

/** A whole local minute and the tier its mean BPM earned. */
export interface TieredMinute {
  /** Epoch milliseconds of the instant that opens the minute. */
  readonly startsAt: number;
  readonly tier: Tier;
}

/**
 * tech-03 §5.2 — whole minutes, scored on the **mean** BPM of the samples landing in each.
 *
 * ↯ The mean, not the max and not the last sample: fixtures §11.2's first row is a minute of
 * 130/134/136 that scores Tier 2 on a mean of 133.33 *even though one of its samples is below the
 * Tier 2 bound*. Scoring on any single sample gets that row wrong in one direction or the other.
 *
 * **A minute with no samples is simply absent**, which is the same thing as untiered — sparse
 * sampling must never invent minutes. Minutes that had samples but averaged below Tier 1 are
 * returned with `tier: 0` rather than dropped, because that is a fact the caller may want; to
 * segmentation the two cases are identical.
 *
 * Minute boundaries are computed in epoch arithmetic rather than through the local calendar. Every
 * real UTC offset is a whole number of minutes, so a local minute and a UTC minute are the same
 * span; only the *date* a minute belongs to needs the timezone (see {@link rollUpTierMinutes}).
 */
export function bucketMinutes(
  samples: readonly HrSample[],
  thresholds: TierThresholds,
): TieredMinute[] {
  const buckets = new Map<number, { sum: number; count: number }>();

  for (const sample of samples) {
    const startsAt = minuteOf(sample.at);
    const bucket = buckets.get(startsAt);

    if (bucket === undefined) {
      buckets.set(startsAt, { sum: sample.bpm, count: 1 });
    } else {
      bucket.sum += sample.bpm;
      bucket.count += 1;
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([startsAt, { sum, count }]) => ({
      startsAt,
      tier: tierForBpm(sum / count, thresholds),
    }));
}

/**
 * ↯ **More than** 10, not 10 (GDD 11 §8.1, tech-03 §5.3). A gap of exactly 10 sub-Tier-1 minutes
 * leaves the session open; the 11th closes it. fixtures §11.3's boundary row exists to pin this
 * strict inequality and §11.4 is the same timeline one minute longer, splitting in two.
 */
export const SESSION_GAP_LIMIT_MINUTES = 10;

export interface DerivedSession {
  /** Epoch ms of the first Tier 1+ minute. */
  readonly startedAt: number;
  /**
   * Epoch ms of the **last Tier 1+ minute** — not the end of the gap that closed the session. The
   * gap is a boundary marker, not part of the session (tech-03 §5.3, fixtures §11.4).
   */
  readonly endedAt: number;
  /** Tier 1+ minutes only, in order. Interior gap minutes are inside the session but in no tier. */
  readonly minutes: readonly TieredMinute[];
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
  /**
   * Still growing as of the end of the read window. An open session is uploaded as-is and may grow
   * on the next sync, which is safe because §6.1 freezes its identity — and it is what tech-03 §9's
   * overactivity banner tests for, since a closed session's warning is dropped on the floor.
   */
  readonly open: boolean;
}

/** `hr:{started_at, epoch seconds}` — tech-03 §6, taking tech-01 §7's pre-authorised fallback. */
export function sessionIdFor(startedAt: number): string {
  return `hr:${Math.floor(startedAt / 1000)}`;
}

function sealSession(
  minutes: readonly TieredMinute[],
  startedAt: number,
  endedAt: number,
  open: boolean,
): DerivedSession {
  let tier1Minutes = 0;
  let tier2Minutes = 0;
  let tier3Minutes = 0;

  for (const minute of minutes) {
    if (minute.tier === 1) {
      tier1Minutes += 1;
    } else if (minute.tier === 2) {
      tier2Minutes += 1;
    } else if (minute.tier === 3) {
      tier3Minutes += 1;
    }
  }

  return { startedAt, endedAt, minutes, tier1Minutes, tier2Minutes, tier3Minutes, open };
}

/**
 * tech-03 §5.3 — walk the minute timeline and cut it into sessions.
 *
 * A session opens at the first Tier 1+ minute and closes after more than
 * {@link SESSION_GAP_LIMIT_MINUTES} consecutive minutes below Tier 1.
 *
 * ↯ Derived from the **sample timeline**, never from `ExerciseSessionRecord` (tech-03 §1.2).
 * Anchoring to provider sessions would hand us a stable session id for free and award nothing at all
 * to a player who walks briskly uphill for forty minutes without pressing "start workout" — which
 * GDD 1 §2.2 says has unambiguously earned Tier 1 minutes.
 *
 * `windowEndMs` is the end of the read window, and decides only whether the final session is still
 * open: a trailing gap of 10 minutes or fewer leaves it growing.
 */
export function segmentSessions(
  minutes: readonly TieredMinute[],
  windowEndMs: number,
): DerivedSession[] {
  const tiered = minutes.filter((minute) => minute.tier > 0);
  const sessions: DerivedSession[] = [];

  let current: TieredMinute[] = [];
  let startedAt = 0;
  let endedAt = 0;

  for (const minute of tiered) {
    if (current.length > 0) {
      // Whole minutes strictly between the two tiered ones — the count of consecutive sub-Tier-1
      // minutes, which is what GDD 11 §8.1 measures.
      const gap = Math.round((minute.startsAt - endedAt) / MINUTE_MS) - 1;

      if (gap > SESSION_GAP_LIMIT_MINUTES) {
        sessions.push(sealSession(current, startedAt, endedAt, false));
        current = [];
      }
    }

    if (current.length === 0) {
      startedAt = minute.startsAt;
    }

    current.push(minute);
    endedAt = minute.startsAt;
  }

  if (current.length > 0) {
    const trailingGap = Math.floor((windowEndMs - endedAt) / MINUTE_MS) - 1;

    sessions.push(
      sealSession(current, startedAt, endedAt, trailingGap <= SESSION_GAP_LIMIT_MINUTES),
    );
  }

  return sessions;
}

export interface DayTierMinutes {
  readonly activityDate: string;
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
}

/**
 * tech-03 §5.4 — per-`activity_date` totals, summed **independently of session boundaries**.
 *
 * ↯ A session crossing local midnight is one session whose minutes split across two dates. The
 * session is never cut in half — it is bounded by its instants, not by a date — while the day
 * rollups each take their own share (fixtures §11.5: 10 minutes to the 19th, 16 to the 20th). This
 * matters because the overactivity rule reads the session and the XP rules read the days.
 *
 * ↯ **Tier 3 minutes are raw and uncapped here** (tech-03 §5.5). GDD 1 §2.2's 20-minute daily Peak
 * cap is the server's, evaluated against the day's post-merge cumulative total, which this device
 * cannot know. Applying it here as well would charge the discount twice and quietly underpay a hard
 * workout — fixtures §11.6 is the two numbers side by side.
 */
export function rollUpTierMinutes(
  minutes: readonly TieredMinute[],
  dates: LocalDateResolver,
): DayTierMinutes[] {
  const days = new Map<string, { tier1Minutes: number; tier2Minutes: number; tier3Minutes: number }>();

  for (const minute of minutes) {
    if (minute.tier === 0) {
      continue;
    }

    const activityDate = dates.dateOf(minute.startsAt);
    let day = days.get(activityDate);

    if (day === undefined) {
      day = { tier1Minutes: 0, tier2Minutes: 0, tier3Minutes: 0 };
      days.set(activityDate, day);
    }

    if (minute.tier === 1) {
      day.tier1Minutes += 1;
    } else if (minute.tier === 2) {
      day.tier2Minutes += 1;
    } else {
      day.tier3Minutes += 1;
    }
  }

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([activityDate, totals]) => ({ activityDate, ...totals }));
}
