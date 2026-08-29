import { enemyStatsAt } from '../content';
import { resolveDamage } from '../damage';
import { seededRng, scriptedRng } from '../rng';
import type { BattleRules } from '../types';
import { CONTENT, divine, enemy, foe, physical, player, stats } from './fixtures';

/**
 * The damage pipeline against fixtures §2 and §10 (T5 §11.2).
 *
 * Every expected value below comes from `docs/traverser-test-fixtures.md`. None is re-derived from
 * GDD prose — per CLAUDE.md, if the code disagrees with a fixture the code is wrong.
 */

const NO_DRAWS: BattleRules = {
  crit: false,
  randomFactor: false,
  fleeable: true,
  skillsEnabled: true,
  itemsEnabled: true,
};

const CRIT_ALWAYS: BattleRules = { ...NO_DRAWS, crit: true };

/** Every case here is deterministic, so an unexpected draw is an engine bug and must throw. */
const hit = (input: Omit<Parameters<typeof resolveDamage>[0], 'chart' | 'rng'> & { rng?: Parameters<typeof resolveDamage>[0]['rng'] }) =>
  resolveDamage({ ...input, chart: CONTENT.chart, rng: input.rng ?? scriptedRng([]) });

describe('fixtures §2 — the four worked examples', () => {
  it('L1 baseline: P40, Atk 10, Def 10, ×1.0 → 5', () => {
    expect(
      hit({
        move: physical(40),
        attacker: player({ stats: { might: 10 } }),
        defender: foe('storm', { stats: { resolve: 10 } }),
        rules: NO_DRAWS,
      }).damage,
    ).toBe(5);
  });

  it('mid-game: P40, Atk 25, Def 20, ×1.0 → 6', () => {
    expect(
      hit({
        move: physical(40),
        attacker: player({ stats: { might: 25 } }),
        defender: foe('storm', { stats: { resolve: 20 } }),
        rules: NO_DRAWS,
      }).damage,
    ).toBe(6);
  });

  /** Storm → War is 2.0 in fixtures §1; the row names no types, so any super-effective pair serves. */
  it('typed skill, super-effective: P65, Atk 30, Def 18, ×2.0 → 26', () => {
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('war', { stats: { aegis: 18 } }),
      rules: NO_DRAWS,
    });

    expect(result).toMatchObject({ base: 13, typeMultiplier: 2, damage: 26 });
  });
});

/**
 * ↯ **The highest-value single test in the suite** (fixtures §10.1, T5 §3.1).
 *
 * A single-floor engine — the natural reading of GDD 2 §7's formula line — returns 27 here and the
 * correct answer on all four neutral cases below, so nothing else in the suite distinguishes them.
 */
describe('fixtures §10.1 — the double floor', () => {
  it('floors the quotient before the multiplier: 13 × 2.0 = 26, not floor(13.5417 × 2.0) = 27', () => {
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('war', { stats: { aegis: 18 } }),
      rules: NO_DRAWS,
    });

    expect(result.base).toBe(13);
    expect(result.damage).toBe(26);
    expect(result.damage).not.toBe(27);
  });

  /** Recorded as unable to pin the rule, so that nobody later mistakes them for coverage. */
  it('gives the same answer under either reading for the four neutral cases', () => {
    const cases = [
      { power: 40, attack: 10, defence: 10, expected: 5 },
      { power: 40, attack: 25, defence: 20, expected: 6 },
      { power: 40, attack: 11, defence: 8, expected: 6 },
      { power: 30, attack: 12, defence: 10, expected: 4 },
    ];

    for (const { power, attack, defence, expected } of cases) {
      expect(
        hit({
          move: physical(power),
          attacker: player({ stats: { might: attack } }),
          defender: foe(null, { stats: { resolve: defence } }),
          rules: NO_DRAWS,
        }).damage,
      ).toBe(expected);
    }
  });
});

describe('fixtures §10.2 — minimum damage is 1', () => {
  /**
   * Shadowstep (Trickery, P55) from an L60 pure-Might build (Favor never allocated, so 10) into
   * Cacus L60's Aegis 45. Trickery → Storm is 0.5, so the pipeline reaches 0 before the clamp.
   */
  it('clamps a resisted hit that floors to zero', () => {
    const cacus = enemyStatsAt(enemy('enemy_cacus'), 60);

    expect(cacus.aegis).toBe(45);

    const result = hit({
      move: divine(55, 'trickery'),
      attacker: player({ stats: { favor: 10 } }),
      defender: foe('storm', { stats: cacus }),
      rules: NO_DRAWS,
    });

    expect(result.base).toBe(1);
    expect(result.typeMultiplier).toBe(0.5);
    expect(result.damage).toBe(1);
  });

  it('never returns zero on the worst roll either', () => {
    const cacus = enemyStatsAt(enemy('enemy_cacus'), 60);

    const result = hit({
      move: divine(55, 'trickery'),
      attacker: player({ stats: { favor: 10 } }),
      defender: foe('storm', { stats: cacus }),
      rules: { ...NO_DRAWS, randomFactor: true },
      rng: scriptedRng([0]),
    });

    expect(result.damage).toBe(1);
  });
});

