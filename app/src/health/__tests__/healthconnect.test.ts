import * as Sentry from '@sentry/react-native';
import {
  aggregateGroupByPeriod,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
} from 'react-native-health-connect';

import { thresholdsForAge } from '../derive';
import {
  healthConnectProvider,
  mapAvailability,
  permissionsFrom,
  readAllRecords,
} from '../healthconnect';
import { HealthError } from '../provider';
import { edt, edtDates } from './fixtures';

jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));

jest.mock('react-native-health-connect', () => ({
  SdkAvailabilityStatus: {
    SDK_UNAVAILABLE: 1,
    SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2,
    SDK_AVAILABLE: 3,
  },
  getSdkStatus: jest.fn(),
  initialize: jest.fn(),
  requestPermission: jest.fn(),
  getGrantedPermissions: jest.fn(),
  openHealthConnectSettings: jest.fn(),
  readRecords: jest.fn(),
  aggregateGroupByPeriod: jest.fn(),
}));

/**
 * The Health Connect adapter — four behaviours the spike proved and one the library's own docs do
 * not lead you to. All of them are testable against a mocked module because they are decisions about
 * *how the platform is called*, not about what it returns; the platform itself is proven on the
 * device at P9.
 */

const mockRead = jest.mocked(readRecords);
const mockAggregate = jest.mocked(aggregateGroupByPeriod);
const mockGranted = jest.mocked(getGrantedPermissions);
const AGE_30 = thresholdsForAge(30);
const WINDOW = { startMs: edt('2026-07-19T00:00'), endMs: edt('2026-07-19T18:00') };
const BOTH = { steps: true, heartRate: true };

const stepsPage = (records: unknown[], pageToken?: string) =>
  ({ records, pageToken }) as unknown as Awaited<ReturnType<typeof readRecords>>;

beforeEach(() => {
  jest.clearAllMocks();
  mockAggregate.mockResolvedValue([]);
  mockRead.mockResolvedValue(stepsPage([]));
});

describe('availability (tech-03 §2)', () => {
  /** ↯ Three states, not two — "too old" is a real state with a different fix from "not there". */
  it('maps the three SDK states', () => {
    expect(mapAvailability(3)).toBe('available');
    expect(mapAvailability(2)).toBe('update_required');
    expect(mapAvailability(1)).toBe('unavailable');
  });

  it('treats an unrecognised status as unavailable', () => {
    expect(mapAvailability(99)).toBe('unavailable');
  });

  it('rejects when initialize declines', async () => {
    jest.mocked(initialize).mockResolvedValue(false);

    await expect(healthConnectProvider.initialize()).rejects.toBeInstanceOf(HealthError);
  });
});

describe('granted permissions (tech-03 §3)', () => {
  /**
   * ↯ Granting Steps silently also grants `StepsCadence`, a record type this app never requests. The
   * returned array can therefore be *longer* than the one asked for, which makes both its length and
   * the position of anything in it meaningless — the spike's probe 7.
   */
  it('matches by exact recordType, ignoring the silently-granted StepsCadence', () => {
    const granted = permissionsFrom([
      { accessType: 'read', recordType: 'Steps' },
      { accessType: 'read', recordType: 'StepsCadence' },
    ]);

    expect(granted).toEqual({ steps: true, heartRate: false });
  });

  it('reports a partial grant independently', () => {
    expect(permissionsFrom([{ accessType: 'read', recordType: 'HeartRate' }])).toEqual({
      steps: false,
      heartRate: true,
    });
  });

  it('does not count a write permission as a read', () => {
    expect(permissionsFrom([{ accessType: 'write', recordType: 'Steps' }])).toEqual({
      steps: false,
      heartRate: false,
    });
  });

  /** ↯ `requestPermission`'s return value is never the authority; `getGrantedPermissions` is. */
  it('re-reads the granted set rather than trusting the request result', async () => {
    jest
      .mocked(requestPermission)
      .mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }, { accessType: 'read', recordType: 'HeartRate' }]);
    mockGranted.mockResolvedValue([{ accessType: 'read', recordType: 'Steps' }]);

    await expect(healthConnectProvider.requestPermissions()).resolves.toEqual({
      steps: true,
      heartRate: false,
    });
    expect(mockGranted).toHaveBeenCalled();
  });
});

