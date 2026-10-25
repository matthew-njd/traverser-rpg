import { enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import { mintUuidV7 } from '../health/deltaId';
import { writeVigor } from '../sync/mirror';
import type { Drops, GearDrop } from './loot';
import { clearSnapshot, recordBattle } from './mirror';
import type { BattleOutcome, BattleState } from './state';

/**
 * Writing a settled battle out (T5 §10.3, T4 §5.3).
 *
 * ↯ **One transaction**: the outbox entry, the Vigor result, and the snapshot's deletion land
 * together or not at all. Deleting the snapshot in a separate step leaves a window in which a
 * battle is both settled and resumable — which is a second submission of the same fight, and the
 * `client_battle_id` only saves the server, not the local mirror.
 */

export interface SettledBattle {
  readonly clientBattleId: string;
  readonly grantId: string | null;
  /** The player's own local calendar date. The server never derives one from an instant (T2 §2). */
  readonly activityDate: string;
  readonly enemyId: string;
  readonly encounterKind: string;
  readonly enemyLevel: number;
  readonly outcome: BattleOutcome;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly vigorAfter: number;
  readonly itemsConsumed: readonly string[];
  readonly drops: Drops;
  /**
   * One `player_item.id` per entry in `drops.items`, paired by position and minted on the device
   * (T5 §10.3, amended 2026-08-22). Empty until `settleBattle` mints them.
   */
  readonly grantedItemIds: readonly string[];
  /**
   * The same for `[...drops.gear, drops.trinket]`, in that order (M5/P3b), so the overflow prompt
   * can discard a dropped piece by the id both tiers hold. Absent on a payload queued before P3b.
   */
  readonly grantedGearIds?: readonly string[];
}

export function battlePayload(
  state: BattleState,
  meta: {
    readonly clientBattleId: string;
    readonly grantId: string | null;
    readonly activityDate: string;
    readonly startedAt: string;
    readonly endedAt: string;
  },
): SettledBattle {
  if (state.outcome === null) {
    throw new Error('the battle has not settled yet');
  }

  return {
    clientBattleId: meta.clientBattleId,
    grantId: meta.grantId,
    activityDate: meta.activityDate,
    enemyId: state.enemyId,
    encounterKind: state.encounterKind,
    enemyLevel: state.enemyLevel,
    outcome: state.outcome,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    vigorAfter: state.player.vigor,
    itemsConsumed: state.itemsConsumed,
    drops: state.drops ?? { items: [], gear: [], trinket: null },
    grantedItemIds: [],
    grantedGearIds: [],
  };
}

/**
 * A resolved piece and its frozen bonus (T5 §10.1, amended 2026-08-22).
 *
 * ↯ `bonus_primary` is the one value on this surface the server could derive and deliberately does
 * not: it is frozen at drop by design, so re-deriving it later would be the bug rather than the
 * check (T2 §4.1).
 */
function wireGear(kind: 'gear' | 'trinket', drop: GearDrop, id: string | undefined): Record<string, unknown> {
  return {
    kind,
    def_id: drop.defId,
    level_at_drop: drop.levelAtDrop,
    bonus_primary: drop.bonusPrimary,
    bonus_secondary: drop.bonusSecondary,
    player_gear_id: id ?? null,
  };
}

/** `[...gear, trinket]` — the order `grantedGearIds` pairs with. */
export const droppedPieces = (drops: Drops): GearDrop[] =>
  drops.trinket === null ? [...drops.gear] : [...drops.gear, drops.trinket];

/** The wire shape of T2 §4.1's battle payload. Keys are the server's, as everywhere below `dto`. */
export function toWireBattle(battle: SettledBattle): Record<string, unknown> {
  return {
    client_battle_id: battle.clientBattleId,
    grant_id: battle.grantId,
    activity_date: battle.activityDate,
    enemy_id: battle.enemyId,
    encounter_kind: battle.encounterKind,
    enemy_level: battle.enemyLevel,
    outcome: battle.outcome,
    started_at: battle.startedAt,
    ended_at: battle.endedAt,
    vigor_after: battle.vigorAfter,
    items_consumed: [...battle.itemsConsumed],
    drops: [
      // Paired by position with `grantedItemIds` — the id the device already inserted, so the
      // server's row and the local row are the same physical object (T5 §10.3).
      ...battle.drops.items.map((defId, index) => ({
        kind: 'item',
        def_id: defId,
        player_item_id: battle.grantedItemIds[index] ?? null,
      })),
      ...droppedPieces(battle.drops).map((drop, index) =>
        wireGear(index < battle.drops.gear.length ? 'gear' : 'trinket', drop, battle.grantedGearIds?.[index]),
      ),
    ],
  };
}

/**
 * Queues the battle and applies its local effects — the client half of T2 §4 step 2, in the order
 * the server applies its own.
 *
 * The Vigor written here is the same number the payload carries, so the mirror and the server agree
 * before the sync happens rather than after it — the battle screen has already shown it.
 *
 * ↯ **The device mints each dropped item's `player_item.id` and sends it** (amended 2026-08-22).
 * The rule it replaces was right about the hazard and wrong about the fix: an id the server never
 * had would be named in `items_consumed` for a row that does not exist there, and its inventory
 * would drift up by one per spend. Sending the id closes that — the row is the same physical object
 * on both tiers — and it is the only way the satchel can hold the drop before the next sync, which
 * with the API off by design can be days (T5 §1.6).
 */
export function settleBattle(
  db: SqliteDatabase,
  battle: SettledBattle,
  playerId: string,
  now: number,
): void {
  transact(db, () => {
    const acquiredAt = battle.endedAt;
    const granted = battle.drops.items.map((itemDefId) => ({
      id: mintUuidV7(db, now),
      itemDefId,
    }));
    const pieces = droppedPieces(battle.drops).map((drop) => ({ id: mintUuidV7(db, now), drop }));

    enqueue(db, {
      clientOpId: battle.clientBattleId,
      kind: 'battle',
      payload: {
        ...battle,
        grantedItemIds: granted.map((item) => item.id),
        grantedGearIds: pieces.map((piece) => piece.id),
      },
      createdAt: new Date(now).toISOString(),
    });

    for (const item of granted) {
      db.runSync(
        'INSERT INTO player_item (id, player_id, item_def_id, acquired_at) VALUES (?, ?, ?, ?)',
        [item.id, playerId, item.itemDefId, acquiredAt],
      );
    }

    // Gear too, so a piece past the 12-slot cap can be prompted on before the next sync (M5/P3b).
    for (const { id, drop } of pieces) {
      db.runSync(
        `INSERT INTO player_gear (
           id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, bonus_secondary, acquired_at
         ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
        [id, playerId, drop.defId, drop.levelAtDrop, drop.bonusPrimary, drop.bonusSecondary, acquiredAt],
      );
    }

    // The anchor moves with the value, matching what the server writes from this same payload
    // (T2 §4 step 2). Left behind, regen would credit the whole fight's duration back immediately.
    writeVigor(db, battle.vigorAfter, battle.endedAt);

    // `items_consumed` still travels to the server, which deletes its own rows (T2 §4 step 2). The
    // local rows went at the moment they were spent, so the fight can be resumed after a crash
    // without offering the same item twice (T4 §5.3).
    recordBattle(db, { playerId, enemyId: battle.enemyId, won: battle.outcome === 'win' });

    // ↯ **A grant is spent by the battle that names it, and only once.** Server-side "spent" is
    // derived — a `battle` row referencing the grant — so nothing needs to be sent. Locally the row
    // is deleted here rather than at battle *start*: a fight abandoned mid-way writes no battle row
    // (T5 §8.1), and its encounter must still be waiting when the player comes back.
    if (battle.grantId !== null) {
      db.runSync('DELETE FROM encounter_grant WHERE grant_id = ?', [battle.grantId]);
    }

    // Last, and in the same transaction: no window in which a battle is both settled and resumable.
    clearSnapshot(db);
  });
}
