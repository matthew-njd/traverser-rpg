import { create } from 'zustand';

import type { SqliteDatabase } from '../db/types';
import type { Streak } from '../sync/dto';
import { type MirrorPlayer, readPlayer, readStreak } from '../sync/mirror';
import { leaguesFor } from '../sync/projection';

/**
 * L3's hot slice (tech-04 §5.2) — a **hydrated projection of the mirror**, so screens read
 * synchronously without touching SQLite on every render.
 *
 * ↯ The rule that keeps this from rotting: **SQLite is written first, always.** The store is a cache
 * of a cache and may be stale in exactly one direction — SQLite is never behind it. Any read path
 * that could observe the store mid-write reads SQLite instead. On the web a `useState` plus a fetch
 * is usually enough because a reload rebuilds everything from the server; here a reload rebuilds
 * from a local database that is itself the source of truth between syncs.
 *
 * ↯ Only the small, hot slice lives here. The activity log, the bestiary and the item grid are
 * queried on demand and never mirrored into the store — paging a growing table into memory is how a
 * store becomes the thing that has to be invalidated.
 */
export interface PlayerSlice {
  /** False until registration has written a player row — the first-launch signal for the router. */
  readonly registered: boolean;
  readonly traverserName: string;
  readonly level: number;
  readonly xpCurrent: number;
  /** Null at Level 60; the XP bar renders MAX off it (GDD 1 §4). */
  readonly xpToNext: number | null;
  readonly xpLifetime: number;
  readonly unspentStatPoints: number;
  readonly vigorCurrent: number;
  readonly lifetimeSteps: number;
  readonly leagues: number;
  readonly dailyStepGoal: number;
  readonly streak: Streak;
  /**
   * ↯ The displayed numbers include an optimistic projection (tech-04 §8.4). Available so a screen
   * *could* know — but it must not annotate: a correction animates on the same component with the
   * same transition as any other value change, and a correction that reduces a displayed number is
   * applied with **no indicator of any kind**. The player never learns a projection was optimistic;
   * that is the entire point.
   */
  readonly provisional: boolean;
}

export const EMPTY_PLAYER: PlayerSlice = {
  registered: false,
  traverserName: '',
  level: 1,
  xpCurrent: 0,
  xpToNext: null,
  xpLifetime: 0,
  unspentStatPoints: 0,
  vigorCurrent: 20,
  lifetimeSteps: 0,
  leagues: 0,
  dailyStepGoal: 7000,
  streak: { current: 0, longest: 0, lastCreditedDate: null },
  provisional: false,
};

export function sliceFrom(player: MirrorPlayer | null, streak: Streak): PlayerSlice {
  if (player === null) {
    return EMPTY_PLAYER;
  }

  return {
    registered: true,
    traverserName: player.traverserName,
    level: player.level,
    xpCurrent: player.xpCurrent,
    xpToNext: player.xpToNext,
    xpLifetime: player.xpLifetime,
    unspentStatPoints: player.unspentStatPoints,
    vigorCurrent: player.vigorCurrent,
    lifetimeSteps: player.lifetimeSteps,
    leagues: leaguesFor(player.lifetimeSteps),
    dailyStepGoal: player.dailyStepGoal,
    streak,
    provisional: player.provisional,
  };
}

interface PlayerStore extends PlayerSlice {
  /**
   * Re-reads the mirror. Called at boot (tech-04 §7.1 step 4) and after **every** write to the
   * mirror — there is no path that updates the store alone, because that is how the two start
   * disagreeing.
   */
  hydrate(db: SqliteDatabase): void;
  reset(): void;
}

export const usePlayerStore = create<PlayerStore>((set) => ({
  ...EMPTY_PLAYER,

  hydrate(db) {
    set(sliceFrom(readPlayer(db), readStreak(db)));
  },

  reset() {
    set(EMPTY_PLAYER);
  },
}));
