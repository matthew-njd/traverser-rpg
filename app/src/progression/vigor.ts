import { readEquippedGear } from '../battle/mirror';
import type { SqliteDatabase } from '../db/types';
import { MINUTE_MS, type LocalDateResolver } from '../health/localDate';
import { type MirrorPlayer, readPlayer, writeVigor } from '../sync/mirror';
import { effectiveStats } from './stats';

/**
 * GDD 2 §6 — Vigor recovery: passive regen, the daily reset, and the Rest Day restore.
 *
 * ↯ **Nothing here ticks.** Every value is derived from `vigor_anchor_at` and the current instant at
 * the moment something reads it (T4 §7.2 — no timer runs while the app is backgrounded), so a device
 * that slept nine hours recovers exactly what one left open for nine recovers.
 */

/** 1% of max per 10 minutes, so an empty bar fills in 1000 minutes whatever max is. */
const FULL_BAR_MS = 1000 * MINUTE_MS;

export interface VigorState {
  readonly vigorCurrent: number;
  /** ISO-8601, the server's. Null on a mirror that has never synced — no anchor, no regen. */
  readonly vigorAnchorAt: string | null;
}

/** GDD 2 §6's Rest Day and daily reset are the same effect, and both re-anchor. */
export function restoreVigor(maxVigor: number, now: number): VigorState {
  return { vigorCurrent: maxVigor, vigorAnchorAt: new Date(now).toISOString() };
}

export function recoverVigor(
  state: VigorState,
  maxVigor: number,
  now: number,
  dates: LocalDateResolver,
): VigorState {
  if (state.vigorAnchorAt === null) {
    return state;
  }

  const anchor = Date.parse(state.vigorAnchorAt);

  if (Number.isNaN(anchor) || now <= anchor) {
    return state;
  }

  // The daily reset outranks regen: a local midnight has passed since the anchor, so a full bar
  // covers whatever the trickle would have added. The client owns the boundary (T2 §2).
  if (dates.dateOf(anchor) !== dates.dateOf(now)) {
    return restoreVigor(maxVigor, now);
  }

  const msPerPoint = FULL_BAR_MS / maxVigor;
  const granted = Math.min(
    Math.floor((now - anchor) / msPerPoint),
    maxVigor - state.vigorCurrent,
  );

  if (granted <= 0) {
    return state;
  }

  return {
    vigorCurrent: state.vigorCurrent + granted,
    // Advanced by the time the granted points actually bought, never to `now`. One point costs 50
    // minutes at max 20, so re-anchoring to now discards most of a point on every foreground — a
    // bar that never fills for a player who opens the app often.
    vigorAnchorAt: new Date(anchor + granted * msPerPoint).toISOString(),
  };
}

/** Max Vigor is the stat block's, so it moves with allocation and with equipped gear (GDD 8 §2). */
export function maxVigorFor(db: SqliteDatabase, player: MirrorPlayer): number {
  return effectiveStats(player, readEquippedGear(db)).vigor;
}

/**
 * Settles recovery into the mirror. Called at the end of a foreground pass, which is the only clock
 * the app has (T4 §7.2) — never on a timer, and never per render.
 */
export function applyVigorRecovery(
  db: SqliteDatabase,
  now: number,
  dates: LocalDateResolver,
): void {
  const player = readPlayer(db);

  if (player === null) {
    return;
  }

  const max = maxVigorFor(db, player);
  const before = { vigorCurrent: player.vigorCurrent, vigorAnchorAt: player.vigorAnchorAt };
  const after = recoverVigor(before, max, now, dates);

  if (after.vigorCurrent !== before.vigorCurrent) {
    writeVigor(db, after.vigorCurrent, after.vigorAnchorAt ?? before.vigorAnchorAt);
  }
}
