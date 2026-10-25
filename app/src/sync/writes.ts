import { enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import { mintUuidV7 } from '../health/deltaId';
import type { LocalDateResolver } from '../health/localDate';
import { maxVigorFor, recoverVigor, restoreVigor } from '../progression/vigor';
import { readOwnedGear, readSnapshot, spendItems } from '../battle/mirror';
import type {
  AllocationPayload,
  EquipPayload,
  ExplorePayload,
  RestDayPayload,
  SettingsPayload,
  SkillsPayload,
  UseItemPayload,
} from './dto';
import { readPlayer, writeRestTag, writeSettings, writeStoredLoadout, writeVigor } from './mirror';

/**
 * tech-02 §3's progression writes — the endpoints marked `•`, which **apply optimistically to the
 * mirror and replay to the server**.
 *
 * The local write and the queue entry are one transaction, always. A mirror without a replay is a
 * change the server never hears; a replay without the mirror is a change the player cannot see.
 * "Fixed on the next sync" is not a recovery here — offline is the state the app lives in.
 */

export interface StatDeltas {
  readonly vigor: number;
  readonly might: number;
  readonly resolve: number;
  readonly favor: number;
  readonly aegis: number;
  readonly stride: number;
}

export const NO_STATS: StatDeltas = {
  vigor: 0,
  might: 0,
  resolve: 0,
  favor: 0,
  aegis: 0,
  stride: 0,
};

export const totalPoints = (deltas: StatDeltas): number =>
  deltas.vigor + deltas.might + deltas.resolve + deltas.favor + deltas.aegis + deltas.stride;

export class AllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}

/**
 * Spends unspent stat points (GDD 1 §5, GDD 13 §3.2). Permanent on confirm — the GDD names no
 * respec mechanic, which is why the stepper's ± stays in component state until confirmed.
 *
 * The operation id is minted once and reused on every retry (tech-02 §2). On an additive write a
 * fresh id per attempt is the difference between idempotent and doubling.
 */
export function allocateStatPoints(
  db: SqliteDatabase,
  deltas: StatDeltas,
  now: number,
): AllocationPayload {
  let payload: AllocationPayload = { ...NO_STATS, operationId: '' };

  transact(db, () => {
    const player = readPlayer(db);

    if (player === null) {
      throw new AllocationError('No player to allocate against.');
    }

    const total = totalPoints(deltas);

    if (total <= 0) {
      throw new AllocationError('An allocation must spend at least one point.');
    }

    if (Object.values(deltas).some((value) => value < 0 || !Number.isInteger(value))) {
      throw new AllocationError('Stat deltas must be non-negative whole numbers.');
    }

    if (total > player.unspentStatPoints) {
      throw new AllocationError(
        `Cannot spend ${total} points; only ${player.unspentStatPoints} are unspent.`,
      );
    }

    payload = { ...deltas, operationId: mintUuidV7(db, now) };

    db.runSync(
      `UPDATE player SET
         alloc_vigor = alloc_vigor + ?,
         alloc_might = alloc_might + ?,
         alloc_resolve = alloc_resolve + ?,
         alloc_favor = alloc_favor + ?,
         alloc_aegis = alloc_aegis + ?,
         alloc_stride = alloc_stride + ?,
         unspent_stat_points = unspent_stat_points - ?
       WHERE one_row = 1`,
      [
        deltas.vigor,
        deltas.might,
        deltas.resolve,
        deltas.favor,
        deltas.aegis,
        deltas.stride,
        total,
      ],
    );

    enqueue(db, {
      clientOpId: payload.operationId,
      kind: 'allocation',
      payload,
      createdAt: new Date(now).toISOString(),
    });
  });

  return payload;
}

/**
 * Step goal and/or birth year. Null means leave alone, matching the wire.
 *
 * A new birth year re-derives thresholds for future reads only (tech-03 §1.4) — XP is never taken
 * back (GDD 1 §1), so correcting an age does not correct history.
 */
