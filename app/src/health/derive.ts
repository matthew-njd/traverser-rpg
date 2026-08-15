import { MINUTE_MS, type LocalDateResolver, minuteOf } from './localDate';

/**
 * tech-03 §5 — heart-rate samples to integer tier minutes.
 *
 * Pure functions over plain data: no platform type, no clock, no database (tech-03 §11).
 *
 * tech-03 §1.1 — raw heart rate never leaves the device. BPM enters here, integers leave.
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
 * `ceil`, not `round` (fixtures §11.1, age 55). Integer numerator before the divide, because
 * `165 × 0.7` is 115.49999999999999 in binary and `165 × 70 / 100` is not.
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
 * The mean, not the max or the last sample (fixtures §11.2, row 1).
 *
 * A minute with no samples is absent, never invented. Epoch arithmetic is safe for the boundary
 * because every real UTC offset is a whole number of minutes; only the *date* needs the timezone.
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

/** **More than** 10, not 10 — the 11th closes it (GDD 11 §8.1, fixtures §11.3 vs §11.4). */
export const SESSION_GAP_LIMIT_MINUTES = 10;

export interface DerivedSession {
  /** Epoch ms of the first Tier 1+ minute. */
  readonly startedAt: number;
  /** Epoch ms of the last Tier 1+ minute — not the end of the closing gap (fixtures §11.4). */
  readonly endedAt: number;
  /** Tier 1+ minutes only, in order. Interior gap minutes are inside the session but in no tier. */
  readonly minutes: readonly TieredMinute[];
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
  /** Still growing at the end of the read window. Safe to upload because §6.1 freezes its id. */
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
 * Opens at the first Tier 1+ minute, closes after more than {@link SESSION_GAP_LIMIT_MINUTES}
 * consecutive minutes below Tier 1. `windowEndMs` decides only whether the last session is open.
 *
 * Derived from the sample timeline, never from `ExerciseSessionRecord` (tech-03 §1.2): anchoring
 * to provider sessions awards nothing to someone who walks uphill without pressing "start workout".
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
      // Consecutive sub-Tier-1 minutes strictly between the two tiered ones (GDD 11 §8.1).
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
 * A session crossing local midnight is never cut in half; the day rollups each take their share
 * (fixtures §11.5).
 *
 * Tier 3 stays raw and uncapped (tech-03 §5.5). The 20-minute Peak cap is the server's, against
 * the day's post-merge total — capping here too underpays a hard workout (fixtures §11.6).
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
