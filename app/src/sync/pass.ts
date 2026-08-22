import * as Sentry from '@sentry/react-native';

import { type SettledBattle, toWireBattle } from '../battle/settle';
import { readContentVersion } from '../content/bundle';
import { adoptBundle } from '../content/store';
import { acknowledge, peek, recordAttempt } from '../db/outbox';
import { readWatermark } from '../db/watermarks';
import type { SqliteDatabase } from '../db/types';
import { type MintedDelta, commitHealthRead } from '../health/deltas';
import { ageFromBirthYear, thresholdsForAge } from '../health/derive';
import { applyVigorRecovery } from '../progression/vigor';
import type { LocalDateResolver } from '../health/localDate';
import {
  HealthError,
  type HealthErrorReason,
  type HealthPermissions,
  type HealthProvider,
  NO_PERMISSIONS,
  type SdkAvailability,
  readWindowFor,
} from '../health/provider';
import { ApiStatusError, ApiUnreachableError, type TraverserApi } from './api';
import { backfillActivity, needsHistoryRepair } from './history';
import type { AllocationPayload, RestDayPayload, SettingsPayload } from './dto';
import { type LevelUp, WireFormatError } from './dto';
import {
  applySyncResponse,
  readBirthYear,
  readPlayer,
  writeInventory,
  writeProjection,
} from './mirror';
import { projectGains, projectState } from './projection';

/**
 * tech-04 §8.1 — the ordered foreground pass.
 *
 * ```
 *  1. AppState → 'active' (or cold start)      ── the caller's trigger, never a timer
 *  2. getSdkStatus()                           ── every time
 *  3. initialize()                             ── every time; per-process, not per-install
 *  4. getGrantedPermissions()                  ── authority, matched by exact recordType
 *  5. read [max(watermark, now−72h), now]      T3 §4.1
 *  6. derive: bucket → tier → segment          T3 §5
 *  7. mint deltas against the watermarks       T3 §8
 *  8. ── TRANSACTION ── queue + marks + watermark ── COMMIT ──
 *  9. optimistic projection → UI               §8.4
 * 10. GET /content/version
 * 11. POST /sync with the drained outbox
 * 12. ── TRANSACTION ── apply response, drop drained rows ── COMMIT ──
 * 13. render level-ups, banners
 * ```
 *
 * Steps 10–13 are best-effort and **stopping after step 9 is a success** — tech-02 §1.2 makes an
 * unreachable server the normal case. Surfacing an error there would fault the app for working.
 *
 * Fires only on app open and foreground (T3 §1.5, T4 §7.2). Nothing polls or runs backgrounded.
 */

/**
 * What the client reports when it holds no bundle at all. Unreachable in practice — boot seeds the
 * embedded copy (T4 §5.1) — but the sync payload needs a number, and 0 is older than any real seed,
 * so a device in that state asks for content rather than claiming to be current.
 */
export const NO_CONTENT_VERSION = 0;

/** tech-02 §5's queue cap. One batch: a partial upload is never partially reconciled. */
export const MAX_BATCH = 5_000;

export interface HealthPassResult {
  readonly availability: SdkAvailability;
  readonly permissions: HealthPermissions;
  /** HR granted but no birth year, so `HRmax` is underivable and HR was not read (tech-03 §1.4). */
  readonly ageMissing: boolean;
  readonly error: HealthErrorReason | null;
}

export type ServerOutcome =
  /** Response applied to the mirror. */
  | 'synced'
  /** No response. The normal case, not the error case. */
  | 'unreachable'
  /** The server answered and refused, or answered something unreadable. */
  | 'rejected'
  /** No identity yet — the device has not registered. */
  | 'skipped';

export interface SyncPassResult {
  readonly health: HealthPassResult;
  /** Deltas minted by *this* pass. Not the queue depth. */
  readonly minted: number;
  readonly queued: number;
  readonly server: ServerOutcome;
  readonly contentVersion: number | null;
  readonly contentStale: boolean;
  /** The only source of a level-up. Never projected (§8.4). */
  readonly levelUps: readonly LevelUp[];
}

export interface SyncPassDeps {
  readonly db: SqliteDatabase;
  readonly provider: HealthProvider;
  /** Null before the device has registered, which makes steps 10–13 `skipped`. */
  readonly api: TraverserApi | null;
  readonly dates: LocalDateResolver;
  readonly now: number;
}