export function changeSettings(db: SqliteDatabase, settings: SettingsPayload, now: number): void {
  if (settings.dailyStepGoal === null && settings.birthYear === null) {
    return;
  }

  transact(db, () => {
    writeSettings(db, settings);

    enqueue(db, {
      clientOpId: mintUuidV7(db, now),
      kind: 'settings',
      payload: settings,
      createdAt: new Date(now).toISOString(),
    });
  });
}

/** GDD 11 §2.1's hard floor. The nudge copy lives with the screen; the rule lives here. */
export const MIN_DAILY_STEP_GOAL = 3000;

/**
 * GDD 11 §3.1's manual Rest Day tag, which is also GDD 2 §6's Vigor restore — one tag, one action,
 * two effects, and neither waits for the server.
 *
 * Unlimited and uncapped by design: rationing rest would contradict the constraint GDD 11 is built
 * on. The 24-hour retroactive window is the caller's, since only the client knows local midnight.
 */
export function tagRestDay(
  db: SqliteDatabase,
  activityDate: string,
  now: number,
): RestDayPayload | null {
  let payload: RestDayPayload | null = null;

  transact(db, () => {
    const player = readPlayer(db);

    if (player === null) {
      return;
    }

    const restored = restoreVigor(maxVigorFor(db, player), now);
    const taggedAt = new Date(now).toISOString();

    payload = { activityDate, vigorAfter: restored.vigorCurrent };

    writeVigor(db, restored.vigorCurrent, restored.vigorAnchorAt ?? taggedAt);
    writeRestTag(db, player.playerId, activityDate, taggedAt, player.dailyStepGoal);

    enqueue(db, {
      clientOpId: mintUuidV7(db, now),
      kind: 'rest_day',
      payload,
      createdAt: new Date(now).toISOString(),
    });
  });

  return payload;
}

export class EquipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquipError';
  }
}

/**
 * GDD 8 §2 — wear a piece in the slot its `gear_def` fits, displacing the occupant, or take it off.
 *
 * ↯ **Refused while a battle is open.** A fight reads the stat block once when it is built, so a
 * mid-fight equip would be invisible to it and its settle would write back Vigor computed from the
 * old gear — the Rest Day defect's shape (drills note 13), and the same `battle_snapshot` signal.
 *
 * Unequipping Vigor gear can leave current above the new max; it is clamped, and the clamp rides the
 * payload so the server's next player block does not restore the old number.
 */
export function equipGear(
  db: SqliteDatabase,
  playerGearId: string,
  equip: boolean,
  now: number,
): EquipPayload {
  let payload: EquipPayload = { playerGearId, equippedSlot: null, vigorAfter: null };

  transact(db, () => {
    const player = readPlayer(db);

    if (player === null) {
      throw new EquipError('No player to equip.');
    }

    if (readSnapshot(db) !== null) {
      throw new EquipError('A fight is still open.');
    }

    const piece = readOwnedGear(db).find((gear) => gear.playerGearId === playerGearId);

    if (piece === undefined) {
      throw new EquipError(`No owned gear ${playerGearId}.`);
    }

    const slot = equip ? piece.slot : null;

    // Occupant first: the slot index is unique and checked per statement.
    if (slot !== null) {
      db.runSync('UPDATE player_gear SET equipped_slot = NULL WHERE equipped_slot = ? AND id <> ?', [
        slot,
        playerGearId,
      ]);
    }

    db.runSync('UPDATE player_gear SET equipped_slot = ? WHERE id = ?', [slot, playerGearId]);

    const max = maxVigorFor(db, player);
    const vigorAfter = player.vigorCurrent > max ? max : null;

    if (vigorAfter !== null) {
      writeVigor(db, vigorAfter, new Date(now).toISOString());
    }

    payload = { playerGearId, equippedSlot: slot, vigorAfter };

    enqueue(db, {
      clientOpId: mintUuidV7(db, now),
      kind: 'equip',
      payload,
      createdAt: new Date(now).toISOString(),
    });
  });

  return payload;
}

