import { parseBundle } from '../../../content/bundle';
import { EMBEDDED_BUNDLE } from '../../../content/embedded.generated';
import type { SkillOption } from '../ActionMenu';
import { SKILL_SLOTS, slotsFor } from '../options';

/**
 * GDD 13 §6.1's four slots, derived from the real unlock ladder rather than a hand-written one —
 * the levels a locked slot shows are content, so a rebalance has to move them here too.
 */
const ALL_SKILLS = parseBundle(EMBEDDED_BUNDLE).tables.player_skill_def.map((row) => ({
  id: String(row.id),
  unlockLevel: Number(row.unlock_level),
}));

const option = (moveId: string): SkillOption => ({
  moveId,
  label: moveId,
  usesLeft: 4,
  chevron: null,
});

/**
 * Basic Attack never reaches a slot — it is the circle at the centre, and the screen filters it out
 * by having no per-battle limit rather than by its id. The slots see only the rest.
 */
const unlockedAt = (level: number) =>
  ALL_SKILLS.filter((entry) => entry.unlockLevel <= level && entry.id !== 'skill_basic_attack').map(
    (entry) => option(entry.id),
  );

describe('slotsFor', () => {
  /** GDD 3 §2.4 — Levels 1–3 have zero skills, which is when GDD 10's tutorial runs. */
  it('fills every slot with a level at Level 1', () => {
    const slots = slotsFor([], ALL_SKILLS, 1);

    expect(slots).toHaveLength(SKILL_SLOTS);
    expect(slots.map((slot) => (slot.kind === 'locked' ? slot.unlockLevel : null))).toEqual([
      4, 6, 10, 16,
    ]);
  });

  /** §2.4's ladder: one of four fillable at 4–5, two at 6–9, three at 10–15, four at 16+. */
  it.each`
    level | filled | firstLocked
    ${4}  | ${1}   | ${6}
    ${6}  | ${2}   | ${10}
    ${10} | ${3}   | ${16}
  `('shows $filled filled and the rest locked at Level $level', ({ level, filled, firstLocked }) => {
    const unlocked = unlockedAt(level as number);

    const slots = slotsFor(unlocked, ALL_SKILLS, level as number);
    const locked = slots.filter((slot) => slot.kind === 'locked');

    expect(slots).toHaveLength(SKILL_SLOTS);
    expect(slots.filter((slot) => slot.kind === 'skill')).toHaveLength(filled as number);
    expect(locked[0]?.kind === 'locked' ? locked[0].unlockLevel : null).toBe(firstLocked);
  });

  it('is four filled slots and nothing locked once four are unlocked', () => {
    const unlocked = unlockedAt(16);

    expect(slotsFor(unlocked, ALL_SKILLS, 16).every((slot) => slot.kind === 'skill')).toBe(true);
  });

  /**
   * ↯ Above Level 22 there are more unlocked skills than slots and GDD 2 §5 makes the loadout a
   * choice. The equip flow is unbuilt, so the first four by unlock order stand in for it — this
   * pins that the *extra* skills are dropped rather than the slots overflowing.
   */
  it('never returns more than four slots however many skills are unlocked', () => {
    const unlocked = unlockedAt(60);

    expect(slotsFor(unlocked, ALL_SKILLS, 60)).toHaveLength(SKILL_SLOTS);
  });

  it('locks in unlock order, not content order', () => {
    const levels = slotsFor([], ALL_SKILLS, 1).map((slot) =>
      slot.kind === 'locked' ? slot.unlockLevel : 0,
    );

    expect([...levels].sort((left, right) => left - right)).toEqual(levels);
  });
});
