import { seedEmbeddedContent } from './content/store';
import { getDatabase, openTraverserDatabase } from './db/open';
import { type DeviceIdentity, loadIdentity } from './db/secureToken';
import type { SqliteDatabase } from './db/types';
import { bannerFor } from './health/banner';
import { healthConnectProvider } from './health/healthconnect';
import { deviceLocalDates } from './health/localDate';
import { apiBaseUrl } from './env';
import { type TraverserApi, createApi } from './sync/api';
import { coalescePasses, retryDelay } from './sync/coalesce';
import { type SyncPassResult, runForegroundSync } from './sync/pass';
import { useAppStore } from './state/appStore';
import { useBattleStore } from './state/battleStore';
import { usePlayerStore } from './state/playerStore';

/**
 * The composition root: the one place that wires the database, the health provider, the API client
 * and the stores together. Routes call into here; nothing in `app/` constructs a dependency.
 *
 * tech-04 §13 keeps `app/` to routes and no logic. Singletons rather than a provider tree: the
 * database and the identity are process-scoped anyway, and a context adds a way for them to be missing.
 */

let identity: DeviceIdentity | null = null;

/**
 * tech-04 §7.1 steps 2–4. Touches the network and the health provider zero times — the player must
 * never wait eight seconds on a PC that is off.
 */
export async function bootRuntime(): Promise<SqliteDatabase> {
  const db = openTraverserDatabase();

  // Before the stores hydrate and before any screen mounts: content is what a battle screen reads,
  // and "playable having never fetched it" (T4 §5.1) means it must already be there on first paint.
  seedEmbeddedContent(db);

  identity = await loadIdentity();

  usePlayerStore.getState().hydrate(db);

  // T5 §8 — a cold start with an unresolved snapshot re-enters the fight. Before `markBooted`, so
  // the boot router's first render already knows and cannot flash the hub on the way to the battle.
  useBattleStore.getState().resume(db);

  useAppStore.getState().markBooted(identity !== null);

  return db;
}

/** Re-reads the credential and the mirror after registration or a restore. */
export async function refreshIdentity(): Promise<void> {
  identity = await loadIdentity();

  usePlayerStore.getState().hydrate(getDatabase());
  useAppStore.getState().setRegistered(identity !== null);
}

export function currentIdentity(): DeviceIdentity | null {
  return identity;
}

function apiClient(): TraverserApi | null {
  return identity === null ? null : createApi({ baseUrl: apiBaseUrl, token: identity.token });
}

const runPass = coalescePasses(async (now = Date.now()): Promise<SyncPassResult> => {
  useAppStore.getState().syncStarted();

  try {
    const db = getDatabase();
    const result = await runForegroundSync({
      db,
      provider: healthConnectProvider,
      api: apiClient(),
      dates: deviceLocalDates,
      now,
      // The banner is a fact about the platform, not about the server, so it lands as soon as the
      // platform has been read rather than when the network eventually answers.
      onHealth: (health) => useAppStore.getState().healthRead(health, bannerFor(health)),
    });

    // SQLite first, store second, always (tech-04 §5.2).
    usePlayerStore.getState().hydrate(db);
    useAppStore.getState().syncFinished(result, bannerFor(result.health));
    scheduleRetry(result);

    return result;
  } catch (error) {
    useAppStore.getState().syncAborted();

    throw error;
  }
});

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;

/**
 * T2 §5 — while the app stays open, an unreachable server is tried again on a backoff, so turning
 * the PC on is noticed without a reopen.
 *
 * ↯ Only `unreachable`. A server that answered with an error has counted an attempt against each
 * entry, and retrying on a timer would park them within a minute instead of over five opens.
 */
function scheduleRetry(result: SyncPassResult): void {
  cancelRetry(result.server === 'unreachable' ? retryAttempt : 0);

  if (result.server !== 'unreachable') {
    return;
  }

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncNow().catch(() => undefined);
  }, retryDelay(retryAttempt));
  retryAttempt += 1;
}

/**
 * ↯ Called on `background`: a timer is suspended with the JS thread, and firing late on the next
 * foreground would only duplicate the pass that foreground starts anyway.
 */
export function cancelRetry(keepAttempt = 0): void {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }

  retryAttempt = keepAttempt;
}

/**
 * A foreground pass (T4 §8.1).
 *
 * ↯ **Set `withNewWork` when the caller has just written to the outbox** — a settled battle, a
 * queued allocation, a Rest Day tag. A pass already in flight built its payload before that entry
 * existed, so joining it silently defers the upload to the next foreground. See `coalesce.ts`.
 */
export function syncNow(
  now = Date.now(),
  { withNewWork = false }: { withNewWork?: boolean } = {},
): Promise<SyncPassResult> {
  return runPass(now, withNewWork);
}
