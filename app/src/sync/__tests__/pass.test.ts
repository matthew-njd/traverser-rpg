import { parseBundle, readContentVersion } from '../../content/bundle';
import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import { seedEmbeddedContent } from '../../content/store';
import { count, enqueue, peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { readWatermark } from '../../db/watermarks';
import type { MintedDelta } from '../../health/deltas';
import { fixedOffsetDates } from '../../health/localDate';
import { READ_BOTH, pastFirstRead } from '../../health/__tests__/fixtures';
import { HealthError, type HealthSnapshot, type HealthProvider } from '../../health/provider';
import { ApiStatusError, ApiUnreachableError, type TraverserApi } from '../api';
import {
  type AllocationPayload,
  type SyncResponse,
  parseActivityDays,
  parseProfile,
  parseSyncResponse,
} from '../dto';
import { readActivityDays, readPlayer } from '../mirror';
import { type SyncPassResult, runForegroundSync } from '../pass';
import {
  fakeProvider,
  registeredDatabase as freshDatabase,
  wireActivityDay,
  wirePlayer,
  wireProfile,
  wireSyncResponse,
} from './fixtures';

// ↯ The real SDK starts a `setInterval` at module load, which keeps the Jest worker alive and
// reports as a leaked handle.
jest.mock('@sentry/react-native', () => ({ captureMessage: jest.fn() }));

/**
 * tech-04 §8.1 — the ordered foreground pass.
 *
 * The property most of this file is about: stopping after step 9 is a **success** (tech-02 §1.2).
 * A suite testing only the happy path would let someone "fix" that into an error state.
 */

const NOW = Date.parse('2026-08-03T16:00:00Z');
const bundle = parseBundle(EMBEDDED_BUNDLE);
const dates = fixedOffsetDates(-4 * 60);

const walked = (steps: number): HealthSnapshot => ({
  dailySteps: new Map([[dates.dateOf(NOW), steps]]),
  sessions: [],
  consumedThrough: NOW,
  readSources: READ_BOTH,
});

const response = (overrides: Record<string, unknown> = {}): SyncResponse =>
  parseSyncResponse(wireSyncResponse(overrides));

/** An api that echoes back what it was sent, so a test can assert on the wire payload. */
function fakeApi(
  overrides: Partial<TraverserApi> = {},
): TraverserApi & { sent: MintedDelta[][] } {
  const sent: MintedDelta[][] = [];

  return {
    sent,
    contentVersion: async () => 0,
    // Never reached by default: 0 is not newer than the seeded bundle, so step 10b skips it. A
    // test that wants the fetch raises `contentVersion` and overrides this.
    contentBundle: async () => {
      throw new Error('contentBundle() was called for a version that had not moved');
    },
    sync: async (deltas) => {
      sent.push([...deltas]);

      return response({
        accepted_delta_ids: deltas.map((delta) => delta.clientDeltaId),
      });
    },
    profile: async () => parseProfile(wireProfile(), 'response'),
    activity: async () => [],
    allocate: async () => undefined,
    updateSettings: async () => undefined,
    ...overrides,
  };
}

/** A registered device past its first read — the baseline itself has its own describe block. */
const registeredDatabase = (overrides: Record<string, unknown> = {}) => {
  const db = freshDatabase(overrides);

  pastFirstRead(db);

  return db;
};

const run = (
  db: SqliteDatabase,
  overrides: { provider?: HealthProvider; api?: TraverserApi | null } = {},
): Promise<SyncPassResult> =>
  runForegroundSync({
    db,
    provider: overrides.provider ?? fakeProvider({ read: async () => walked(8000) }),
    api: overrides.api === undefined ? fakeApi() : overrides.api,
    dates,
    now: NOW,
  });

describe('the offline pass', () => {
  it('succeeds when the server is unreachable', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      api: fakeApi({
        contentVersion: async () => {
          throw new ApiUnreachableError('no route to host');
        },
      }),
    });

    expect(result.server).toBe('unreachable');
    expect(result.minted).toBe(1);
    // Everything the player earned is durable, and the watermark moved — the pass did its job.
    expect(result.queued).toBe(1);
    expect(readWatermark(db)).toBe(new Date(NOW).toISOString());
  });

  it('shows the projection even with no server', async () => {
    const db = registeredDatabase({ lifetime_steps: 205_000, xp_current: 400 });

    await run(db, {
      api: fakeApi({
        sync: async () => {
          throw new ApiUnreachableError('no route to host');
        },
      }),
    });

    // 8,000 steps = 400 XP at 1 per 20, and the steps land on lifetime immediately.
    expect(readPlayer(db)).toMatchObject({
      xpCurrent: 800,
      lifetimeSteps: 213_000,
      provisional: true,
    });
  });

  /** Never projected in either direction (tech-04 §8.4) — a level-up that un-happens is the worst
   * artefact this design can produce. */
  it('never projects a level-up, however large the day', async () => {
    const db = registeredDatabase({ level: 11, xp_current: 1200, xp_to_next: 1240 });

    const result = await run(db, {
      provider: fakeProvider({ read: async () => walked(200_000) }),
      api: null,
    });

    expect(result.levelUps).toEqual([]);
    expect(readPlayer(db)).toMatchObject({ level: 11, xpCurrent: 1240 });
  });

  it('skips the server entirely before registration', async () => {
    const result = await run(registeredDatabase(), { api: null });

    expect(result.server).toBe('skipped');
    expect(result.contentVersion).toBeNull();
  });

  /** The same ids are resent, because they were persisted with the delta and never regenerated. */
  it('resends the same delta ids on the next pass', async () => {
    const db = registeredDatabase();
    const offline = fakeApi({
      sync: async () => {
        throw new ApiUnreachableError('no route to host');
      },
    });

    await run(db, { api: offline });

    const queued = peek(db, 10).map((entry) => entry.clientOpId);
    const online = fakeApi();

    await run(db, { provider: fakeProvider({ read: async () => walked(8000) }), api: online });

    expect(online.sent[0]?.map((delta) => delta.clientDeltaId)).toEqual(queued);
  });

  it('counts a failed upload as an attempt', async () => {
    const db = registeredDatabase();

    await run(db, {
      api: fakeApi({
        sync: async () => {
          throw new ApiUnreachableError('no route to host');
        },
      }),
    });

    expect(peek(db, 10)[0]?.attempts).toBe(1);
  });
});

