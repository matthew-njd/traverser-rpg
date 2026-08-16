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
  ['enemy_harpy', 5, 23, 6, 6, 10, 7, 15],
  ['enemy_harpy', 15, 53, 8, 8, 18, 12, 25],
  ['enemy_harpy', 30, 98, 12, 12, 29, 20, 40],
  ['enemy_satyr', 5, 20, 8, 8, 10, 8, 11],
  ['enemy_satyr', 15, 45, 13, 13, 18, 13, 19],
  ['enemy_satyr', 30, 83, 21, 21, 29, 21, 30],
  ['enemy_cyclops', 10, 60, 20, 15, 12, 12, 7],
  ['enemy_cyclops', 15, 82, 25, 19, 14, 14, 8],
  ['enemy_cyclops', 30, 150, 40, 30, 22, 22, 12],
  ['enemy_cerberus', 15, 102, 20, 14, 19, 15, 8],
  ['enemy_cerberus', 20, 130, 24, 17, 23, 18, 10],
  ['enemy_cerberus', 30, 185, 31, 22, 30, 23, 12],
  ['enemy_draugr', 15, 45, 19, 16, 12, 13, 12],
  ['enemy_draugr', 25, 70, 26, 22, 17, 18, 17],
  ['enemy_draugr', 35, 95, 34, 28, 22, 23, 22],
  ['enemy_valkyrie', 15, 36, 9, 9, 22, 13, 26],
  ['enemy_valkyrie', 25, 56, 12, 12, 31, 18, 36],
  ['enemy_valkyrie', 35, 76, 15, 15, 40, 23, 46],
  ['enemy_fenrir', 20, 102, 26, 20, 21, 17, 20],
  ['enemy_fenrir', 25, 122, 30, 23, 24, 19, 23],
  ['enemy_fenrir', 35, 162, 38, 29, 30, 24, 29],
  ['enemy_jormungandr', 28, 130, 24, 13, 32, 24, 12],
  ['enemy_jormungandr', 31, 142, 26, 14, 34, 26, 12],
  ['enemy_jormungandr', 40, 178, 32, 17, 42, 32, 15],
  ['enemy_strix', 33, 95, 22, 22, 37, 22, 35],
  ['enemy_strix', 45, 127, 28, 28, 48, 28, 45],
  ['enemy_strix', 60, 166, 36, 36, 62, 36, 57],
  ['enemy_lemures', 33, 99, 37, 31, 25, 26, 24],
  ['enemy_lemures', 45, 131, 47, 39, 33, 34, 30],
  ['enemy_lemures', 60, 172, 60, 50, 42, 43, 39],
  ['enemy_griffin', 44, 130, 47, 39, 44, 37, 40],
  ['enemy_griffin', 50, 145, 52, 44, 48, 41, 45],
  ['enemy_griffin', 60, 170, 61, 51, 56, 48, 52],
  ['enemy_cacus', 54, 140, 59, 37, 64, 41, 24],
  ['enemy_cacus', 57, 147, 62, 39, 67, 43, 25],
  ['enemy_cacus', 60, 154, 65, 41, 70, 45, 26],
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
