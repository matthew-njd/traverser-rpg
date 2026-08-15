import * as SecureStore from 'expo-secure-store';

/**
 * The bearer token, in Keystore-backed storage — never in SQLite (tech-04 §6.4), which is a plain
 * file a rooted device reads trivially.
 *
 * SecureStore values are encrypted with a device-bound key, so an Auto Backup blob restored onto
 * another device is undecryptable — a token that can never be read is worse than none, since "no
 * token" is recoverable. The `expo-secure-store` plugin excludes the store from Auto Backup.
 *
 * Uninstall is total (tech-04 §6.5): a reinstall is a new player, and the only route back is
 * tech-06 §13.1's manual identity export.
 */
const TOKEN_KEY = 'traverser.bearer_token';
const PLAYER_ID_KEY = 'traverser.player_id';

/** `player_id` sits beside the token because the two are one credential — neither works alone. */
export interface DeviceIdentity {
  readonly playerId: string;
  readonly token: string;
}

export async function saveIdentity(identity: DeviceIdentity): Promise<void> {
  await SecureStore.setItemAsync(PLAYER_ID_KEY, identity.playerId);
  await SecureStore.setItemAsync(TOKEN_KEY, identity.token);
}

/** Null when this device has never registered, which is the first-launch signal. */
export async function loadIdentity(): Promise<DeviceIdentity | null> {
  const playerId = await SecureStore.getItemAsync(PLAYER_ID_KEY);
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  // Half an identity is none — reporting it present routes the app into a permanent 401.
  if (playerId === null || token === null) {
    return null;
  }

  return { playerId, token };
}

/**
 * Persists the minted `player_id` **before** registration is attempted, so a crash before the token
 * lands does not orphan the profile. `POST /players` is idempotent on it (tech-02 §3) — a retry
 * that minted a fresh id would leave an unclaimable row per attempt.
 */
export async function savePendingPlayerId(playerId: string): Promise<void> {
  await SecureStore.setItemAsync(PLAYER_ID_KEY, playerId);
}

/** The id from an earlier registration attempt, if one got that far. */
export async function loadPendingPlayerId(): Promise<string | null> {
  return SecureStore.getItemAsync(PLAYER_ID_KEY);
}

export async function clearIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(PLAYER_ID_KEY);
}
