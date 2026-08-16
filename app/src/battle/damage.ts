import type { StatDeltas } from '../sync/writes';
import { type TypeChart, chartKey } from './content';
import type { Rng } from './rng';
import type { BattleRules, Combatant, ConsumableEffect, Move } from './types';

/**
 * The damage pipeline, normatively per T5 §3.2 — **not** per GDD 2 §7's formula line, which §3.1
 * corrects in favour of the GDD's own worked example.
 *
 * ↯ **The double floor.** `base` floors the quotient *first*; the multipliers then apply to that
 * integer and the result floors again. A single-flooring engine passes four of the five fixture
 * cases in §10.1 — the two neutral rows are exact and cannot distinguish the readings — and fails
 * only the super-effective one, returning 27 where the fixture says 26. Neither floor may move.
 */

export const CRIT_CHANCE = 0.0625;
export const CRIT_MULTIPLIER = 1.5;
export const RANDOM_FLOOR = 0.9;
export const RANDOM_SPREAD = 0.2;

export interface DamageResult {
  /** The floored quotient, before any multiplier. Carried out so tests can pin §10.1 directly. */
  readonly base: number;
  readonly damage: number;
  /** On the result rather than recomputed by the UI, so the callout cannot disagree (T5 §9). */
  readonly typeMultiplier: number;
  readonly wasCrit: boolean;
  /** What this hit used up. The caller applies it — the pipeline stays pure (T5 §6). */
  readonly consumed: readonly ConsumableEffect[];
}

function attackStat(stats: StatDeltas, move: Move): number {
  return move.category === 'physical' ? stats.might : stats.favor;
}

function defenceStat(stats: StatDeltas, move: Move): number {
  return move.category === 'physical' ? stats.resolve : stats.aegis;
}

/**
 * The type rule as the engine sees it (T5 §3.3): the chart is consulted **if and only if** the
 * attacker is the player, the move is Divine, and the defender has a type. Every other combination
 * is ×1.0 — an enemy's Divine move never enters the table, and a Physical move never does in either
 * direction.
 *
 * Breach **forces** 2.0 rather than multiplying by it, so an already-super-effective hit is
 * unchanged at ×2.0 rather than reaching ×4.0 (GDD 4 §2.3), and the charm is still consumed.
 */
function typeMultiplierFor(
  move: Move,
  attacker: Combatant,
  defender: Combatant,
  chart: TypeChart,
): { multiplier: number; breached: boolean } {
  if (attacker.side !== 'player' || move.category !== 'divine' || move.typeId === null) {
    return { multiplier: 1, breached: false };
  }

  const breached = defender.effects.breach !== null && defender.effects.breach === move.typeId;

  if (defender.typeId === null) {
    // The Waystone Wisp. A Breach charm still resolves against it — the charm forces the value and
    // does not consult the chart, so there is nothing typeless about the enemy for it to fail on.
    return breached ? { multiplier: 2, breached } : { multiplier: 1, breached: false };
  }

  if (breached) {
    return { multiplier: 2, breached };
  }

  const looked = chart.get(chartKey(move.typeId, defender.typeId));

  if (looked === undefined) {
    // Unreachable: `battleContentFrom` proves the chart complete at construction. Kept as a throw
    // rather than a `?? 1` because a silent ×1.0 here is a wrong number nobody would ever see.
    throw new Error(`the type chart is missing ${move.typeId} → ${defender.typeId}`);
  }

  return { multiplier: looked, breached: false };
}

/**
 * Resolves one hit.
 *
 * Draws are taken lazily and in T5 §4.1's order — **crit first, then the random factor** — and a
 * rule that does not apply takes no draw at all. That is what makes the tutorial's determinism a
 * rule flag rather than a rigged RNG (§1.2): under `TUTORIAL_RULES` this function touches the Rng
 * zero times, which a `ScriptedRng` with an empty queue proves.
 */
export function resolveDamage(input: {
  readonly move: Move;
  readonly attacker: Combatant;
  readonly defender: Combatant;
  readonly chart: TypeChart;
  readonly rules: BattleRules;
  readonly rng: Rng;
}): DamageResult {
  const { move, attacker, defender, chart, rules, rng } = input;

  const base = Math.floor(
    (move.power * attackStat(attacker.stats, move)) / (defenceStat(defender.stats, move) * 8),
  );

  const consumed: ConsumableEffect[] = [];

  // GDD 4 §2.3 — a Surge charm boosts only a Divine move of its own type. Arming Stormveil and then
  // swinging Iron Advance neither consumes the charm nor boosts the swing (fixtures §10.5).
  const surged =
    move.category === 'divine' &&
    move.typeId !== null &&
    attacker.effects.surge === move.typeId;

  if (surged) {
    consumed.push('surge');
  }

  const { multiplier: type, breached } = typeMultiplierFor(move, attacker, defender, chart);

  if (breached) {
    consumed.push('breach');
  }

  if (defender.effects.rend) {
    consumed.push('rend');
  }

  // Fortify is player-side only (T5 §6) — an enemy holding it would halve incoming damage in a
  // fight where nothing can grant it, so the side check is the flag's real definition.
  const fortified = defender.side === 'player' && defender.effects.fortify;

  if (fortified) {
    consumed.push('fortify');
  }

  if (attacker.effects.weaken) {
    consumed.push('weaken');
  }

  const wasCrit = rules.crit && rng.next() < CRIT_CHANCE;
  const random = rules.randomFactor ? RANDOM_FLOOR + rng.next() * RANDOM_SPREAD : 1;

  const damage = Math.max(
    1,
    Math.floor(
      base *
        (surged ? 1.5 : 1) *
        type *
        (defender.effects.rend ? 1.5 : 1) *
        (fortified ? 0.5 : 1) *
        (attacker.effects.weaken ? 0.5 : 1) *
        (wasCrit ? CRIT_MULTIPLIER : 1) *
        random,
    ),
  );

  return { base, damage, typeMultiplier: type, wasCrit, consumed };
}