describe('fixtures §10.3 — crit multiplies the floored base', () => {
  it('gives 19, not the 20 an unfloored quotient would', () => {
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('underworld', { stats: { aegis: 18 } }),
      rules: CRIT_ALWAYS,
      rng: scriptedRng([0]),
    });

    expect(result).toMatchObject({ base: 13, typeMultiplier: 1, wasCrit: true, damage: 19 });
  });

  /** 6.25%, strictly less than. A draw exactly on the boundary is not a crit. */
  it('crits below 0.0625 and not at it', () => {
    const at = (draw: number) =>
      hit({
        move: physical(40),
        attacker: player({ stats: { might: 10 } }),
        defender: foe(null, { stats: { resolve: 10 } }),
        rules: CRIT_ALWAYS,
        rng: scriptedRng([draw]),
      }).wasCrit;

    expect(at(0.0624)).toBe(true);
    expect(at(0.0625)).toBe(false);
  });
});

/**
 * fixtures §10.6. The fixture that pins T5 §1.5 — crits are symmetric, and the type multiplier is
 * 1.0 when the enemy attacks regardless of either side's type.
 */
describe('fixtures §10.6 — enemy-side crit', () => {
  it('Cerberus L15 Death Breath into Aegis 10: 9, and 13 on a crit', () => {
    const cerberus = enemyStatsAt(enemy('enemy_cerberus'), 15);

    expect(cerberus.favor).toBe(13);

    const move = enemy('enemy_cerberus').moves.find((candidate) => candidate.id === 'emove_death_breath');

    const plain = hit({
      move: move!,
      attacker: foe('underworld', { stats: cerberus }),
      defender: player({ stats: { aegis: 10 } }),
      rules: NO_DRAWS,
    });

    const crit = hit({
      move: move!,
      attacker: foe('underworld', { stats: cerberus }),
      defender: player({ stats: { aegis: 10 } }),
      rules: CRIT_ALWAYS,
      rng: scriptedRng([0]),
    });

    expect(plain).toMatchObject({ base: 9, typeMultiplier: 1, damage: 9 });
    expect(crit.damage).toBe(13);
  });
});

describe('the stat pair', () => {
  /**
   * Invisible on any fixture whose Might and Favor match: swapping the pair changes nothing unless
   * the two defences differ, so the case is built to make them differ sharply.
   */
  it('reads Resolve for Physical and Aegis for Divine', () => {
    const lopsided = stats({ resolve: 8, aegis: 40 });

    const physicalHit = hit({
      move: physical(40),
      attacker: player({ stats: { might: 30, favor: 30 } }),
      defender: foe(null, { stats: lopsided }),
      rules: NO_DRAWS,
    });

    const divineHit = hit({
      move: divine(40, 'storm'),
      attacker: player({ stats: { might: 30, favor: 30 } }),
      defender: foe(null, { stats: lopsided }),
      rules: NO_DRAWS,
    });

    expect(physicalHit.base).toBe(18);
    expect(divineHit.base).toBe(3);
  });
});

describe('the random factor', () => {
  /** T5 §11.2's bound, over a seeded PRNG so a failure is replayable from its seed. */
  it('stays inside [floor(base × 0.90), floor(base × 1.10)] across 10⁴ draws', () => {
    const rng = seededRng(20260816);
    let low = Number.POSITIVE_INFINITY;
    let high = 0;

    for (let index = 0; index < 10_000; index += 1) {
      const result = resolveDamage({
        move: divine(65, 'storm'),
        attacker: player({ stats: { favor: 30 } }),
        defender: foe('underworld', { stats: { aegis: 18 } }),
        chart: CONTENT.chart,
        rules: { ...NO_DRAWS, randomFactor: true },
        rng,
      });

      low = Math.min(low, result.damage);
      high = Math.max(high, result.damage);
    }

    expect(low).toBeGreaterThanOrEqual(Math.floor(13 * 0.9));
    expect(high).toBeLessThanOrEqual(Math.floor(13 * 1.1));
  });

  it('takes the crit draw before the random draw', () => {
    // Crit first (0.0 → crit), random second (1.0 → ×1.10). Reversed, the first draw would be read
    // as the random factor and no crit would fire.
    const result = hit({
      move: divine(65, 'storm'),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('underworld', { stats: { aegis: 18 } }),
      rules: { ...NO_DRAWS, crit: true, randomFactor: true },
      rng: scriptedRng([0, 1]),
    });

    expect(result.wasCrit).toBe(true);
    expect(result.damage).toBe(Math.floor(13 * 1.5 * 1.1));
  });

  /**
   * T5 §1.2 — the tutorial's determinism is a rule flag, not a rigged RNG. An empty ScriptedRng
   * throws on any draw at all, so this passing is proof the draws are *skipped*, not taken and
   * discarded.
   */
  it('takes no draws at all when both rules are off', () => {
    const rng = scriptedRng([]);

    hit({
      move: physical(40),
      attacker: player({ stats: { might: 11 } }),
      defender: foe(null, { stats: { resolve: 8 } }),
      rules: NO_DRAWS,
      rng,
    });

    expect(rng.taken).toBe(0);
  });
});