/** Steps 2–8. Platform calls reject rather than resolving empty (§8.3), so all are wrapped. */
async function consumeHealth(
  deps: SyncPassDeps,
): Promise<{ health: HealthPassResult; minted: readonly MintedDelta[] }> {
  const { db, provider, dates, now } = deps;

  let availability: SdkAvailability = 'unavailable';
  let permissions: HealthPermissions = NO_PERMISSIONS;
  let ageMissing = false;

  try {
    availability = await provider.availability();

    if (availability !== 'available') {
      return { health: { availability, permissions, ageMissing, error: null }, minted: [] };
    }

    await provider.initialize();
    permissions = await provider.grantedPermissions();

    const birthYear = readBirthYear(db);

    ageMissing = permissions.heartRate && birthYear === null;

    // What is read, not what is granted: reading an ungranted type throws, and HR without an age
    // would be minutes scored against thresholds nobody chose.
    const reading: HealthPermissions = {
      steps: permissions.steps,
      heartRate: permissions.heartRate && birthYear !== null,
    };

    if (!reading.steps && !reading.heartRate) {
      return { health: { availability, permissions, ageMissing, error: null }, minted: [] };
    }

    // Age 0 is unreachable: `reading.heartRate` is false whenever `birthYear` is null.
    const thresholds = thresholdsForAge(
      birthYear === null ? 0 : ageFromBirthYear(birthYear, now, dates),
    );
    const window = readWindowFor(readWatermark(db), now, dates);
    const snapshot = await provider.read(window, thresholds, dates, reading);

    // Steps 6–8. `commitHealthRead` is the transaction boundary: queue, then marks, then watermark.
    const { deltas } = commitHealthRead(db, snapshot, dates, now);

    return { health: { availability, permissions, ageMissing, error: null }, minted: deltas };
  } catch (error) {
    // A health failure does not fail the pass — it becomes banner state and the sync continues,
    // because the outbox may hold deltas from an earlier pass that this one can still deliver.
    return {
      health: {
        availability,
        permissions,
        ageMissing,
        error: error instanceof HealthError ? error.reason : 'unknown',
      },
      minted: [],
    };
  }
}

/** Step 9. */
function project(db: SqliteDatabase, minted: readonly MintedDelta[]): void {
  const gains = projectGains(minted);

  if (gains.steps === 0 && gains.xp === 0) {
    return;
  }

  const current = readPlayer(db);

  if (current === null) {
    return;
  }

  // SQLite, never only the store — tech-04 §5.2 makes the store a cache of a cache.
  writeProjection(db, projectState(current, gains));
}

/**
 * Replay queued progression writes, oldest first, dropping each once the server takes it.
 *
 * A **4xx is terminal** for an entry; 5xx and unreachable stay queued. This is the only place a
 * write is dropped without the server naming it — left queued it would retry forever and block
 * everything behind it, and it cannot succeed because the server has already ruled on it.
 */
async function replayWrites(db: SqliteDatabase, api: TraverserApi): Promise<void> {
  const queued = [
    ...peek(db, MAX_BATCH, 'allocation'),
    ...peek(db, MAX_BATCH, 'settings'),
    ...peek(db, MAX_BATCH, 'rest_day'),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientOpId.localeCompare(b.clientOpId));

  for (const entry of queued) {
    try {
      if (entry.kind === 'allocation') {
        await api.allocate(JSON.parse(entry.payload) as AllocationPayload);
      } else if (entry.kind === 'rest_day') {
        await api.tagRestDay(JSON.parse(entry.payload) as RestDayPayload);
      } else {
        await api.updateSettings(JSON.parse(entry.payload) as SettingsPayload);
      }

      acknowledge(db, [entry.clientOpId]);
    } catch (error) {
      if (error instanceof ApiStatusError && error.status >= 400 && error.status < 500) {
        Sentry.captureMessage(`write_rejected:${entry.kind}:${error.code ?? error.status}`);
        acknowledge(db, [entry.clientOpId]);
        continue;
      }

      recordAttempt(db, [entry.clientOpId]);
      throw error;
    }
  }
}

/**
 * Steps 1–13, plus GDD 2 §6's recovery on the way out.
 *
 * Recovery settles **after** step 12 and on the offline paths alike: the response's player block
 * carries the authoritative Vigor and its anchor, so recovering before it would be overwritten, and
 * a pass that never reached the server still has an anchor worth reading.
 */
export async function runForegroundSync(deps: SyncPassDeps): Promise<SyncPassResult> {
  const result = await runPass(deps);

  applyVigorRecovery(deps.db, deps.now, deps.dates);

  return result;
}

