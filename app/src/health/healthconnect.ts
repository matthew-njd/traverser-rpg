import * as Sentry from '@sentry/react-native';
import {
  type Permission,
  type RecordType,
  SdkAvailabilityStatus,
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

import { type HrSample, type TierThresholds, bucketMinutes, segmentSessions } from './derive';
import type { LocalDateResolver } from './localDate';
import {
  type HealthErrorReason,
  HealthError,
  type HealthPermissions,
  type HealthProvider,
  type HealthSnapshot,
  type ReadWindow,
  type SdkAvailability,
} from './provider';

/**
 * The Health Connect implementation of {@link HealthProvider} — **the only module in the app that
 * imports `react-native-health-connect`** (tech-03 §11).
 *
 * Surface used, and nothing else: `getSdkStatus`, `initialize`, `requestPermission`,
 * `getGrantedPermissions`, `openHealthConnectSettings`, `readRecords`, `aggregateGroupByPeriod`. In
 * particular no `insertRecords`, no `deleteRecords*`, no `revokeAllPermissions` — Traverser is a
 * read-only consumer of health data and should never hold a write permission it could be blamed for
 * (tech-03 §2).
 */

/**
 * Declared here rather than imported: the library defines `TimeRangeFilter` in an internal module
 * that its entry point does not re-export. This is the one shape used, structurally identical.
 */
type BetweenFilter = { operator: 'between'; startTime: string; endTime: string };

const READ_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
];

/**
 * ↯ A guard against an unbounded loop, **not a design limit**. 72 hours of dense Fitbit data at
 * roughly one record per minute is ~4,300 records, so about five pages; 50 is ample and reaching it
 * is reported rather than swallowed (tech-04 §8.2).
 */
const MAX_PAGES = 50;

function reasonFor(cause: unknown): HealthErrorReason {
  const message = cause instanceof Error ? cause.message : String(cause);

  if (/SecurityException|permission\.health|not granted/i.test(message)) {
    return 'permission_denied';
  }

  if (/not initialized/i.test(message)) {
    return 'not_initialized';
  }

  return 'unknown';
}

/**
 * ↯ Every call into the platform goes through here, because these **reject** rather than resolving
 * empty (tech-03 §3 as corrected by the spike, tech-04 §8.3). A read without permission raises
 * `SecurityException`; a call before `initialize()` raises "client not initialized". Both map to
 * banner state.
 */
async function guard<T>(action: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    throw new HealthError(reasonFor(cause), `Health Connect ${action} failed.`, { cause });
  }
}

export function mapAvailability(status: number): SdkAvailability {
  if (status === SdkAvailabilityStatus.SDK_AVAILABLE) {
    return 'available';
  }

  if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'update_required';
  }

  return 'unavailable';
}

/**
 * ↯ Matched by **exact `recordType`**, never by array length or index. Granting Steps silently also
 * grants `StepsCadence` — a record type this app never requests — so the returned array can be
 * longer than the one asked for (tech-03 §3, spike probe 7). Length and position are both
 * meaningless here.
 */
export function permissionsFrom(
  granted: readonly { accessType?: string; recordType?: string }[],
): HealthPermissions {
  const hasRead = (recordType: string): boolean =>
    granted.some(
      (permission) => permission.accessType === 'read' && permission.recordType === recordType,
    );

  return { steps: hasRead('Steps'), heartRate: hasRead('HeartRate') };
}

/**
 * ↯ **No read of any record type bypasses this helper** (tech-04 §8.2). The spike found a 48-hour
 * `HeartRate` read returning exactly 1,000 records with a `pageToken` present — the default page cap
 * — and nothing in tech-03 anticipated it. A read that assumes one call returns the window
 * truncates silently, in the player's disfavour, and only for players active enough to exceed the
 * cap: the failure mode is invisible precisely where it matters most.
 */
export async function readAllRecords<T extends RecordType>(
  recordType: T,
  timeRangeFilter: BetweenFilter,
): Promise<Awaited<ReturnType<typeof readRecords<T>>>['records']> {
  const all: Awaited<ReturnType<typeof readRecords<T>>>['records'] = [];

  let pageToken: string | undefined;
  let pages = 0;

  do {
    const page = await readRecords(recordType, { timeRangeFilter, pageToken });

    all.push(...page.records);
    pageToken = page.pageToken;
    pages += 1;

    if (pages >= MAX_PAGES && pageToken !== undefined) {
      Sentry.captureMessage('health_read_page_cap');
      break;
    }
  } while (pageToken !== undefined);

  return all;
}

const hasZoneDesignator = (instant: string): boolean => /(?:Z|[+-]\d{2}:\d{2})$/.test(instant);

