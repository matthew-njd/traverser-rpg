import type { SqliteDatabase } from '../db/types';
import type { EquippedBonus } from '../progression/stats';
import { type BattleSnapshot, parseSnapshot, serialiseSnapshot } from './snapshot';

/**
 * The three tables a battle reads and writes (schema v5): the snapshot slot, the satchel, the
 * bestiary.
 *
 * ↯ **None of these is reconciled by a sync response** — T2 §4's response block carries no inventory
 * and no bestiary. They are the local half of a ledger the server keeps from the same battle
 * payload, and `client_battle_id` is what makes both halves move exactly once. So every write here
 * belongs inside a transaction that queues the matching replay: a battle, or `consumeItem`'s heal.
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
 * Every held item, oldest first.
 *
 * `battle_only` is not filtered here: the Satchel lists everything held, and the healing items are
 * usable outside a fight too (GDD 4 §4).
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

/**
 * The equipped pieces, for the stat derivation (GDD 8 §2).
 *
 * Only equipped rows: owning a weapon and wearing it are different things, and the unique index on
 * `(player_id, equipped_slot)` is what makes at most one per slot true in the schema.
 */
export function readEquippedGear(db: SqliteDatabase): EquippedBonus[] {
  return db
    .getAllSync<{ equipped_slot: string | null; bonus_primary: number; bonus_secondary: number | null }>(
      `SELECT equipped_slot, bonus_primary, bonus_secondary
         FROM player_gear WHERE equipped_slot IS NOT NULL`,
    )
    .map((row) => ({
      equippedSlot: row.equipped_slot,
      bonusPrimary: row.bonus_primary,
      bonusSecondary: row.bonus_secondary,
    }));
}

export interface OwnedGear extends EquippedBonus {
  readonly playerGearId: string;
  readonly gearDefId: string;
  /** The slot the piece's `gear_def` fits — not where it is worn. */
  readonly slot: string;
  readonly tier: string;
  /** Trinkets only. */
  readonly zoneId: string | null;
}

/** Every owned piece, for the equip control. Highest tier first within a slot (GDD 13 §5.1). */
export function readOwnedGear(db: SqliteDatabase): OwnedGear[] {
  return db
    .getAllSync<{
      id: string;
      gear_def_id: string;
      slot: string;
      tier: string;
      zone_id: string | null;
      equipped_slot: string | null;
      bonus_primary: number;
      bonus_secondary: number | null;
    }>(
      `SELECT pg.id, pg.gear_def_id, gd.slot, gd.tier, gd.zone_id, pg.equipped_slot,
              pg.bonus_primary, pg.bonus_secondary
         FROM player_gear pg JOIN gear_def gd ON gd.id = pg.gear_def_id
        ORDER BY gd.slot,
                 CASE gd.tier WHEN 'divine' THEN 0 WHEN 'mythic' THEN 1 WHEN 'heroic' THEN 2 ELSE 3 END,
                 pg.acquired_at DESC, pg.id`,
    )
    .map((row) => ({
      playerGearId: row.id,
      gearDefId: row.gear_def_id,
      slot: row.slot,
      tier: row.tier,
      zoneId: row.zone_id,
      equippedSlot: row.equipped_slot,
      bonusPrimary: row.bonus_primary,
      bonusSecondary: row.bonus_secondary,
    }));
}

/** GDD 3 §4.1 — the move the worn Trinket grants, if it grants one. */
export function readTrinketMove(db: SqliteDatabase): string | null {
  return (
    db.getFirstSync<{ grants_move_id: string | null }>(
      `SELECT gd.grants_move_id FROM player_gear pg JOIN gear_def gd ON gd.id = pg.gear_def_id
        WHERE pg.equipped_slot = 'trinket'`,
    )?.grants_move_id ?? null
  );
}

/** The chosen loadout in slot order (GDD 2 §5). Empty until the player has chosen one. */
export function readStoredLoadout(db: SqliteDatabase): string[] {
  return db
    .getAllSync<{ skill_id: string }>('SELECT skill_id FROM equipped_skill ORDER BY slot')
    .map((row) => row.skill_id);
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
