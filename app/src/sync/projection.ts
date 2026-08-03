import type { MintedDelta } from '../health/deltas';
import type { PlayerState } from './dto';

/**
 * tech-02 §5 / tech-04 §8.4 — the optimistic preview.
 *
 * The client projects XP and Leagues the instant a delta is minted and shows them immediately;
 * waiting for a PC that may be off is not an option. On response **the server's numbers replace the
 * projection outright** — never added to, never treated as an error when lower, never re-queued to
 * make up a difference. Server wins for all progression, unconditionally.
 *
 * ↯ What is duplicated here and what is not. GDD 1 §2's *rates* are duplicated — 1 XP per 20 steps,
 * 3/5/7 per tier minute — because a projection cannot exist without them. **The level curve is
 * not**, and neither is the level-up: tech-04 §8.4 calls a Reveal Card celebrating a level-up that
 * then un-happens "the single worst reconciliation artefact this design can produce". The projection
 * is discarded on response rather than reconciled, which is what keeps this duplication bounded.
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
 * ↯ Tier 3's 20-minute daily cap is **not** applied. It is evaluated server-side against the day's
 * post-merge cumulative total (tech-03 §5.5), which this device does not know — its mirror lags by
 * exactly the sync that has not happened yet. A hard Peak day therefore projects slightly high and
 * settles down when the response lands, which is precisely the quiet correction §8.4 designs for.
 * Guessing the cap here would replace an over-projection that corrects with a wrong number that
 * looks authoritative.
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
 * Applies gains to the current mirror values without ever crossing a level boundary.
 *
 * ↯ **Level-ups are never projected.** The server owns the curve (tech-02 §1.1), so a projection
 * that reached `xp_to_next` would have to guess both the new level and the carried remainder. XP is
 * clamped at the threshold instead: the bar fills and stops, and the response supplies the level-up
 * and the carry.
 *
 * ↯ **At Level 60 nothing is projected at all.** `xp_to_next` is null there, which is the schema's
 * way of saying accrual has stopped with nothing banked (GDD 1 §4, and the non-negotiable rule in
 * CLAUDE.md). Steps still accumulate — Leagues and the Waymarker keep going long past 60.
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
    // Not clamped — `xp_lifetime` is cumulative and needs no curve to be right, so a gain that
    // crosses a level boundary still counts here in full.
    xpLifetime: current.xpLifetime + gains.xp,
    lifetimeSteps,
  };
}