/**
 * ↯ The bucket boundary must be **local** midnight, or every day boundary shifts by the UTC offset
 * and the last hours of every evening walk are misattributed to the following day. The spike
 * confirmed `aggregateGroupByPeriod` slices on local midnight (probe 5) — the open question is only
 * how it *reports* the boundary, so both forms are handled: an instant is converted through the
 * device's own resolver, a zone-less local string is already a local date.
 */
function bucketDate(startTime: string, dates: LocalDateResolver): string {
  return hasZoneDesignator(startTime) ? dates.dateOf(Date.parse(startTime)) : startTime.slice(0, 10);
}

/**
 * tech-03 §4.2 — **aggregation, not raw records.**
 *
 * ↯ Health Connect de-duplicates overlapping step contributions from multiple origins during
 * aggregation. A player wearing a watch while carrying a phone produces two `StepsRecord` streams
 * covering the same wall-clock minutes, and summing raw records double-counts the entire day — the
 * spike measured raw 601 against aggregate 373, a ~60% inflation avoided. Reconciling those streams
 * ourselves would be a real algorithm, and anti-cheat and data-integrity work is explicitly out of
 * sanctioned scope, so the right move is to let the platform do the thing it already does correctly.
 * Multi-origin is the steady state on this device, not an edge case.
 */
async function readDailySteps(
  window: ReadWindow,
  dates: LocalDateResolver,
): Promise<Map<string, number>> {
  const buckets = await guard('step aggregation', () =>
    aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: instantFilter(window),
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    }),
  );

  const dailySteps = new Map<string, number>();

  for (const bucket of buckets) {
    const count = bucket.result.COUNT_TOTAL;

    if (count > 0) {
      const activityDate = bucketDate(bucket.startTime, dates);

      dailySteps.set(activityDate, (dailySteps.get(activityDate) ?? 0) + count);
    }
  }

  return dailySteps;
}

/**
 * ↯ The time range filter must be a **UTC instant string**. A local-naive string throws
 * `Text '...' could not be parsed at index 19` (spike, probes 4–5); the library does the local
 * conversion itself.
 */
function instantFilter(window: ReadWindow): BetweenFilter {
  return {
    operator: 'between',
    startTime: new Date(window.startMs).toISOString(),
    endTime: new Date(window.endMs).toISOString(),
  };
}

/**
 * tech-03 §4.3 — raw records, flattened into one time-ordered sample timeline.
 *
 * ↯ Record grouping is **discarded**. Provider record boundaries are arbitrary and have nothing to
 * do with GDD 11 §8's session definition — the spike found Fitbit writes HR as roughly one record
 * per minute (median duration 57s, ~26 samples each), so a workout arrives as hundreds of adjacent
 * records. Segmenting from those would invent hundreds of sessions.
 *
 * Aggregation is deliberately not used for HR: the available metrics are min/max/average over a
 * span, and averaging a 45-minute workout to a single BPM destroys precisely the time-in-zone
 * information GDD 1 §2.2 charges XP against.
 */
async function readHrSamples(window: ReadWindow): Promise<HrSample[]> {
  const records = await guard('heart-rate read', () =>
    readAllRecords('HeartRate', instantFilter(window)),
  );

  const samples: HrSample[] = [];

  for (const record of records) {
    for (const sample of record.samples) {
      samples.push({ at: Date.parse(sample.time), bpm: sample.beatsPerMinute });
    }
  }

  return samples;
}

export const healthConnectProvider: HealthProvider = {
  async availability() {
    return mapAvailability(await guard('availability check', () => getSdkStatus()));
  },

  async initialize() {
    const ready = await guard('initialization', () => initialize());

    if (!ready) {
      throw new HealthError('unavailable', 'Health Connect declined to initialize.');
    }
  },

  async requestPermissions() {
    // ↯ The return value is deliberately dropped. tech-03 §3: `getGrantedPermissions` is the
    // authority, and the player can grant one record type while denying the other.
    await guard('permission request', () => requestPermission(READ_PERMISSIONS));

    return this.grantedPermissions();
  },

  async grantedPermissions() {
    return permissionsFrom(await guard('permission check', () => getGrantedPermissions()));
  },

  async read(window, thresholds: TierThresholds, dates, granted) {
    // A read of a type that was not granted throws rather than returning empty, so a partial grant
    // is handled by not asking (tech-03 §3's Steps-only and HR-only rows are both legal states).
    const dailySteps = granted.steps ? await readDailySteps(window, dates) : new Map<string, number>();
    const samples = granted.heartRate ? await readHrSamples(window) : [];

    const snapshot: HealthSnapshot = {
      dailySteps,
      sessions: segmentSessions(bucketMinutes(samples, thresholds), window.endMs),
      consumedThrough: window.endMs,
      readSources: granted,
    };

    return snapshot;
  },

  openSettings() {
    openHealthConnectSettings();
  },
};
