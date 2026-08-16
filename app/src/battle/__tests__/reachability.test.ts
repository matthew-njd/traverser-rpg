import { chartKey } from '../content';
import { CONTENT } from './fixtures';

/**
 * **Type reachability** — the test M1 owed to M2 (`traverser-m1-plan.md` §6, DECISIONS 2026-08-15).
 *
 * For every enemy type, the level at which the player first holds a 2× answer, against the level
 * where an enemy of that type first appears. It belongs here because this is the first place that
 * holds the chart, the unlock ladder and the enemy roster at once — reachability exists only in
 * that join, and fixtures §1's tests all check the matrix in isolation.
 *
 * ↯ **This is a property of the content, not of the code.** It fails when a *balance* decision is
 * wrong, which is why the known gap below is an exemption rather than a fix: the levers (encounter
 * weighting, a skill's type, an unlock level) are all GDD calls, and CLAUDE.md forbids changing
 * locked content to make a test pass.
 */

/**
 * The level by which a player is expected to be meeting each zone's enemies, from fixtures §6's
 * reference levels — Olympion's roster is tabulated at 5–15, Valheon's at 15–35, Imperion's at
 * 33–60. Deliberately generous: the question is whether an answer exists *within the zone at all*,
 * not whether it arrives on the first encounter.
 */
const ZONE_HORIZON: Readonly<Record<string, number>> = {
  olympion: 15,
  valheon: 35,
  imperion: 60,
};

/**
 * Known gaps, each with the entry that recorded it. An exemption must **still be failing** for the
 * test to accept it — otherwise a content fix would leave a stale exemption behind, quietly
 * covering the next regression.
 */
const EXEMPTIONS: readonly { typeId: string; zoneId: string; because: string }[] = [
  {
    typeId: 'storm',
    zoneId: 'olympion',
    because:
      'DECISIONS 2026-08-15 — storm has no 2× answer until skill_tidecallers_grasp at L36, and ' +
      'enemy_harpy is an Olympion wild encounter. A GDD balance call, not an engine defect.',
  },
  {
    typeId: 'storm',
    zoneId: 'valheon',
    because: 'DECISIONS 2026-08-15 — the same gap, extended across the mid-game by enemy_valkyrie.',
  },
];

/** The earliest level at which the player holds any move that is 2× against `defenderTypeId`. */
function firstAnswerLevel(defenderTypeId: string): number | null {
  const levels = CONTENT.skills
    .filter(
      (candidate) =>
        candidate.typeId !== null &&
        CONTENT.chart.get(chartKey(candidate.typeId, defenderTypeId)) === 2,
    )
    .map((candidate) => candidate.unlockLevel);

  return levels.length === 0 ? null : Math.min(...levels);
}

describe('every enemy type has an answer by the time it is met', () => {
  const encounters = [...CONTENT.enemies.values()]
    .filter((candidate) => candidate.typeId !== null && candidate.zoneId !== null)
    .map((candidate) => ({
      enemyId: candidate.id,
      typeId: candidate.typeId!,
      zoneId: candidate.zoneId!,
    }));

  it('covers every typed, zoned enemy in the roster', () => {
    expect(encounters.length).toBeGreaterThan(0);

    for (const encounter of encounters) {
      expect(ZONE_HORIZON[encounter.zoneId]).toBeDefined();
    }
  });

  it('unlocks a 2× answer no later than the zone horizon, except where exempted', () => {
    const unexpected: string[] = [];

    for (const { enemyId, typeId, zoneId } of encounters) {
      const horizon = ZONE_HORIZON[zoneId] ?? Number.POSITIVE_INFINITY;
      const answer = firstAnswerLevel(typeId);
      const reachable = answer !== null && answer <= horizon;

      if (reachable) {
        continue;
      }

      const exempt = EXEMPTIONS.some(
        (entry) => entry.typeId === typeId && entry.zoneId === zoneId,
      );

      if (!exempt) {
        unexpected.push(
          `${enemyId} (${typeId}, ${zoneId}): first 2× answer at ${answer ?? 'never'}, ` +
            `zone horizon ${horizon}`,
        );
      }
    }

    expect(unexpected).toEqual([]);
  });

  /**
   * The exemptions are asserted to still be true. A content change that closes one of these gaps
   * should delete its entry here, and this is what makes that a failing test rather than a silent
   * loss of coverage.
   */
  it('keeps no exemption that has stopped being necessary', () => {
    const stale = EXEMPTIONS.filter((entry) => {
      const horizon = ZONE_HORIZON[entry.zoneId] ?? Number.POSITIVE_INFINITY;
      const answer = firstAnswerLevel(entry.typeId);

      return answer !== null && answer <= horizon;
    });

    expect(stale).toEqual([]);
  });

  /**
   * The specific finding, pinned by value so the exemption above is anchored to a number rather
   * than to a mood. Only Sea and Wisdom answer Storm at 2×, and the first of either is L36.
   */
  it('records the storm gap exactly: no answer before level 36', () => {
    expect(firstAnswerLevel('storm')).toBe(36);

    const answers = CONTENT.skills
      .filter(
        (candidate) =>
          candidate.typeId !== null && CONTENT.chart.get(chartKey(candidate.typeId, 'storm')) === 2,
      )
      .map((candidate) => candidate.id);

    expect(answers.sort()).toEqual(['skill_sages_verdict', 'skill_tidecallers_grasp']);
  });
});
