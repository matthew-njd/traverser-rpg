/**
 * Local-date resolution, isolated behind an interface.
 *
 * The client owns the local-midnight boundary because it owns the live timezone (tech-02 §2) — a
 * server deriving it puts the day boundary in the wrong place for anyone who travels.
 *
 * The seam exists because fixtures are declared in America/New_York and the test machine is not.
 */
export interface LocalDateResolver {
  /** The `YYYY-MM-DD` local date containing this instant. */
  dateOf(epochMs: number): string;

  /** The instant of local midnight opening the day that contains this instant. */
  startOfDay(epochMs: number): number;
}

export const MINUTE_MS = 60_000;

/** The instant that opens the whole local minute containing `epochMs`. */
export function minuteOf(epochMs: number): number {
  return Math.floor(epochMs / MINUTE_MS) * MINUTE_MS;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const format = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

/**
 * The device's own timezone, which is the player's.
 *
 * Deliberately `Date` rather than `Intl`: Hermes gets its `Intl` from Android's ICU and the exact
 * surface varies by OS version, whereas `Date`'s local accessors are the one thing every JS runtime
 * implements against the system zone. `setHours(0, 0, 0, 0)` also lands on the correct instant
 * across a DST transition, which arithmetic on a fixed offset would not.
 */
export const deviceLocalDates: LocalDateResolver = {
  dateOf(epochMs) {
    const at = new Date(epochMs);

    return format(at.getFullYear(), at.getMonth() + 1, at.getDate());
  },

  startOfDay(epochMs) {
    const at = new Date(epochMs);

    at.setHours(0, 0, 0, 0);

    return at.getTime();
  },
};

/** The calendar date before `date`. Arithmetic on the date itself, so no DST day to cross. */
export function dayBefore(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/**
 * A resolver at a fixed UTC offset. This is what the fixtures need — fixtures §11 declares its
 * offset (`UTC−4, EDT`) as *part of the fixture*, and none of its timelines cross a DST transition,
 * so a fixed offset is exact for them rather than an approximation of one.
 *
 * Not used on the device: a fixed offset would be wrong twice a year.
 */
export function fixedOffsetDates(offsetMinutes: number): LocalDateResolver {
  const offsetMs = offsetMinutes * MINUTE_MS;

  return {
    dateOf(epochMs) {
      const shifted = new Date(epochMs + offsetMs);

      return format(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
    },

    startOfDay(epochMs) {
      const shifted = epochMs + offsetMs;

      return Math.floor(shifted / 86_400_000) * 86_400_000 - offsetMs;
    },
  };
}