describe('the online pass', () => {
  it('applies the response and drains the queue', async () => {
    const db = registeredDatabase();
    const api = fakeApi();

    const result = await run(db, { api });

    expect(result.server).toBe('synced');
    expect(result.queued).toBe(0);
    expect(count(db)).toBe(0);
  });

  /** The server's numbers replace the projection outright — never added, never reconciled. */
  it('replaces the projection with the server values', async () => {
    const db = registeredDatabase({ lifetime_steps: 205_000 });

    await run(db, {
      api: fakeApi({
        sync: async (deltas) =>
          response({
            player: wirePlayer({ lifetime_steps: 213_000, xp_current: 795 }),
            accepted_delta_ids: deltas.map((delta) => delta.clientDeltaId),
          }),
      }),
    });

    // 795, not the projected 800 and not 800 + 795. The correction is silent by design.
    expect(readPlayer(db)).toMatchObject({
      xpCurrent: 795,
      lifetimeSteps: 213_000,
      provisional: false,
    });
  });

  it('surfaces level-ups from the response and nowhere else', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      api: fakeApi({
        sync: async () => response({ level_ups: [{ level: 12, stat_points_awarded: 3 }] }),
      }),
    });

    expect(result.levelUps).toEqual([{ level: 12, statPointsAwarded: 3 }]);
  });

  it('reports a rejected sync without losing the queue', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      api: fakeApi({
        sync: async () => {
          throw new ApiStatusError(400, 'validation_failed', 'bad request');
        },
      }),
    });

    expect(result.server).toBe('rejected');
    expect(count(db)).toBe(1);
  });

  /**
   * One table for every kind (tech-04 §6.2), but they do not share an endpoint. The older entry
   * sorts first under FIFO, so a mixed batch is exactly what a naive drain reaches for.
   */
  it('sends each write kind to its own endpoint, never a mixed batch to /sync', async () => {
    const db = registeredDatabase();

    enqueue(db, {
      clientOpId: 'allocation-1',
      kind: 'allocation',
      payload: { operationId: 'allocation-1', might: 3 },
      // Older than anything this pass mints, so FIFO puts it at the head of the queue.
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const allocated: AllocationPayload[] = [];
    const api = fakeApi({
      allocate: async (payload) => {
        allocated.push(payload);
      },
    });

    await run(db, { api });

    expect(api.sent[0]?.map((delta) => delta.clientDeltaId)).not.toContain('allocation-1');
    expect(allocated.map((payload) => payload.operationId)).toEqual(['allocation-1']);
    expect(count(db)).toBe(0);
  });

  /**
   * Writes replay before the sync: step 12 overwrites the mirror with the response's player
   * block, so replaying after it was computed reverts the points the player just spent.
   */
  it('replays a queued allocation before posting the sync', async () => {
    const db = registeredDatabase();
    const order: string[] = [];

    enqueue(db, {
      clientOpId: 'allocation-1',
      kind: 'allocation',
      payload: { operationId: 'allocation-1', might: 3 },
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    await run(db, {
      api: fakeApi({
        allocate: async () => {
          order.push('allocate');
        },
        sync: async () => {
          order.push('sync');

          return response();
        },
      }),
    });

    expect(order).toEqual(['allocate', 'sync']);
  });

  /**
   * The one place an entry is dropped without the server naming it: a 4xx cannot succeed on retry
   * and would block everything behind it. 5xx and unreachable stay queued.
   */
  it('drops a write the server refuses, and keeps one it merely failed to answer', async () => {
    const rejected = registeredDatabase();

    enqueue(rejected, {
      clientOpId: 'allocation-1',
      kind: 'allocation',
      payload: { operationId: 'allocation-1', might: 3 },
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    await run(rejected, {
      api: fakeApi({
        allocate: async () => {
          throw new ApiStatusError(422, 'insufficient_stat_points', 'no');
        },
      }),
    });

    expect(count(rejected)).toBe(0);

    const unanswered = registeredDatabase();

    enqueue(unanswered, {
      clientOpId: 'allocation-2',
      kind: 'allocation',
      payload: { operationId: 'allocation-2', might: 3 },
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const result = await run(unanswered, {
      api: fakeApi({
        allocate: async () => {
          throw new ApiStatusError(503, null, 'unavailable');
        },
      }),
    });

    expect(result.server).toBe('rejected');
    expect(peek(unanswered, 10).map((entry) => entry.clientOpId)).toContain('allocation-2');
  });

  it('reports content the build does not hold', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      api: fakeApi({ sync: async () => response({ content_version: 7 }) }),
    });

    expect(result.contentVersion).toBe(7);
    expect(result.contentStale).toBe(true);
  });

  /**
   * Step 10b (tech-02 §3). The database these tests migrate holds no bundle, so anything above 0 is
   * newer — which is also the state of a device whose boot seeding has not run.
   */
  it('fetches the bundle when the version moved, and adopts it', async () => {
    const db = registeredDatabase();

    await run(db, {
      api: fakeApi({
        contentVersion: async () => bundle.contentVersion,
        contentBundle: async () => bundle,
      }),
    });

    expect(readContentVersion(db)).toBe(bundle.contentVersion);
  });

  it('does not fetch the bundle when the version has not moved', async () => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);

    // fakeApi's contentBundle throws if it is called at all, so reaching 'synced' is the assertion.
    const result = await run(db, {
      api: fakeApi({ contentVersion: async () => bundle.contentVersion }),
    });

    expect(result.server).toBe('synced');
  });

  /**
   * Step 12a. Found on the device after a restore: the profile came back and the activity log was
   * empty, because `GET /players/me` carries no days and a sync response reports only the days it
   * touched. A mirror with steps but no days did not live through them — it inherited them.
   */
  it('repairs a mirror that has steps but no history', async () => {
    const db = registeredDatabase({ lifetime_steps: 86_883 });

    const result = await run(db, {
      provider: fakeProvider({ read: async () => walked(0) }),
      api: fakeApi({
        activity: async () => [
          parseActivityDays([wireActivityDay({ activity_date: '2026-08-01', steps: 8_800 })])[0]!,
        ],
      }),
    });

    expect(result.server).toBe('synced');
    expect(readActivityDays(db, 90).map((day) => day.activityDate)).toEqual(['2026-08-01']);
  });

  /** Bounded: a healthy mirror must not refetch a year of history on every foreground. */
  it('does not refetch history once the log is populated', async () => {
    const db = registeredDatabase({ lifetime_steps: 86_883 });
    let calls = 0;

    const api = fakeApi({
      activity: async () => {
        calls += 1;

        return [
          parseActivityDays([wireActivityDay({ activity_date: '2026-08-01', steps: 8_800 })])[0]!,
        ];
      },
    });

    await run(db, { provider: fakeProvider({ read: async () => walked(0) }), api });
    await run(db, { provider: fakeProvider({ read: async () => walked(0) }), api });

    expect(calls).toBe(1);
  });

  /** A bundle that will not download is a playable app on yesterday's content, not a failed sync. */
  it('syncs anyway when the bundle fetch fails', async () => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);

    const result = await run(db, {
      api: fakeApi({
        contentVersion: async () => bundle.contentVersion + 1,
        contentBundle: async () => {
          throw new ApiUnreachableError('dropped mid-download');
        },
      }),
    });

    expect(result.server).toBe('synced');
    expect(readContentVersion(db)).toBe(bundle.contentVersion);
  });

  it('still syncs when there is nothing to send, which is how a fresh install gets its numbers', async () => {
    const db = registeredDatabase();
    const api = fakeApi();

    const result = await run(db, {
      provider: fakeProvider({ read: async () => walked(0) }),
      api,
    });

    expect(api.sent[0]).toEqual([]);
    expect(result.server).toBe('synced');
  });
});

