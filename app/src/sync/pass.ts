import * as Sentry from '@sentry/react-native';

import { acknowledge, peek, recordAttempt } from '../db/outbox';
import { readWatermark } from '../db/watermarks';
import type { SqliteDatabase } from '../db/types';
import { type MintedDelta, commitHealthRead } from '../health/deltas';
import { ageFromBirthYear, thresholdsForAge } from '../health/derive';
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
import type { AllocationPayload, SettingsPayload } from './dto';
import { type LevelUp, WireFormatError } from './dto';
import { applySyncResponse, readBirthYear, readPlayer, writeProjection } from './mirror';
import { projectGains, projectState } from './projection';

/**
 * tech-04 §8.1 — the ordered foreground pass, steps 1–13.
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
 * ↯ **Steps 10–13 are best-effort, and stopping after step 9 is a *success*.** tech-02 §1.2 makes an
 * unreachable server the normal case: the API is in Docker on a PC that is off between sessions, by
 * design. When it is off the deltas are durably queued, the watermark has advanced, the projection is
 * on screen and the player sees their steps. Treating that as a failed sync would put an error state
 * in front of the player for the app working exactly as specified.
 *
 * ↯ Sync fires **only** on app open and foreground (T3 §1.5, T4 §7.2). Nothing here is scheduled,
 * nothing polls, and nothing assumes it can run while backgrounded.
 */

/**
 * M1 ships no content bundle — plan decision §3.2 defers it to M2 — so the client holds no content
 * and says so. The server records this and does not enforce it; `content_version_stale` becomes
 * reachable when the bundle does.
 */
export const CLIENT_CONTENT_VERSION = 0;

/** tech-02 §5's queue cap. One batch: a partial upload is never partially reconciled. */
export const MAX_BATCH = 5_000;

export interface HealthPassResult {
  readonly availability: SdkAvailability;
  /** What Health Connect reports as granted — the authority, re-read every pass. */
  readonly permissions: HealthPermissions;
  /**
   * Heart rate is granted but no birth year has been collected, so `HRmax` cannot be derived and HR
   * was not read at all (tech-03 §1.4). A distinct state from a denied permission, and a fixable one.
   */
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
  /** Entries still queued when the pass ended. Zero after a clean sync. */
  readonly queued: number;
  readonly server: ServerOutcome;
  readonly contentVersion: number | null;
  /** The server's content moved past what this build holds. M2 acts on it; M1 reports it. */
  readonly contentStale: boolean;
  /** ↯ The only source of a level-up. Never projected (§8.4). */
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

/** Steps 2–8. Every platform call is wrapped: these reject, they do not resolve empty (§8.3). */
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

    // What is actually read, as opposed to what is granted. A read of an ungranted type throws, and
    // HR without an age would be minutes scored against thresholds nobody chose.
    const reading: HealthPermissions = {
      steps: permissions.steps,
      heartRate: permissions.heartRate && birthYear !== null,
    };

    if (!reading.steps && !reading.heartRate) {
      return { health: { availability, permissions, ageMissing, error: null }, minted: [] };
    }

    // Age 0 is unreachable: `reading.heartRate` is false whenever `birthYear` is null, and the
    // thresholds are consulted only on the HR path.
    const thresholds = thresholdsForAge(
      birthYear === null ? 0 : ageFromBirthYear(birthYear, now, dates),
    );
    const window = readWindowFor(readWatermark(db), now, dates);
    const snapshot = await provider.read(window, thresholds, dates, reading);

    // Steps 6–8. `commitHealthRead` is the transaction boundary: queue, then marks, then watermark.
    const { deltas } = commitHealthRead(db, snapshot, dates, now);

