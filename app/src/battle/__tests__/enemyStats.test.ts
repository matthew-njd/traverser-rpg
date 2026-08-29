import { enemyStatsAt } from '../content';
import { enemy } from './fixtures';

/**
 * Enemy stats at reference levels — all 36 rows of fixtures §6, `floor(base + rate × L)`.
 *
 * Sourced from the content bundle rather than hardcoded scaling, so this also catches a bad seed:
 * if the migration's `enemy_stat_scaling` rows drift from the GDD, every row here moves.
 */

/** Transcribed from fixtures §6, in its own order. Vigor, Might, Resolve, Favor, Aegis, Stride. */
const ROWS: readonly [string, number, number, number, number, number, number, number][] = [
  ['enemy_harpy', 5, 26, 6, 6, 9, 7, 15],
  ['enemy_harpy', 15, 34, 8, 8, 13, 12, 25],
  ['enemy_harpy', 30, 46, 12, 12, 20, 20, 40],
  ['enemy_satyr', 5, 23, 7, 8, 8, 8, 11],
  ['enemy_satyr', 15, 29, 11, 13, 12, 13, 19],
  ['enemy_satyr', 30, 39, 16, 21, 18, 21, 30],
  ['enemy_cyclops', 10, 45, 12, 13, 10, 12, 7],
  ['enemy_cyclops', 15, 49, 14, 15, 12, 14, 8],
  ['enemy_cyclops', 30, 63, 19, 23, 17, 22, 12],
  ['enemy_cerberus', 15, 61, 13, 14, 13, 15, 8],
  ['enemy_cerberus', 20, 67, 15, 17, 15, 18, 10],
  ['enemy_cerberus', 30, 77, 18, 22, 18, 23, 12],
  ['enemy_draugr', 15, 31, 10, 16, 10, 13, 12],
  ['enemy_draugr', 25, 36, 13, 22, 13, 18, 17],
  ['enemy_draugr', 35, 41, 15, 28, 17, 23, 22],
  ['enemy_valkyrie', 15, 30, 9, 9, 16, 13, 26],
  ['enemy_valkyrie', 25, 35, 12, 12, 21, 18, 36],
  ['enemy_valkyrie', 35, 41, 15, 15, 26, 23, 46],
  ['enemy_fenrir', 20, 70, 19, 20, 17, 17, 20],
  ['enemy_fenrir', 25, 75, 21, 23, 19, 19, 23],
  ['enemy_fenrir', 35, 86, 25, 29, 23, 24, 29],
  ['enemy_jormungandr', 28, 91, 19, 13, 24, 24, 12],
  ['enemy_jormungandr', 31, 95, 20, 14, 25, 26, 12],
  ['enemy_jormungandr', 40, 107, 24, 17, 30, 32, 15],
  ['enemy_strix', 33, 47, 17, 22, 22, 22, 35],
  ['enemy_strix', 45, 55, 21, 28, 28, 28, 45],
  ['enemy_strix', 60, 65, 27, 36, 35, 36, 57],
  ['enemy_lemures', 33, 40, 15, 31, 16, 26, 24],
  ['enemy_lemures', 45, 46, 18, 39, 20, 34, 30],
  ['enemy_lemures', 60, 54, 22, 50, 26, 43, 39],
  ['enemy_griffin', 44, 79, 26, 33, 27, 37, 40],
  ['enemy_griffin', 50, 84, 29, 36, 30, 41, 45],
  ['enemy_griffin', 60, 93, 33, 42, 34, 48, 52],
  ['enemy_cacus', 54, 113, 34, 37, 36, 41, 24],
  ['enemy_cacus', 57, 116, 35, 39, 37, 43, 25],
  ['enemy_cacus', 60, 120, 37, 41, 39, 45, 26],
];

describe('fixtures §6 — enemy stats at reference levels', () => {
  it('matches all 36 rows', () => {
    for (const [id, level, vigor, might, resolve, favor, aegis, stride] of ROWS) {
      expect({ id, level, ...enemyStatsAt(enemy(id), level) }).toEqual({
        id,
        level,
        vigor,
        might,
        resolve,
        favor,
        aegis,
        stride,
      });
    }
  });

  /**
   * ↯ The reason `enemyStatsAt` works in thousandths rather than in the parsed decimals. Binary
   * floating point lands `base + rate × L` just below an exact integer often enough to matter, and
   * a stat one point low is invisible in play and wrong in every fight thereafter.
   *
   * `0.58 × 50` is the demonstration: exactly 29, and 28.999999999999996 in IEEE 754. No current
   * roster row hits one of these — all 36 above pass either way — which is exactly why the guard is
   * worth keeping. The next content edit gets it for free instead of shipping a silently wrong stat.
   */
  it('does not lose a point to floating-point drift', () => {
    expect(Math.floor(0.58 * 50)).toBe(28);

    expect(
      enemyStatsAt(
        { ...enemy('enemy_harpy'), scaling: [{ stat: 'might', baseMilli: 0, rateMilli: 580 }] },
        50,
      ).might,
    ).toBe(29);
  });
});