describe('pagination (tech-04 §8.2)', () => {
  /**
   * ↯ The spike found a 48-hour `HeartRate` read returning exactly 1,000 records with a `pageToken`
   * present. A read that assumes one call returns the window truncates silently, in the player's
   * disfavour, and only for players active enough to exceed the cap.
   */
  it('follows the pageToken to the end', async () => {
    mockRead
      .mockResolvedValueOnce(stepsPage([{ id: 1 }], 'page-2'))
      .mockResolvedValueOnce(stepsPage([{ id: 2 }], 'page-3'))
      .mockResolvedValueOnce(stepsPage([{ id: 3 }]));

    const records = await readAllRecords('HeartRate', {
      operator: 'between',
      startTime: '2026-07-19T04:00:00.000Z',
      endTime: '2026-07-19T22:00:00.000Z',
    });

    expect(records).toHaveLength(3);
    expect(mockRead).toHaveBeenCalledTimes(3);
    expect(mockRead.mock.calls[1]?.[1]).toMatchObject({ pageToken: 'page-2' });
  });

  it('sends no pageToken on the first call', async () => {
    await readAllRecords('HeartRate', {
      operator: 'between',
      startTime: '2026-07-19T04:00:00.000Z',
      endTime: '2026-07-19T22:00:00.000Z',
    });

    expect(mockRead.mock.calls[0]?.[1]).toMatchObject({ pageToken: undefined });
  });

  /** The cap is a guard against an unbounded loop, and reaching it is reported rather than swallowed. */
  it('stops at the page cap and reports it', async () => {
    mockRead.mockResolvedValue(stepsPage([{ id: 1 }], 'next'));

    const records = await readAllRecords('HeartRate', {
      operator: 'between',
      startTime: '2026-07-19T04:00:00.000Z',
      endTime: '2026-07-19T22:00:00.000Z',
    });

    expect(records).toHaveLength(50);
    expect(Sentry.captureMessage).toHaveBeenCalledWith('health_read_page_cap');
  });
});

