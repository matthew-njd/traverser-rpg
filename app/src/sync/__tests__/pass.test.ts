import { count, enqueue, peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { readWatermark } from '../../db/watermarks';
import type { MintedDelta } from '../../health/deltas';
import { fixedOffsetDates } from '../../health/localDate';
import { HealthError, type HealthSnapshot, type HealthProvider } from '../../health/provider';
import { ApiStatusError, ApiUnreachableError, type TraverserApi } from '../api';
import { type SyncResponse, parseSyncResponse } from '../dto';
import { readPlayer } from '../mirror';
import { type SyncPassResult, runForegroundSync } from '../pass';
import { fakeProvider, registeredDatabase, wirePlayer, wireSyncResponse } from './fixtures';

/**
 * tech-04 §8.1 — the ordered foreground pass.
 *
 * ↯ The property most of this file is about: **stopping after step 9 is a success.** tech-02 §1.2
 * makes an unreachable server the normal case — the API is in Docker on a PC that is off between
 * sessions, by design — so a pass that queues the deltas, advances the watermark and shows the
 * projection has done its whole job. A suite that only tested the happy path would let someone
 * "fix" that into an error state and never notice.
 */

const NOW = Date.parse('2026-08-03T16:00:00Z');
const dates = fixedOffsetDates(-4 * 60);

const walked = (steps: number): HealthSnapshot => ({
  dailySteps: new Map([[dates.dateOf(NOW), steps]]),
  sessions: [],
  consumedThrough: NOW,
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
    sync: async (deltas) => {
      sent.push([...deltas]);

      return response({
        accepted_delta_ids: deltas.map((delta) => delta.clientDeltaId),
      });
    },
    ...overrides,
  };
}

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

  /**
   * ↯ Never projected, in either direction (tech-04 §8.4). A Reveal Card for a level-up that then
   * un-happens is the worst artefact this design can produce, so the level in the mirror after an
   * offline pass is the one the server last reported.
   */
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

  /** ↯ The same ids are resent, because they were persisted with the delta and never regenerated. */
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

  /** ↯ The server's numbers replace the projection outright — never added, never reconciled. */
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
   * ↯ The outbox is deliberately one table for every write kind (tech-04 §6.2) — same durability,
   * same ordering, same retry rules — but they do **not** share an endpoint. `/sync` accepts deltas
   * and nothing else, so the drain reads one kind at a time. A mixed batch would be sent to a
   * server that understands part of it, and the older entry sorts *first* under FIFO, so this is
   * the entry a naive drain reaches for. The progression writes arrive with the screens at P8; this
   * test is what stops them being swept into the wrong request when they do.
   */
  it('sends only sync_delta entries, leaving other write kinds queued', async () => {
    const db = registeredDatabase();

    enqueue(db, {
      clientOpId: 'allocation-1',
      kind: 'allocation',
      payload: { operationId: 'allocation-1', might: 3 },
      // Older than anything this pass mints, so FIFO puts it at the head of the queue.
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    const api = fakeApi();

    await run(db, { api });

    expect(api.sent[0]?.map((delta) => delta.clientDeltaId)).not.toContain('allocation-1');
    expect(peek(db, 10).map((entry) => entry.clientOpId)).toEqual(['allocation-1']);
  });

  it('reports content the build does not hold', async () => {
    const db = registeredDatabase();

    const result = await run(db, {
      api: fakeApi({ sync: async () => response({ content_version: 7 }) }),
    });

    expect(result.contentVersion).toBe(7);
    expect(result.contentStale).toBe(true);
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

  /**
   * ↯ A distinct state from a denied permission, and a fixable one. Without a birth year there is no
   * `HRmax`, so tier minutes are not charged at all rather than scored against an assumed age
   * (tech-03 §1.4) — a wrong age would silently misclassify every workout.
   */
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
   * ↯ A health failure is banner state, not a failed pass. The outbox may hold deltas from an
   * earlier pass that this one can still deliver, and refusing to try would strand them behind a
   * permission the player revoked.
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

  /** ↯ Per-process, not per-install: a permission change in settings restarts the app process. */
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
