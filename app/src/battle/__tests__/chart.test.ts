import { chartKey } from '../content';
import { resolveDamage } from '../damage';
import { rulesFor } from '../types';
import { CONTENT, divine, enemyMove, foe, physical, player } from './fixtures';
import { scriptedRng } from '../rng';

/**
 * The type chart (fixtures §1, T5 §11.1).
 *
 * All 36 cells, then the four rule guards the matrix alone cannot catch — because the matrix is
 * data and the *rule* is that it is consulted at all (T5 §3.3).
 */

/** Rows = attacker, columns = defender, in fixtures §1's own order. Transcribed once, here. */
const ORDER = ['storm', 'war', 'trickery', 'underworld', 'sea', 'wisdom'] as const;

const MATRIX: readonly (readonly number[])[] = [
  /* storm      */ [1.0, 2.0, 2.0, 1.0, 0.5, 0.5],
  /* war        */ [0.5, 1.0, 2.0, 2.0, 1.0, 0.5],
  /* trickery   */ [0.5, 0.5, 1.0, 2.0, 2.0, 1.0],
  /* underworld */ [1.0, 0.5, 0.5, 1.0, 2.0, 2.0],
  /* sea        */ [2.0, 1.0, 0.5, 0.5, 1.0, 2.0],
  /* wisdom     */ [2.0, 2.0, 1.0, 0.5, 0.5, 1.0],
];

/** No draws: the guards below all run with crit and variance off, so the multiplier stands alone. */
const DETERMINISTIC = { crit: false, randomFactor: false, fleeable: true, skillsEnabled: true, itemsEnabled: true };

describe('the seeded chart', () => {
  it('matches fixtures §1 in all 36 cells', () => {
    for (const [row, attacker] of ORDER.entries()) {
      for (const [column, defender] of ORDER.entries()) {
        expect({ attacker, defender, multiplier: CONTENT.chart.get(chartKey(attacker, defender)) }).toEqual({
          attacker,
          defender,
          multiplier: MATRIX[row]?.[column],
        });
      }
    }
  });

  /**
   * The pair GDD 6/7 call out three times as counterintuitive — and one of the twelve cells that
   * catches a transposed matrix, which would otherwise pass 24 of 36. It is also the pair most
   * likely to be "fixed" by mistake.
   */
  it('keeps the Sea/Wisdom asymmetry', () => {
    expect(CONTENT.chart.get(chartKey('wisdom', 'sea'))).toBe(0.5);
    expect(CONTENT.chart.get(chartKey('sea', 'wisdom'))).toBe(2.0);
  });
});

describe('when the chart is consulted', () => {
  const hit = (input: Parameters<typeof resolveDamage>[0]) => resolveDamage(input);

  /**
   * The rule that survives no summary: enemies carry types so the *player's* moves can be scored
   * against them, and the table is never entered from the other side. Asserted from both an
   * advantaged row (Storm) and a disadvantaged one (Underworld), because a naive implementation
   * that looked the attacker up would produce a wrong answer in opposite directions for each.
   */
  it('is not consulted when the enemy attacks, from either side of the chart', () => {
    for (const [enemyId, moveId] of [
      ['enemy_harpy', 'emove_gust_strike'],
      ['enemy_cerberus', 'emove_death_breath'],
    ] as const) {
      const move = enemyMove(enemyId, moveId);

      const result = hit({
        move,
        attacker: foe(null, { stats: { favor: 20, might: 20 } }),
        defender: player({ stats: { aegis: 10, resolve: 10 } }),
        chart: CONTENT.chart,
        rules: DETERMINISTIC,
        rng: scriptedRng([]),
      });

      expect({ moveId, typeMultiplier: result.typeMultiplier }).toEqual({ moveId, typeMultiplier: 1 });
    }
  });

  it('is not consulted for a Physical move in either direction', () => {
    const outgoing = hit({
      move: physical(40),
      attacker: player({ stats: { might: 30 } }),
      defender: foe('trickery', { stats: { resolve: 10 } }),
      chart: CONTENT.chart,
      rules: DETERMINISTIC,
      rng: scriptedRng([]),
    });

    const incoming = hit({
      move: physical(40),
      attacker: foe('storm', { stats: { might: 30 } }),
      defender: player({ stats: { resolve: 10 } }),
      chart: CONTENT.chart,
      rules: DETERMINISTIC,
      rng: scriptedRng([]),
    });

    expect(outgoing.typeMultiplier).toBe(1);
    expect(incoming.typeMultiplier).toBe(1);
  });

  /** The Waystone Wisp is typeless, so the tutorial needs no special case (T5 §7.4). */
  it('is not consulted against a typeless enemy', () => {
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe(null, { stats: { aegis: 18 } }),
      chart: CONTENT.chart,
      rules: DETERMINISTIC,
      rng: scriptedRng([]),
    });

    expect(result.typeMultiplier).toBe(1);
  });

  it('is consulted for the player’s own typed attack', () => {
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('war', { stats: { aegis: 18 } }),
      chart: CONTENT.chart,
      rules: DETERMINISTIC,
      rng: scriptedRng([]),
    });

    expect(result.typeMultiplier).toBe(2);
  });
});
