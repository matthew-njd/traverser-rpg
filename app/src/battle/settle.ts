import { enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import type { Drops } from './loot';
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
  };
}

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
      ...battle.drops.items.map((defId) => ({ kind: 'item', def_id: defId })),
      // Gear and trinket carry the tier they rolled; the piece and its frozen bonus are GDD 8's,
      // and land with gear at M3 (T5 §10.1).
      ...battle.drops.gear.map((tier) => ({ kind: 'gear', def_id: tier })),
      ...(battle.drops.trinket === null ? [] : [{ kind: 'trinket', def_id: battle.drops.trinket }]),
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
 * ↯ **Drops are not granted locally.** They ride the payload and the server mints their
 * `player_item.id` (T1 §4), so granting a second row here under a client-minted id would make
 * `items_consumed` name rows the server never had, and its inventory would drift up by one per
 * spend. The payload carries the roll and the server records it; **nothing on the device shows it**
 * — GDD 13 §6.3's Reveal Card is unbuilt, and `writeInventory` runs only from `writeProfile`, so an
 * ordinary sync never refreshes the satchel (DECISIONS 2026-08-22).
 */
export function settleBattle(
  db: SqliteDatabase,
  battle: SettledBattle,
  playerId: string,
  now: number,
): void {
  transact(db, () => {
    enqueue(db, {
      clientOpId: battle.clientBattleId,
      kind: 'battle',
      payload: battle,
      createdAt: new Date(now).toISOString(),
    });

    db.runSync('UPDATE player SET vigor_current = ?', [battle.vigorAfter]);

    // `items_consumed` still travels to the server, which deletes its own rows (T2 §4 step 2). The
    // local rows went at the moment they were spent, so the fight can be resumed after a crash
    // without offering the same item twice (T4 §5.3).
    recordBattle(db, { playerId, enemyId: battle.enemyId, won: battle.outcome === 'win' });

    // Last, and in the same transaction: no window in which a battle is both settled and resumable.
    clearSnapshot(db);
  });
}
