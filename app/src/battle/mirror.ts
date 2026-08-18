import type { SqliteDatabase } from '../db/types';
import { type BattleSnapshot, parseSnapshot, serialiseSnapshot } from './snapshot';

/**
 * The three tables a battle reads and writes (schema v5): the snapshot slot, the satchel, the
 * bestiary.
 *
 * ↯ **None of these is reconciled by a sync response** — T2 §4's response block carries no inventory
 * and no bestiary. They are the local half of a ledger the server keeps from the same battle
 * payload, and `client_battle_id` is what makes both halves move exactly once. So every write here
 * belongs inside the transaction that queues a battle, and nothing may write them from a screen.
 */

export interface SatchelItem {
  /** `player_item.id` — what `items_consumed` names in the payload (T5 §10.3). */
  readonly playerItemId: string;
  readonly itemDefId: string;
}

export interface BestiaryEntry {
  readonly encounterCount: number;
  readonly defeatCount: number;
}

export const NEVER_MET: BestiaryEntry = { encounterCount: 0, defeatCount: 0 };

/**
 * The battle-usable satchel, oldest first.
 *
 * `battle_only` is not filtered here: GDD 4's roster is battle-only throughout, and a filter would
 * silently hide a future out-of-battle item from the one screen that is meant to list what is held.
 */
export function readSatchel(db: SqliteDatabase): SatchelItem[] {
  return db
    .getAllSync<{ id: string; item_def_id: string }>(
      'SELECT id, item_def_id FROM player_item ORDER BY acquired_at, id',
    )
    .map((row) => ({ playerItemId: row.id, itemDefId: row.item_def_id }));
}

/** Removes spent items. By primary key, so re-running after a crash mid-settle is a no-op. */
export function spendItems(db: SqliteDatabase, playerItemIds: readonly string[]): void {
  for (const id of playerItemIds) {
    db.runSync('DELETE FROM player_item WHERE id = ?', [id]);
  }
}

export function grantItem(
  db: SqliteDatabase,
  item: { playerItemId: string; playerId: string; itemDefId: string; acquiredAt: string },
): void {
  db.runSync(
    `INSERT OR IGNORE INTO player_item (id, player_id, item_def_id, acquired_at)
     VALUES (?, ?, ?, ?)`,
    [item.playerItemId, item.playerId, item.itemDefId, item.acquiredAt],
  );
}

export function readBestiary(db: SqliteDatabase, enemyId: string): BestiaryEntry {
  const row = db.getFirstSync<{ encounter_count: number; defeat_count: number }>(
    'SELECT encounter_count, defeat_count FROM player_bestiary WHERE enemy_id = ?',
    [enemyId],
  );

  return row === null
    ? NEVER_MET
    : { encounterCount: row.encounter_count, defeatCount: row.defeat_count };
}

/**
 * Mirrors T2 §4 step 2's increment: `encounter_count` for every battle, `defeat_count` for a win
 * only. Called once per settled battle, in the transaction that queues it.
 */
export function recordBattle(
  db: SqliteDatabase,
  input: { playerId: string; enemyId: string; won: boolean },
): void {
  db.runSync(
    `INSERT INTO player_bestiary (player_id, enemy_id, encounter_count, defeat_count)
     VALUES (?, ?, 1, ?)
     ON CONFLICT (player_id, enemy_id) DO UPDATE SET
       encounter_count = encounter_count + 1,
       defeat_count = defeat_count + excluded.defeat_count`,
    [input.playerId, input.enemyId, input.won ? 1 : 0],
  );
}

export function writeSnapshot(db: SqliteDatabase, snapshot: BattleSnapshot, now: number): void {
  db.runSync(
    `INSERT INTO battle_snapshot (one_row, client_battle_id, snapshot, updated_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT (one_row) DO UPDATE SET
       client_battle_id = excluded.client_battle_id,
       snapshot = excluded.snapshot,
       updated_at = excluded.updated_at`,
    [snapshot.clientBattleId, serialiseSnapshot(snapshot), new Date(now).toISOString()],
  );
}

/**
 * The stored snapshot, or null.
 *
 * ↯ Unreadable JSON returns null rather than throwing. This runs at boot, and a snapshot written by
 * a version that no longer parses must abandon the battle (§8.1's answer), not stop the app from
 * starting — the only recovery from a boot crash is an uninstall (T4 §6.5).
 */
export function readSnapshot(db: SqliteDatabase): BattleSnapshot | null {
  const row = db.getFirstSync<{ snapshot: string }>(
    'SELECT snapshot FROM battle_snapshot WHERE one_row = 1',
  );

  if (row === null) {
    return null;
  }

  try {
    return parseSnapshot(row.snapshot);
  } catch {
    return null;
  }
}

export function clearSnapshot(db: SqliteDatabase): void {
  db.runSync('DELETE FROM battle_snapshot');
}
