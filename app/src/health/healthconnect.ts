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
 * The only module that imports `react-native-health-connect` (tech-03 §11).
 *
 * Read-only surface by design — no `insertRecords`, `deleteRecords*` or `revokeAllPermissions`.
 * Traverser must never hold a health write permission it could be blamed for (tech-03 §2).
 */

/** Declared here: the library does not re-export `TimeRangeFilter` from its entry point. */
type BetweenFilter = { operator: 'between'; startTime: string; endTime: string };

const READ_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
];

/** A guard against an unbounded loop, not a design limit — 72h of dense data is ~5 pages. */
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

/** ↯ Platform calls **reject** rather than resolving empty (tech-03 §3, tech-04 §8.3). */
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
 * ↯ Matched by exact `recordType`, never length or index: granting Steps silently also grants
 * `StepsCadence`, so the returned array can be longer than the one asked for (tech-03 §3).
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
 * ↯ No read bypasses this (tech-04 §8.2). Reads cap at 1,000 records with a `pageToken`; assuming
 * one call returns the window truncates silently, and only for the most active players.
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
    // ↯ The typings say `string | undefined`; the last page arrives as `null` from Kotlin.
    pageToken = page.pageToken || undefined;
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
 * ↯ The boundary must be local midnight or every evening walk shifts a day. The library slices
 * locally; only how it *reports* the boundary varies, so both instant and zone-less forms are read.
 */
function bucketDate(startTime: string, dates: LocalDateResolver): string {
  return hasZoneDesignator(startTime) ? dates.dateOf(Date.parse(startTime)) : startTime.slice(0, 10);
}

/**
 * tech-03 §4.2 — aggregation, not raw records.
 *
 * Aggregation de-duplicates across origins. A watch plus a phone writes two overlapping `Steps`
 * streams, and summing raw records double-counts the day (spike: raw 601 vs aggregate 373).
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

/** ↯ Must be a UTC instant string — a local-naive one throws "could not be parsed at index 19". */
function instantFilter(window: ReadWindow): BetweenFilter {
  return {
    operator: 'between',
    startTime: new Date(window.startMs).toISOString(),
    endTime: new Date(window.endMs).toISOString(),
  };
}

/**
 * tech-03 §4.3 — raw records flattened into one sample timeline.
 *
 * Record grouping is discarded: providers write HR as ~one record per minute, so segmenting from
 * record boundaries would invent hundreds of sessions. Aggregation is unusable here — averaging a
 * workout to one BPM destroys the time-in-zone GDD 1 §2.2 charges against.
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
    // Return value dropped: `getGrantedPermissions` is the authority (tech-03 §3).
    await guard('permission request', () => requestPermission(READ_PERMISSIONS));

    return this.grantedPermissions();
  },

  async grantedPermissions() {
    return permissionsFrom(await guard('permission check', () => getGrantedPermissions()));
  },

  async read(window, thresholds: TierThresholds, dates, granted) {
    // Reading an ungranted type throws, so a partial grant is handled by not asking (tech-03 §3).
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
