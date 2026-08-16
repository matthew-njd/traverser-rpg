import {
  type DeviceIdentity,
  loadPendingPlayerId,
  savePendingPlayerId,
  saveIdentity,
} from '../db/secureToken';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import { mintUuidV7 } from '../health/deltaId';
import { createApi, registerPlayer } from '../sync/api';
import { backfillActivity } from '../sync/history';
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

/**
 * Whether the local profile can be handed over without destroying anything (T6 §13.1, amended
 * 2026-08-16).
 *
 * The guard is on what the player **chose** and cannot undo: a spent stat point has no respec, and
 * a completed tutorial has no replay. Everything else about a young profile is recoverable —
 * {@link handOverTo} clears the watermarks and the next read window re-mints the last 72 hours for
 * the restored player (T3 §4.1).
 *
 * ↯ **Level is deliberately not part of this**, and the first version of it was wrong for exactly
 * that reason. Level is not a decision, it is arithmetic on steps: a fresh profile that syncs one
 * ordinary walk is Level 2 within minutes, which slammed the door on the mis-tap case this control
 * exists to serve. Anything derived from activity belongs on the same side of the line as activity.
 */
export function isProfileReplaceable(db: SqliteDatabase): boolean {
  const player = db.getFirstSync<{
    allocated: number;
    tutorial_completed_at: string | null;
  }>(
    `SELECT alloc_vigor + alloc_might + alloc_resolve
              + alloc_favor + alloc_aegis + alloc_stride AS allocated,
            tutorial_completed_at
       FROM player`,
  );

  // No profile at all is the onboarding case, which has its own screen and does not come here.
  if (player === null) {
    return false;
  }

  return player.allocated === 0 && player.tutorial_completed_at === null;
}

/**
 * What was pasted into the restore field, in either form the player is likely to have to hand: the
 * exported JSON document, or a bare token copied out of it.
 *
 * ↯ **The token alone is sufficient**, and accepting only the JSON was a real defect found on the
 * device — the field took the text, the button stayed disabled, and nothing said why. The credential
 * *is* the token: `GET /players/me` answers with whichever profile it belongs to, so `player_id` is
 * a cross-check on a paste rather than an input the restore needs. A null id here means "believe
 * the server", which {@link handOverTo} handles.
 *
 * Lives here rather than in the screen because tech-04 §13 keeps `app/` to routes — and because a
 * pure function that decides what counts as a credential is worth testing without a renderer.
 */
export function parseIdentityDocument(
  pasted: string,
): { playerId: string | null; token: string } | null {
  const trimmed = pasted.trim();

  if (trimmed === '') {
    return null;
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);

      if (typeof parsed !== 'object' || parsed === null) {
        return null;
      }

      const { player_id: playerId, token } = parsed as Record<string, unknown>;

      if (typeof token !== 'string' || token.trim() === '') {
        return null;
      }

      return {
        playerId: typeof playerId === 'string' && playerId.trim() !== '' ? playerId.trim() : null,
        token: token.trim(),
      };
    } catch {
      // A truncated document must fail here rather than fall through to the bare-token branch,
      // which would send a fragment of JSON as a credential.
      return null;
    }
  }

  // A bare token. Whitespace is stripped rather than rejected, because a token pasted out of a
  // wrapped text field arrives with line breaks in it.
  const token = trimmed.replace(/\s+/g, '');

  return token === '' ? null : { playerId: null, token };
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

  await backfillActivity(db, api, profile.player.playerId);
}


/**
 * Restores an identity onto a device that **already holds a different one** (T6 §13.1, amended
 * 2026-08-16). The onboarding branch above assumes an empty device; this one replaces.
 *
 * Three things must go, and each for its own reason:
 *
 * 1. **The mirror**, by deleting the player row — the children cascade. `writePlayer` updates `id`
 *    in place, so writing the incoming profile over the outgoing one would leave that player's
 *    `activity_day` and `streak_state` rows pointing at an id no longer present.
 * 2. **The watermarks**, which is what saves the day's steps rather than losing them. They record
 *    what was already *reported*, and it was reported as the outgoing player — kept, the restored
 *    player would never see those steps. Cleared, the next pass's `[now−72h, now]` window re-reads
 *    Health Connect and re-mints them (T3 §4.1). Health Connect is never consumed destructively, so
 *    the raw data is still there to be read again.
 * 3. **The outbox**, whose queued deltas were minted for the outgoing player. They would otherwise
 *    upload under the new token; the watermark clear re-mints the same window anyway.
 *
 * ↯ The **server keeps the profile being replaced** (DECISIONS 2026-08-16). Nothing here deletes
 * remote data — a mis-tap can strand a profile, never destroy one, and it stays claimable by its
 * own exported identity.
 */
export async function handOverTo(
  db: SqliteDatabase,
  options: RegistrationOptions,
  pasted: { playerId: string | null; token: string },
): Promise<void> {
  // Proved before anything local is touched, exactly as in `restoreIdentity` — with more at stake
  // here, because the wipe below is not recoverable from the device.
  const api = createApi({ ...options, token: pasted.token });
  const profile = await api.profile();

  // A null id means the token was pasted on its own, so there is nothing to cross-check against and
  // the server's answer is the identity. When an id *was* supplied it must agree — a mismatch means
  // two exports got mixed up, and continuing would hand the device to a profile nobody asked for.
  if (pasted.playerId !== null && profile.player.playerId !== pasted.playerId) {
    throw new RestoreError(
      'That token belongs to a different profile than the player id it was pasted with.',
    );
  }

  const identity: DeviceIdentity = {
    playerId: profile.player.playerId,
    token: pasted.token,
  };

  // SQLite first, credential second. The reverse order strands the device on a failure: a saved
  // token with the outgoing player's mirror boots into the tabs and cannot reach any restore
  // screen. This way a failure leaves no identity at all, which lands on onboarding — recoverable.
  transact(db, () => {
    db.runSync('DELETE FROM player');
    db.runSync('DELETE FROM outbox');
    db.runSync('DELETE FROM step_watermark');
    db.runSync('DELETE FROM hr_minute_watermark');
    db.runSync('DELETE FROM hr_session_ledger');
    db.runSync('DELETE FROM read_watermark');

    writeProfile(db, profile);
  });

  await saveIdentity(identity);

  // The wipe above took the outgoing player's history with it, and the incoming player's history
  // has never been on this device — so without this the restored profile shows an empty log.
  await backfillActivity(db, api, identity.playerId);
}
