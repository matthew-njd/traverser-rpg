import { enqueue } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import { mintUuidV7 } from '../health/deltaId';
import type { AllocationPayload, SettingsPayload } from './dto';
import { readPlayer, writeSettings } from './mirror';

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