    return { health: { availability, permissions, ageMissing, error: null }, minted: deltas };
  } catch (error) {
    // ↯ A health failure does not fail the pass. It becomes banner state and the sync continues —
    // the outbox may well hold deltas from an earlier pass that this one can still deliver.
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
    // Nothing registered yet, so there is no row to project onto. The deltas are still queued.
    return;
  }

  // Written to SQLite, never only to the store — tech-04 §5.2: the store is a cache of a cache and
  // may be stale in one direction only.
  writeProjection(db, projectState(current, gains));
}

/**
 * Replays the queued progression writes, oldest first, and drops each once the server has taken it.
 *
 * ↯ The retry policy, which is the only place in this app where an entry is dropped without the
 * server naming it in `accepted`/`duplicate`: a **4xx is terminal** for that entry, a 5xx or an
 * unreachable host is retryable. A rejected write that stayed queued would be retried on every
 * foreground forever and block everything behind it — and it cannot succeed, because the server has
 * already stated an opinion about it (`insufficient_stat_points` after the mirror drifted, say,
 * which step 12's authoritative snapshot is about to correct anyway). Reported to Sentry rather
 * than swallowed, because a write the player made and the server refused is worth knowing about.
 */
async function replayWrites(db: SqliteDatabase, api: TraverserApi): Promise<void> {
  const queued = [
    ...peek(db, MAX_BATCH, 'allocation'),
    ...peek(db, MAX_BATCH, 'settings'),
  ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.clientOpId.localeCompare(b.clientOpId));

  for (const entry of queued) {
    try {
      if (entry.kind === 'allocation') {
        await api.allocate(JSON.parse(entry.payload) as AllocationPayload);
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

export async function runForegroundSync(deps: SyncPassDeps): Promise<SyncPassResult> {
  const { db, api } = deps;

  const { health, minted } = await consumeHealth(deps);

  project(db, minted);

  const queuedNow = () => peek(db, MAX_BATCH).length;

  const stopped = (server: ServerOutcome, contentVersion: number | null = null): SyncPassResult => ({
    health,
    minted: minted.length,
    queued: queuedNow(),
    server,
    contentVersion,
    contentStale: contentVersion !== null && contentVersion !== CLIENT_CONTENT_VERSION,
    levelUps: [],
  });

  if (api === null) {
    return stopped('skipped');
  }

  let contentVersion: number | null = null;
  const pending = peek(db, MAX_BATCH, 'sync_delta');

  try {
    // ---- Step 10 ----
    contentVersion = await api.contentVersion();

    // ---- Step 10a. Progression writes replay *before* the sync, not after.
    //
    // ↯ Order matters and the reason is not obvious. tech-02 §3's `•` endpoints apply optimistically
    // to the mirror and replay to the server; step 12 then overwrites the mirror with the response's
    // authoritative player block. Replaying an allocation *after* that block was computed means the
    // response does not contain it — so the mirror is rewritten without the points the player just
    // spent, and the allocation visibly reverts on screen until the next sync. Same for a step goal.
    await replayWrites(db, api);

    // ---- Step 11. The whole queue in one batch: tech-02 §5 requires it to drain completely before
    // the response is applied, so a partial upload is never partially reconciled.
    const response = await api.sync(
      pending.map((entry) => JSON.parse(entry.payload) as MintedDelta),
      CLIENT_CONTENT_VERSION,
    );

    // ---- Step 12 ----
    applySyncResponse(db, response);

    // ---- Step 13 ----
    return {
      health,
      minted: minted.length,
      queued: queuedNow(),
      server: 'synced',
      contentVersion: response.contentVersion,
      contentStale: response.contentVersion !== CLIENT_CONTENT_VERSION,
      levelUps: response.levelUps,
    };
  } catch (error) {
    recordAttempt(
      db,
      pending.map((entry) => entry.clientOpId),
    );

    if (error instanceof ApiUnreachableError) {
      return stopped('unreachable', contentVersion);
    }

    if (error instanceof ApiStatusError || error instanceof WireFormatError) {
      return stopped('rejected', contentVersion);
    }

    throw error;
  }
}
