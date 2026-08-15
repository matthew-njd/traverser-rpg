import type { MintedDelta } from '../health/deltas';
import type { PlayerState } from './dto';

/**
 * tech-02 §5 / tech-04 §8.4 — the optimistic preview.
 *
 * XP and Leagues are shown the instant a delta is minted. On response the server's numbers
 * **replace** the projection outright — never added to, never reconciled. Server wins.
 *
 * GDD 1 §2's *rates* are duplicated here because a projection cannot exist without them. The
 * level curve and the level-up are **not**: a Reveal Card that un-happens is the worst artefact this
 * design can produce (tech-04 §8.4). Discarding rather than reconciling keeps the duplication bounded.
 */

/** GDD 1 §2.1. */
export const STEPS_PER_XP = 20;

/** GDD 1 §2.2 — Moderate, Vigorous, Peak. */
export const TIER_XP_PER_MINUTE: Readonly<Record<number, number>> = { 1: 3, 2: 5, 3: 7 };

/** GDD 9 §2.1 — the Waymarker. Derived on read, never stored, on both sides. */
export const STEPS_PER_LEAGUE = 1000;

export const leaguesFor = (lifetimeSteps: number): number =>
  Math.floor(lifetimeSteps / STEPS_PER_LEAGUE);

export interface ProjectedGains {
  readonly steps: number;
  readonly xp: number;
}

/**
 * Tier 3's 20-minute cap is not applied — it is evaluated against the day's post-merge total
 * (tech-03 §5.5), which this device cannot know. A hard Peak day projects high and settles.
 */
export function projectGains(deltas: readonly MintedDelta[]): ProjectedGains {
  let steps = 0;
  let xp = 0;

  for (const delta of deltas) {
    steps += delta.stepsDelta;
    xp += Math.floor(delta.stepsDelta / STEPS_PER_XP);

    if (delta.hrTier !== null) {
      xp += (TIER_XP_PER_MINUTE[delta.hrTier] ?? 0) * delta.minutesDelta;
    }
  }

  return { steps, xp };
}

/** The projected slice of the mirror. Everything else on the player row is the server's alone. */
export interface ProjectedState {
  readonly xpCurrent: number;
  readonly xpLifetime: number;
  readonly lifetimeSteps: number;
}

/**
 * Applies gains without ever crossing a level boundary.
 *
 * Level-ups are never projected — the server owns the curve (tech-02 §1.1). XP clamps at the
 * threshold; the bar fills and stops and the response supplies the level-up and the carry.
 *
 * At Level 60 nothing is projected: `xp_to_next` is null, meaning accrual has stopped with
 * nothing banked (GDD 1 §4). Steps still accumulate — Leagues keep going past 60.
 */
export function projectState(current: PlayerState, gains: ProjectedGains): ProjectedState {
  const lifetimeSteps = current.lifetimeSteps + gains.steps;

  if (current.xpToNext === null) {
    return { xpCurrent: current.xpCurrent, xpLifetime: current.xpLifetime, lifetimeSteps };
  }

  const room = Math.max(0, current.xpToNext - current.xpCurrent);

  return {
    // Clamped: the bar fills and stops rather than guessing a level.
    xpCurrent: current.xpCurrent + Math.min(gains.xp, room),
    // Not clamped — `xp_lifetime` is cumulative and needs no curve to be right.
    xpLifetime: current.xpLifetime + gains.xp,
    lifetimeSteps,
  };
}
