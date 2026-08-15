import {
  type DeviceIdentity,
  loadPendingPlayerId,
  savePendingPlayerId,
  saveIdentity,
} from '../db/secureToken';
import type { SqliteDatabase } from '../db/types';
import { mintUuidV7 } from '../health/deltaId';
import { createApi, registerPlayer } from '../sync/api';
import { writeProfile } from '../sync/mirror';
import { changeSettings } from '../sync/writes';

/**
 * GDD 10 screens 2–4's terminal step, and tech-06 §13.1's restore branch beside it.
 *
 * One of only three things that genuinely require the server (tech-02 §3), so this is the one
 * screen where "the PC is off" is a wall rather than a shrug. The caller must say so.
 */

/** GDD 10 §5.1 — 20 characters, "Traverser" pre-filled so a player who doesn't care taps through. */
export const DEFAULT_TRAVERSER_NAME = 'Traverser';
export const MAX_TRAVERSER_NAME_LENGTH = 20;

/**
 * ↯ `Intl` on Hermes comes from Android's ICU and varies by OS version, so this is guarded. The
 * `UTC` fallback is harmless in M1 — the client owns every local-date decision (tech-02 §2).
 */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export interface RegistrationOptions {
  readonly baseUrl: string;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Registers a guest profile and leaves the device able to sync.
 *
 * The order is load-bearing — each step guards the one before it:
 *
 * 1. `player_id` persisted **before** the request, or a crash orphans an unclaimable profile.
 * 2. Token saved **before** the mirror — the mirror rebuilds from `GET /players/me`, the token is
 *    returned exactly once. A mirror without a token boots into the tabs and 401s forever.
 * 3. Birth year goes through the queued-write path: `POST /players` does not accept it (T3 §1.4).
 */
export async function registerNewPlayer(
  db: SqliteDatabase,
  options: RegistrationOptions,
  request: { traverserName: string; birthYear: number },
  now: number,
): Promise<DeviceIdentity> {
  const playerId = (await loadPendingPlayerId()) ?? mintUuidV7(db, now);

  await savePendingPlayerId(playerId);

  const registration = await registerPlayer(options, {
    playerId,
    traverserName: request.traverserName.trim() || DEFAULT_TRAVERSER_NAME,
    timezone: deviceTimezone(),
  });

  const identity: DeviceIdentity = {
    playerId: registration.profile.player.playerId,
    token: registration.token,
  };

  await saveIdentity(identity);

  writeProfile(db, registration.profile);
  changeSettings(db, { dailyStepGoal: null, birthYear: request.birthYear }, now);

  return identity;
}

export class RestoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RestoreError';
  }
}

/**
 * tech-06 §13.1's restore branch: accept an exported `player_id` + token instead of registering.
 *
 * Credentials are **proved before they are stored**. Saving an unverified token strands the
 * device — it boots into the tabs, 401s forever, and never shows this screen again, because the
 * restore path only exists where there is no identity.
 */
export async function restoreIdentity(
  db: SqliteDatabase,
  options: RegistrationOptions,
  identity: DeviceIdentity,
): Promise<void> {
  const api = createApi({ ...options, token: identity.token });
  const profile = await api.profile();

  if (profile.player.playerId !== identity.playerId) {
    throw new RestoreError(
      'That token belongs to a different profile than the player id it was pasted with.',
    );
  }

  await saveIdentity(identity);

  writeProfile(db, profile);
}
