import * as SecureStore from 'expo-secure-store';

/**
 * The bearer token, in Android Keystore-backed storage — **never in SQLite** (tech-04 §6.4).
 *
 * ↯ It is a credential, and `traverser.db` is a plain file that a rooted device or a debug build
 * reads trivially. This is also why `app.config.ts` registers the `expo-secure-store` config
 * plugin: SecureStore values are encrypted with a device-bound key, so a blob captured by Android
 * Auto Backup and restored onto a different device is undecryptable, and the app would hold a token
 * it can never read — worse than holding none, since "no token" is a state registration recovers
 * from. The plugin excludes the store from Auto Backup for exactly that reason.
 *
 * ↯ And note what follows from that: **uninstall is total and there is no recovery** (tech-04 §6.5).
 * `player_id` is device-minted and guest-only, so a reinstall is a new player with no path back to
 * the old profile — the server still holds it, but nothing on the device knows its id. The
 * supported route back is tech-06 §13.1's manual identity export, which is P8.
 */
const TOKEN_KEY = 'traverser.bearer_token';
const PLAYER_ID_KEY = 'traverser.player_id';

/**
 * `player_id` lives here beside the token rather than in the mirror, because the two are one
 * credential: a token without the id it belongs to cannot be used, and an id without a token cannot
 * authenticate. Splitting them across two stores would mean two things to keep in step and two ways
 * to end up holding half an identity.
 */
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

  // Half an identity is treated as none: it cannot authenticate, and reporting it as present would
  // send the app down the returning-player path with a credential that will 401 forever.
  if (playerId === null || token === null) {
    return null;
  }

  return { playerId, token };
}

/**
 * ↯ Persists the client-minted `player_id` **before** registration is attempted, so a crash between
 * the server creating the profile and the token reaching storage does not orphan it.
 *
 * This is the half-identity {@link loadIdentity} refuses to return, and refusing it there is still
 * right — it cannot authenticate. But the id itself is worth keeping, because `POST /players` is
 * idempotent on it (tech-02 §3): a retry that reuses the id returns the existing profile and a fresh
 * token, while a retry that minted a *new* id would leave a second, unclaimable player row on the
 * server for every failed attempt.
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
