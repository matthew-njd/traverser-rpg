import { getDatabase, openTraverserDatabase } from './db/open';
import { type DeviceIdentity, loadIdentity } from './db/secureToken';
import type { SqliteDatabase } from './db/types';
import { bannerFor } from './health/banner';
import { healthConnectProvider } from './health/healthconnect';
import { deviceLocalDates } from './health/localDate';
import { apiBaseUrl } from './env';
import { type TraverserApi, createApi } from './sync/api';
import { type SyncPassResult, runForegroundSync } from './sync/pass';
import { useAppStore } from './state/appStore';
import { usePlayerStore } from './state/playerStore';

/**
 * The composition root: the one place that wires the database, the health provider, the API client
 * and the stores together. Routes call into here; nothing in `app/` constructs a dependency.
 *
 * ↯ tech-04 §13 keeps `app/` to routes and no logic. This module is what makes that possible without
 * a provider tree — the singletons are process-scoped because the database and the identity are
 * too, and a React context would only add a way for them to be missing.
 */

let identity: DeviceIdentity | null = null;

/**
 * tech-04 §7.1 steps 2–4. **Touches the network zero times and the health provider zero times** —
 * a sync that takes eight seconds against a PC that is off must never be something the player waits
 * through, so the boot path cannot contain one.
 */
export async function bootRuntime(): Promise<SqliteDatabase> {
  const db = openTraverserDatabase();

  identity = await loadIdentity();

  usePlayerStore.getState().hydrate(db);
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

/**
 * ↯ Re-entrancy guard. `AppState` can deliver `'active'` more than once in quick succession — a
 * permission dialog dismissing, a system sheet closing — and two overlapping passes would both read
 * the same health window. The second would mint nothing (the watermarks see to that), but it would
 * still double the upload, so the cheap fix is to let the second caller await the first.
 */
let inFlight: Promise<SyncPassResult> | null = null;

export function syncNow(now = Date.now()): Promise<SyncPassResult> {
  if (inFlight !== null) {
    return inFlight;
  }

  const pass = (async () => {
    useAppStore.getState().syncStarted();

    try {
      const db = getDatabase();
      const result = await runForegroundSync({
        db,
        provider: healthConnectProvider,
        api: apiClient(),
        dates: deviceLocalDates,
        now,
      });

      // ↯ SQLite first, store second, always — tech-04 §5.2. The pass has already written the
      // mirror; this is the hydration that makes the screens agree with it.
      usePlayerStore.getState().hydrate(db);
      useAppStore.getState().syncFinished(result, bannerFor(result.health));

      return result;
    } catch (error) {
      useAppStore.getState().syncAborted();

      throw error;
    } finally {
      inFlight = null;
    }
  })();

  inFlight = pass;

  return pass;
}
