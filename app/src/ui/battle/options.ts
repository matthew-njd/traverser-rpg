import type { TypeChart } from '../../battle/content';
import { chartKey } from '../../battle/content';
import { LOADOUT_SLOTS } from '../../battle/session';
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
      category: move.category,
      typeLabel: move.typeId === null ? null : labelFor(labels, move.typeId),
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

/** GDD 2 §5 / GDD 3 §2.4 — the loadout is four slots, filled or not. */
export const SKILL_SLOTS = LOADOUT_SLOTS;

/**
 * A slot in GDD 13 §6.1's grid: an unlocked skill, or the level that will fill it.
 *
 * ↯ **A locked slot and a spent one must never read alike.** A spent slot shows `0 left` and is
 * disabled because it has been used; a locked slot shows a level and is disabled because it does
 * not exist yet. Collapsing either into "greyed out" is how a player concludes their skills are
 * gone (§6.1, amended 2026-08-22).
 */
export type Slot = { readonly kind: 'skill'; readonly skill: SkillOption } | {
  readonly kind: 'locked';
  readonly unlockLevel: number;
};

/**
 * The four slots, in unlock order: everything unlocked, then the levels that fill what is left.
 *
 * Levels 1–3 hold no skills at all (GDD 3 §2.4) and that is when GDD 10's tutorial runs, so the
 * four-locked case is the **first** battle screen a player ever sees rather than an edge case.
 *
 * `skills` is the loadout the fight was built with (`offeredMoves`), so it is never more than four.
 */
export function slotsFor(
  skills: readonly SkillOption[],
  allSkills: readonly { readonly id: string; readonly unlockLevel: number }[],
  level: number,
): readonly Slot[] {
  const filled: Slot[] = skills.slice(0, SKILL_SLOTS).map((skill) => ({ kind: 'skill', skill }));

  const upcoming = allSkills
    .filter((skill) => skill.unlockLevel > level)
    .sort((left, right) => left.unlockLevel - right.unlockLevel || left.id.localeCompare(right.id))
    .slice(0, SKILL_SLOTS - filled.length)
    .map((skill): Slot => ({ kind: 'locked', unlockLevel: skill.unlockLevel }));

  return [...filled, ...upcoming];
}