describe('health states (tech-03 §3)', () => {
  it('reads nothing and syncs anyway when both permissions are denied', async () => {
    const db = registeredDatabase();
    const read = jest.fn();

    const result = await run(db, {
      provider: fakeProvider({
        grantedPermissions: async () => ({ steps: false, heartRate: false }),
        read,
      }),
    });

    expect(read).not.toHaveBeenCalled();
    expect(result.health.permissions).toEqual({ steps: false, heartRate: false });
    expect(result.server).toBe('synced');
  });

  it('reads steps alone on a partial grant', async () => {
    const read = jest.fn<ReturnType<HealthProvider['read']>, Parameters<HealthProvider['read']>>(
      async () => walked(8000),
    );

    await run(registeredDatabase(), {
      provider: fakeProvider({
        grantedPermissions: async () => ({ steps: true, heartRate: false }),
        read,
      }),
    });

    expect(read.mock.calls[0]?.[3]).toEqual({ steps: true, heartRate: false });
  });

  /** Distinct from a denial and fixable: no birth year means no `HRmax`, so nothing is charged. */
  it('does not read heart rate without a birth year', async () => {
    const db = registeredDatabase();

    db.runSync('UPDATE player_settings SET birth_year = NULL', []);

    const read = jest.fn<ReturnType<HealthProvider['read']>, Parameters<HealthProvider['read']>>(
      async () => walked(8000),
    );
    const result = await run(db, { provider: fakeProvider({ read }) });

    expect(result.health.ageMissing).toBe(true);
    expect(read.mock.calls[0]?.[3]).toEqual({ steps: true, heartRate: false });
  });

  it('stops at availability when the platform is too old', async () => {
    const initialize = jest.fn();

    const result = await run(registeredDatabase(), {
      provider: fakeProvider({ availability: async () => 'update_required', initialize }),
    });

    expect(result.health.availability).toBe('update_required');
    expect(initialize).not.toHaveBeenCalled();
  });

  /**
   * A health failure is banner state, not a failed pass — the outbox may hold deltas an earlier
   * pass minted, and refusing to try strands them behind a revoked permission.
   */
  it('surfaces a read failure and still runs the sync', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      provider: fakeProvider({
        read: async () => {
          throw new HealthError('permission_denied', 'SecurityException');
        },
      }),
    });

    expect(result.health.error).toBe('permission_denied');
    expect(result.minted).toBe(0);
    expect(result.server).toBe('synced');
  });

  /** Per-process, not per-install: a permission change in settings restarts the app process. */
  it('checks availability, initializes and re-reads permissions on every pass', async () => {
    const availability = jest.fn(async () => 'available' as const);
    const initialize = jest.fn();
    const grantedPermissions = jest.fn(async () => ({ steps: true, heartRate: true }));
    const provider = fakeProvider({ availability, initialize, grantedPermissions });
    const db = registeredDatabase();

    await run(db, { provider });
    await run(db, { provider });

    expect(availability).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(grantedPermissions).toHaveBeenCalledTimes(2);
  });
});