describe('reading (tech-03 §4)', () => {
  /**
   * ↯ The filter must be a **UTC instant string**. A local-naive one throws
   * `Text '...' could not be parsed at index 19`; the library does the local conversion itself.
   */
  it('filters on UTC instants', async () => {
    await healthConnectProvider.read(WINDOW, AGE_30, edtDates, BOTH);

    expect(mockAggregate.mock.calls[0]?.[0]).toMatchObject({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: '2026-07-19T04:00:00.000Z',
        endTime: '2026-07-19T22:00:00.000Z',
      },
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    });
  });

  it('reads steps through aggregation, never as raw records', async () => {
    await healthConnectProvider.read(WINDOW, AGE_30, edtDates, BOTH);

    expect(mockAggregate).toHaveBeenCalledTimes(1);
    expect(mockRead).toHaveBeenCalledWith('HeartRate', expect.anything());
  });

  it('assigns each daily bucket to its local date, whichever form the boundary comes back in', async () => {
    mockAggregate.mockResolvedValue([
      { startTime: '2026-07-19T04:00:00.000Z', endTime: '', result: { COUNT_TOTAL: 3000 } },
      { startTime: '2026-07-20T00:00', endTime: '', result: { COUNT_TOTAL: 1200 } },
      { startTime: '2026-07-21T04:00:00.000Z', endTime: '', result: { COUNT_TOTAL: 0 } },
    ] as unknown as Awaited<ReturnType<typeof aggregateGroupByPeriod>>);

    const snapshot = await healthConnectProvider.read(WINDOW, AGE_30, edtDates, BOTH);

    expect([...snapshot.dailySteps]).toEqual([
      ['2026-07-19', 3000],
      ['2026-07-20', 1200],
    ]);
  });

  /** Record grouping is discarded — Fitbit writes one HR record per minute, not one per workout. */
  it('flattens samples across records into one timeline', async () => {
    mockRead.mockResolvedValue(
      stepsPage([
        { samples: [{ time: '2026-07-19T14:00:00.000Z', beatsPerMinute: 100 }] },
        { samples: [{ time: '2026-07-19T14:01:00.000Z', beatsPerMinute: 100 }] },
      ]),
    );

    const snapshot = await healthConnectProvider.read(WINDOW, AGE_30, edtDates, BOTH);

    expect(snapshot.sessions).toHaveLength(1);
    expect(snapshot.sessions[0]?.tier1Minutes).toBe(2);
  });

  /**
   * ↯ A read of an ungranted type **throws**, so a partial grant is handled by not asking. Both of
   * tech-03 §3's one-sided rows are legal states, not errors.
   */
  it('does not read a type that was not granted', async () => {
    await healthConnectProvider.read(WINDOW, AGE_30, edtDates, { steps: true, heartRate: false });

    expect(mockAggregate).toHaveBeenCalled();
    expect(mockRead).not.toHaveBeenCalled();

    jest.clearAllMocks();

    await healthConnectProvider.read(WINDOW, AGE_30, edtDates, { steps: false, heartRate: true });

    expect(mockAggregate).not.toHaveBeenCalled();
    expect(mockRead).toHaveBeenCalled();
  });

  it('still reports the window it consumed when nothing is granted', async () => {
    const snapshot = await healthConnectProvider.read(WINDOW, AGE_30, edtDates, {
      steps: false,
      heartRate: false,
    });

    expect(snapshot).toEqual({
      dailySteps: new Map(),
      sessions: [],
      consumedThrough: WINDOW.endMs,
      // ↯ Reported, not inferred: an empty result from a source that was never read must not later
      // be mistaken for a source that was read and found nothing.
      readSources: { steps: false, heartRate: false },
    });
  });
});

describe('errors, not empty results (tech-03 §3, tech-04 §8.3)', () => {
  const readAndCatch = async (): Promise<HealthError> => {
    try {
      await healthConnectProvider.read(WINDOW, AGE_30, edtDates, BOTH);
    } catch (error) {
      return error as HealthError;
    }

    throw new Error('the read was expected to reject');
  };

  /**
   * ↯ This is the place the web instinct actively misleads: a failed `fetch` resolves and you check
   * `res.ok`, whereas these reject. The spike disproved tech-03's original claim that a read without
   * permission returns empty — it raises `SecurityException` for both record types.
   */
  it('maps a SecurityException to permission_denied', async () => {
    mockAggregate.mockRejectedValue(
      new Error(
        'HealthConnectException: java.lang.SecurityException: Caller requires android.permission.health.READ_STEPS',
      ),
    );

    expect((await readAndCatch()).reason).toBe('permission_denied');
  });

  it('maps an uninitialised client to not_initialized', async () => {
    mockAggregate.mockRejectedValue(new Error('Health Connect client not initialized'));

    expect((await readAndCatch()).reason).toBe('not_initialized');
  });

  it('maps anything else to unknown, keeping the cause', async () => {
    const cause = new Error('the phone fell in a lake');

    mockAggregate.mockRejectedValue(cause);

    const error = await readAndCatch();

    expect(error.reason).toBe('unknown');
    expect(error.cause).toBe(cause);
  });

  it('wraps availability and permission checks too', async () => {
    jest.mocked(getSdkStatus).mockRejectedValue(new Error('boom'));
    mockGranted.mockRejectedValue(new Error('boom'));

    await expect(healthConnectProvider.availability()).rejects.toBeInstanceOf(HealthError);
    await expect(healthConnectProvider.grantedPermissions()).rejects.toBeInstanceOf(HealthError);
  });
});