async function runPass(deps: SyncPassDeps): Promise<SyncPassResult> {
  const { db, api } = deps;

  const { health, minted } = await consumeHealth(deps);

  project(db, minted);

  const queuedNow = () => peek(db, MAX_BATCH).length;
  const heldVersion = () => readContentVersion(db) ?? NO_CONTENT_VERSION;

  const stopped = (server: ServerOutcome, contentVersion: number | null = null): SyncPassResult => ({
    health,
    minted: minted.length,
    queued: queuedNow(),
    server,
    contentVersion,
    contentStale: contentVersion !== null && contentVersion > heldVersion(),
    levelUps: [],
  });

  if (api === null) {
    return stopped('skipped');
  }

  let contentVersion: number | null = null;
  const pending = peek(db, MAX_BATCH, 'sync_delta');

  // Settled battles ride the same transaction as the deltas (T2 §7). They are acknowledged by their
  // own `client_battle_id`, which is also the outbox key, so a replay drops them the same way.
  const pendingBattles = peek(db, MAX_BATCH, 'battle');

  try {
    // ---- Step 10 ----
    contentVersion = await api.contentVersion();

    // ---- Step 10b. Fetch the bundle only when the server's number moved past ours (tech-02 §3).
    //
    // Adopting it before the sync below, so the payload reports the version the device now holds
    // rather than the one it arrived with — and so a battle resolved later in this foreground is
    // resolved against current content.
    //
    // Failure here does not fail the pass: the previous bundle is still stored and still playable,
    // and the fetch retries on the next foreground. Only an unreadable *payload* is worth reporting,
    // because that one will not fix itself.
    if (contentVersion > heldVersion()) {
      try {
        adoptBundle(db, await api.contentBundle());
      } catch (error) {
        if (error instanceof WireFormatError) {
          Sentry.captureException(error);
        }
      }
    }

    // ---- Step 10a. Writes replay *before* the sync.
    //
    // Step 12 overwrites the mirror with the response's authoritative player block, so replaying
    // an allocation after that block was computed rewrites the mirror without the points just spent
    // and the allocation visibly reverts until the next pass.
    await replayWrites(db, api);

    // ---- Step 11. The whole queue in one batch (tech-02 §5).
    const response = await api.sync(
      pending.map((entry) => JSON.parse(entry.payload) as MintedDelta),
      heldVersion(),
      pendingBattles.map((entry) => toWireBattle(JSON.parse(entry.payload) as SettledBattle)),
    );

    // ---- Step 12 ----
    applySyncResponse(db, response);

    // A battle the server took is done with locally. Acknowledged unconditionally on a 2xx rather
    // than from a returned list: step 2 answers a replayed battle exactly as it answers a new one,
    // and the id is already the idempotency key on both sides.
    acknowledge(db, pendingBattles.map((entry) => entry.clientOpId));

    // ---- Step 12b. Reconcile the satchel and the gear rack after a battle reaches the server.
    //
    // The sync response carries no inventory, so the only authoritative list is the profile
    // document (T2 §3). This is the missing **call site** DECISIONS 2026-08-22 identified —
    // `writeInventory` was already written and correct, and reachable only from registration and a
    // restore, so every drop widened a silent drift.
    //
    // Only after a pass that actually uploaded battles: the fetch is a whole extra round trip, and
    // nothing else on this surface can change what the player owns.
    //
    // ↯ **The acknowledgement above is what makes this safe.** `writeInventory` *replaces* both
    // lists, so running it while a settled battle is still queued would delete the local rows that
    // battle granted and they would not come back until it uploaded.
    if (pendingBattles.length > 0 && peek(db, 1, 'battle').length === 0) {
      writeInventory(db, await api.profile());
    }

    // ---- Step 12a. Repair a mirror that is missing its history.
    //
    // A sync response reports only the days it touched, so a device that has walked but holds no
    // activity days at all did not build this mirror by living through them — it inherited it from
    // a restore. Bounded by construction: false once the log is populated, and false for a device
    // that has simply never synced.
    if (needsHistoryRepair(db)) {
      await backfillActivity(db, api, response.player.playerId);
    }

    // ---- Step 13 ----
    return {
      health,
      minted: minted.length,
      queued: queuedNow(),
      server: 'synced',
      contentVersion: response.contentVersion,
      contentStale: response.contentVersion > heldVersion(),
      levelUps: response.levelUps,
    };
  } catch (error) {
    recordAttempt(db, [
      ...pending.map((entry) => entry.clientOpId),
      ...pendingBattles.map((entry) => entry.clientOpId),
    ]);

    if (error instanceof ApiUnreachableError) {
      return stopped('unreachable', contentVersion);
    }

    if (error instanceof ApiStatusError || error instanceof WireFormatError) {
      return stopped('rejected', contentVersion);
    }

    throw error;
  }
}
