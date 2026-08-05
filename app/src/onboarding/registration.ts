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
 * ↯ Registration is one of only three things that genuinely require the server (tech-02 §3) — the
 * others being the content bundle and sync itself. Everything else in this app has a mirror answer,
 * so this is the single screen where "the PC is off" is a wall rather than a shrug, and the caller
 * has to say so rather than failing silently.
 */

/** GDD 10 §5.1 — 20 characters, "Traverser" pre-filled so a player who doesn't care taps through. */
export const DEFAULT_TRAVERSER_NAME = 'Traverser';
export const MAX_TRAVERSER_NAME_LENGTH = 20;

/**
 * ↯ `Intl` on Hermes comes from Android's ICU and its surface varies by OS version, so this is
 * guarded. `UTC` is a poor guess but a harmless one in M1 — the server stores the timezone for
 * GDD 11 §3.2's grace window, which is M4, and the *client* owns every local-date decision that
 * matters today (tech-02 §2).
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
 * ↯ The order is deliberate and each step guards the one before it:
 *
 * 1. **The `player_id` is persisted before the request is made.** A crash between the server
 *    inserting the row and the token reaching storage would otherwise orphan a profile nobody can
 *    claim — and re-minting an id on retry would do it again on every attempt. Reusing the stored id
 *    is exactly what makes `POST /players` idempotent worth having.
 * 2. **The token is saved before the mirror is written.** The mirror is rebuildable from
 *    `GET /players/me`; the token is returned exactly once and is unrecoverable if dropped.
 * 3. **The birth year goes through the normal queued-write path**, not through registration, because
 *    `POST /players` does not accept it (T3 §1.4's deviation lands on `PATCH /settings`). It applies
 *    to the mirror immediately and replays with the next sync like any other progression write.
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
 * ↯ **The credentials are proved before they are stored.** `GET /players/me` is the cheapest call
 * that can only succeed with a valid token, and saving an unverified one would strand the device
 * permanently: the app would boot straight into the tabs, 401 on every sync, and never show this
 * screen again — because the restore path only exists where there is no identity.
 *
 * ↯ This is also the only reason the Postgres backup is restorable at all (§10.1). A perfect dump
 * recovered onto new hardware is a database full of history that no client can claim, because the
 * identity needed to claim it lived only in app storage on a phone that is gone.
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
