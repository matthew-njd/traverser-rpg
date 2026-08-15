import { create } from 'zustand';

import type { SqliteDatabase } from '../db/types';
import type { Streak } from '../sync/dto';
import { type MirrorPlayer, readPlayer, readStreak } from '../sync/mirror';
import { leaguesFor } from '../sync/projection';

/**
 * L3's hot slice (tech-04 §5.2) — a **hydrated projection of the mirror**, so screens read
 * synchronously without touching SQLite on every render.
 *
 * SQLite is written first, always. The store may be stale in exactly one direction — SQLite is
 * never behind it — and any read that could observe a mid-write store reads SQLite instead.
 *
 * Only the small hot slice lives here; growing tables are queried on demand, because paging one
 * into memory is how a store becomes the thing that has to be invalidated.
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
   * The numbers include an optimistic projection (tech-04 §8.4). Exposed so a screen *could* know,
   * but it must not annotate — a downward correction lands with no indicator of any kind.
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
  /** Re-reads the mirror. No path updates the store alone — that is how the two start disagreeing. */
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
