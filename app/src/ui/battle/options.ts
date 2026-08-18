import type { TypeChart } from '../../battle/content';
import { chartKey } from '../../battle/content';
import type { Move } from '../../battle/types';
import { type Labels, labelFor } from '../../content/labels';
import type { SkillOption } from './ActionMenu';
import { chevronFor } from './log';

/**
 * Turning the engine's moves into the rows GDD 13 §6.2's Skill sub-menu shows.
 *
 * The chevron is computed from the same chart the damage pipeline reads, against the same pair of
 * types — which is what makes the hint and the post-hit callout agree by construction rather than by
 * two implementations happening to match.
 */
export function skillOptions(input: {
  readonly moves: readonly Move[];
  readonly uses: Readonly<Record<string, number>>;
  readonly chart: TypeChart;
  readonly enemyTypeId: string | null;
  readonly labels: Labels;
  /** GDD 13 §6.2 — withheld until this enemy has been *fought* once, not merely sighted. */
  readonly chevronsUnlocked: boolean;
}): SkillOption[] {
  const { moves, uses, chart, enemyTypeId, labels, chevronsUnlocked } = input;

  return moves.map((move) => {
    const usesLeft = uses[move.id];

    return {
      moveId: move.id,
      label: labelFor(labels, move.id),
      usesLeft: usesLeft === undefined ? null : usesLeft,
      chevron: hintFor(move, chart, enemyTypeId, labels, chevronsUnlocked),
    };
  });
}

/**
 * ↯ The chart is consulted **only** for the player's own Divine moves against a typed enemy (T5
 * §3.3). A Physical move never takes a multiplier in either direction, and the Wisp is typeless — in
 * both cases there is no hint to give, and inventing a "×1.0" one would teach the wrong rule.
 */
function hintFor(
  move: Move,
  chart: TypeChart,
  enemyTypeId: string | null,
  labels: Labels,
  unlocked: boolean,
): SkillOption['chevron'] {
  if (!unlocked || move.category !== 'divine' || move.typeId === null || enemyTypeId === null) {
    return null;
  }

  const multiplier = chart.get(chartKey(move.typeId, enemyTypeId));

  return multiplier === undefined
    ? null
    : chevronFor(multiplier, labelFor(labels, move.typeId), labelFor(labels, enemyTypeId));
}
