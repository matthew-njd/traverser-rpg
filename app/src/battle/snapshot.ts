import type { BattleState } from './state';

/**
 * The durable snapshot T4 §5.3 reserved a slot for (T5 §8).
 *
 * Written **after every resolved turn**, inside the same transaction that spends an item or a use.
 * Deleted in the same transaction that writes the `battle` row and the drops to the outbox — so
 * there is no window in which a battle is both settled and resumable.
 */

/**
 * ↯ Bump on **any** change to `BattleState`'s shape. A snapshot the new code cannot read is
 * abandoned rather than migrated (§8.1) — these live for minutes, so a migration path would be
 * more code than the thing it protects.
 */
export const SNAPSHOT_SCHEMA_VERSION = 1;

export interface BattleSnapshot {
  readonly schemaVersion: number;
  /** UUIDv7, minted at battle start and never re-derived, so a resumed battle keeps its id (T2 §5). */
  readonly clientBattleId: string;
  readonly grantId: string | null;
  readonly startedAt: string;
  readonly contentVersion: number;
  /** Null in production under the system RNG; set only when a seeded run is being reproduced. */
  readonly rngSeed: number | null;
  readonly state: BattleState;
}

export type ResumeFailure = 'content_moved' | 'schema_moved';

export type ResumeResult =
  | { readonly ok: true; readonly snapshot: BattleSnapshot }
  /** The battle is abandoned and the grant returns unspent; no `battle` row is written (§8.1). */
  | { readonly ok: false; readonly reason: ResumeFailure };

/**
 * The three resume hazards of §8.1, each with its defined answer.
 *
 * ↯ Two of the three abandon the battle, and that is the *kinder* outcome rather than the harsher
 * one: a sync between backgrounding and resuming can change a move's Power underneath a fight in
 * progress, and resuming a battle whose numbers have changed mid-flight is worse than losing it —
 * the player keeps the encounter either way, because grants are held client-side until spent.
 *
 * The third hazard needs no code: the player was mid-`AwaitPlayer`, which holds no partial input, so
 * resume re-enters it and the screen redraws.
 */
export function resumeSnapshot(
  snapshot: BattleSnapshot,
  current: { readonly contentVersion: number },
): ResumeResult {
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    return { ok: false, reason: 'schema_moved' };
  }

  if (snapshot.contentVersion !== current.contentVersion) {
    return { ok: false, reason: 'content_moved' };
  }

  return { ok: true, snapshot };
}

/**
 * JSON, because the snapshot column is text and the state is already a plain tree of numbers,
 * strings and booleans — no dates, no maps, no class instances. The round trip below is asserted,
 * so a future state field that is not JSON-safe fails a test rather than a resume on a device.
 */
export function serialiseSnapshot(snapshot: BattleSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(serialised: string): BattleSnapshot {
  return JSON.parse(serialised) as BattleSnapshot;
}