/**
 * GDD 2 §5 — replace the skill loadout, sent whole. Null, and nothing written, while a fight is
 * open: the fight already froze its moves (`startEncounter`). The caller passes what
 * `loadoutFor` offered, so the server's own check is the backstop.
 */
export function setSkills(db: SqliteDatabase, skillIds: readonly string[], now: number): SkillsPayload | null {
  let payload: SkillsPayload | null = null;

  transact(db, () => {
    const player = readPlayer(db);

    if (player === null || readSnapshot(db) !== null) {
      return;
    }

    payload = { skillIds };

    writeStoredLoadout(db, player.playerId, skillIds);

    enqueue(db, {
      clientOpId: mintUuidV7(db, now),
      kind: 'skills',
      payload,
      createdAt: new Date(now).toISOString(),
    });
  });

  return payload;
}

/**
 * GDD 4 §4 — spend a healing item outside a fight. Null, and nothing written, when the item is not
 * a held heal, a fight is open (its snapshot already counts the satchel), or Vigour is full.
 *
 * ↯ Heals on top of the regen accrued since the anchor, so recovery is settled first; the new anchor
 * is the moment of use, as a battle's is its end.
 */
export function consumeItem(
  db: SqliteDatabase,
  playerItemId: string,
  now: number,
  dates: LocalDateResolver,
): UseItemPayload | null {
  let payload: UseItemPayload | null = null;

  transact(db, () => {
    const player = readPlayer(db);

    if (player === null || readSnapshot(db) !== null) {
      return;
    }

    const item = db.getFirstSync<{ heal_pct: number | null }>(
      `SELECT d.heal_pct FROM player_item i JOIN item_def d ON d.id = i.item_def_id
        WHERE i.id = ? AND d.category = 'heal' AND d.battle_only = 0`,
      [playerItemId],
    );

    if (item?.heal_pct == null) {
      return;
    }

    const max = maxVigorFor(db, player);
    const recovered = recoverVigor(player, max, now, dates).vigorCurrent;

    if (recovered >= max) {
      return;
    }

    // Same rounding as a heal in battle (battle/state.ts).
    const vigorAfter = Math.min(max, recovered + Math.floor((item.heal_pct / 100) * max));

    payload = { playerItemId, vigorAfter };

    spendItems(db, [playerItemId]);
    writeVigor(db, vigorAfter, new Date(now).toISOString());

    enqueue(db, {
      clientOpId: mintUuidV7(db, now),
      kind: 'use_item',
      payload,
      createdAt: new Date(now).toISOString(),
    });
  });

  return payload;
}

/**
 * GDD 9 §4.3's Explore tap — a manual roll against a segment the player has already unlocked.
 *
 * ↯ **The one write on this surface with no optimistic local effect.** Every other write here
 * changes the mirror first and replays second, because the player must see their own action. An
 * Explore roll resolves *server-side* against the shared daily pool (T2 §4 step 8), and the client
 * cannot know whether the cap has room without asking — so guessing an encounter into existence
 * would mean taking it back. What is durable immediately is the intent: the queue entry survives
 * the app being killed, and the grant lands on whichever sync reaches the server.
 */
export function requestExplore(
  db: SqliteDatabase,
  zoneId: string,
  activityDate: string,
  now: number,
): ExplorePayload {
  const payload: ExplorePayload = {
    operationId: mintUuidV7(db, now),
    zoneId,
    activityDate,
  };

  enqueue(db, {
    // The operation id *is* the outbox key, so a queued tap and its ledger entry cannot diverge.
    clientOpId: payload.operationId,
    kind: 'explore',
    payload,
    createdAt: new Date(now).toISOString(),
  });

  return payload;
}
