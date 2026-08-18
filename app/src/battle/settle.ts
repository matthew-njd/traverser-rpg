import { enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import type { Drops } from './loot';
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
 * Queues the battle and applies its local effects.
 *
 * The Vigor written here is the same number the payload carries, so the mirror and the server agree
 * before the sync happens rather than after it — the battle screen has already shown it.
 */
export function settleBattle(db: SqliteDatabase, battle: SettledBattle, now: number): void {
  transact(db, () => {
    enqueue(db, {
      clientOpId: battle.clientBattleId,
      kind: 'battle',
      payload: battle,
      createdAt: new Date(now).toISOString(),
    });

    db.runSync('UPDATE player SET vigor_current = ?', [battle.vigorAfter]);
  });
}
