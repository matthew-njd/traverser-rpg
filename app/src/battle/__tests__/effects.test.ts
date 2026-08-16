import { enemyStatsAt } from '../content';
import { resolveDamage } from '../damage';
import { applyEffect, consumeEffects, consumeSwift } from '../effects';
import { scriptedRng, seededRng } from '../rng';
import { NO_EFFECTS, type BattleRules } from '../types';
import { CONTENT, enemy, foe, physical, player, skill } from './fixtures';

/**
 * The effect model (T5 §6, §11.5) against fixtures §10.4 and §10.5.
 *
 * Per effect: it applies, it multiplies correctly, it is consumed by the qualifying trigger, it is
 * **not** consumed by a non-qualifying one, and re-applying it is a no-op.
 */

const NO_DRAWS: BattleRules = {
  crit: false,
  randomFactor: false,
  fleeable: true,
  skillsEnabled: true,
  itemsEnabled: true,
};

/** fixtures §10.4's stage: Cerberus L15 (Underworld, Aegis 15) against a player at Favor 30. */
const CERBERUS_L15 = enemyStatsAt(enemy('enemy_cerberus'), 15);

const against = (input: {
  move: Parameters<typeof resolveDamage>[0]['move'];
  attackerEffects?: Partial<typeof NO_EFFECTS>;
  defenderEffects?: Partial<typeof NO_EFFECTS>;
}) =>
  resolveDamage({
    move: input.move,
    attacker: player({ stats: { favor: 30, might: 30 }, effects: input.attackerEffects }),
    defender: foe('underworld', { stats: CERBERUS_L15, effects: input.defenderEffects }),
    chart: CONTENT.chart,
    rules: NO_DRAWS,
    rng: scriptedRng([]),
  });

describe('fixtures §10.4 — the three ×3.0 ceilings at Cerberus L15', () => {
  const warlord = skill('skill_warlords_advance');
  const sage = skill('skill_sages_verdict');

  it('reaches the documented bases', () => {
    expect(CERBERUS_L15.aegis).toBe(15);
    expect(against({ move: warlord }).base).toBe(16);
    expect(against({ move: sage }).base).toBe(18);
  });

  it('plain super-effective is 32', () => {
    expect(against({ move: warlord }).damage).toBe(32);
  });

  it('Rend + super-effective is 48', () => {
    expect(against({ move: warlord, defenderEffects: { rend: true } }).damage).toBe(48);
  });

  it('Surge + super-effective is 48', () => {
    expect(against({ move: warlord, attackerEffects: { surge: 'war' } }).damage).toBe(48);
  });

  it('Surge + Breach is 54', () => {
    expect(
      against({
        move: sage,
        attackerEffects: { surge: 'wisdom' },
        defenderEffects: { breach: 'wisdom' },
      }).damage,
    ).toBe(54);
  });

  /** GDD 4 §2.3's 4× swing: Wisdom → Underworld is 0.5 naturally, and Breach forces it to 2.0. */
  it('Breach alone turns a resisted 9 into 36', () => {
    expect(against({ move: sage }).damage).toBe(9);
    expect(against({ move: sage, defenderEffects: { breach: 'wisdom' } }).damage).toBe(36);
  });

  /**
   * ↯ Breach **forces** the multiplier rather than multiplying by it. Implemented the other way an
   * already-super-effective hit would reach ×4.0 and 64 — and the charm would look strictly better
   * the better your matchup already was, which is the inverse of what it is for.
   */
  it('Breach does not stack on an already-super-effective hit', () => {
    const breached = against({ move: warlord, defenderEffects: { breach: 'war' } });

    expect(breached.typeMultiplier).toBe(2);
    expect(breached.damage).toBe(32);
    expect(breached.damage).not.toBe(64);
  });

  /**
   * T5 §11.5 asserts a bound, not survival — fixtures §10.9 shows the survival claim is false.
   * Asserted over the pairs §3.4 enumerates, which is where its ×4.95 figure comes from.
   */
  it('never exceeds ×4.95 of the floored base for the enumerated pairs', () => {
    const rng = seededRng(4_950);

    const pairs = [
      { attackerEffects: { surge: 'war' }, defenderEffects: {} },
      { attackerEffects: {}, defenderEffects: { rend: true } },
      { attackerEffects: { surge: 'war' }, defenderEffects: { breach: 'war' } },
    ] as const;

    for (let index = 0; index < 2_000; index += 1) {
      const pair = pairs[index % pairs.length]!;

      const result = resolveDamage({
        move: warlord,
        attacker: player({ stats: { favor: 30 }, effects: pair.attackerEffects }),
        defender: foe('underworld', { stats: CERBERUS_L15, effects: pair.defenderEffects }),
        chart: CONTENT.chart,
        rules: { ...NO_DRAWS, crit: true, randomFactor: true },
        rng,
      });

      expect(result.damage).toBeGreaterThanOrEqual(1);
      expect(result.damage).toBeLessThanOrEqual(Math.floor(result.base * 4.95));
    }
  });

  /**
   * ⚠ **T5 §3.4's ×3.0 ceiling is an enumeration of pairs, and the triple exceeds it.**
   *
   * Surge (×1.5) × super-effective (×2.0) × Rend (×1.5) is ×4.5 before crit, and it is reachable in
   * ordinary play: Rend is applied by a Trinket move and persists until the enemy next takes a hit,
   * so arming a Surge charm on the following turn and then attacking lands all three at once. With
   * crit and the best roll that is ×7.425 of the floored base, not §3.4's ×4.95.
   *
   * The engine is unchanged — §3.2's multipliers are locked and all seven apply. This test exists so
   * the real ceiling is pinned rather than assumed, and it fails loudly if anyone "corrects" the
   * pipeline to cap at ×3.0 without a GDD decision behind it.
   */
  it('reaches ×4.5 on Surge + Rend + super-effective, which §3.4 does not enumerate', () => {
    const result = against({
      move: warlord,
      attackerEffects: { surge: 'war' },
      defenderEffects: { rend: true },
    });

    expect(result.base).toBe(16);
    expect(result.damage).toBe(72);
  });

  /** The one bound that holds unconditionally, and the only one the clamp guarantees. */
  it('is never below 1, whatever the combination', () => {
    const rng = seededRng(1);

    for (let index = 0; index < 2_000; index += 1) {
      const result = resolveDamage({
        move: skill('skill_shadowstep'),
        attacker: player({ stats: { favor: 10 }, effects: { weaken: true } }),
        defender: foe('storm', { stats: { aegis: 45 }, effects: {} }),
        chart: CONTENT.chart,
        rules: { ...NO_DRAWS, crit: true, randomFactor: true },
        rng,
      });

      expect(result.damage).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('fixtures §10.5 — charms are not consumed by a mismatched move', () => {
  /**
   * Arming Stormveil and then swinging Iron Advance neither consumes the charm nor boosts the
   * swing. This is T5 §6's judgment call on GDD 4 §3's wording, and it is what makes the charms
   * usable as the setup tools GDD 4 §2.3 describes rather than a tax on your next attack.
   */
  it('Surge[storm] survives a Physical move, which is unchanged at 28', () => {
    const ironAdvance = skill('skill_iron_advance');

    const armed = resolveDamage({
      move: ironAdvance,
      attacker: player({ stats: { might: 30 }, effects: { surge: 'storm' } }),
      defender: foe('storm', { stats: { resolve: 8 } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    const unarmed = resolveDamage({
      move: ironAdvance,
      attacker: player({ stats: { might: 30 } }),
      defender: foe('storm', { stats: { resolve: 8 } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(armed.damage).toBe(28);
    expect(armed.damage).toBe(unarmed.damage);
    expect(armed.consumed).not.toContain('surge');
  });

  it('Breach[sea] survives a Storm move, and the chart value stands', () => {
    const wrath = skill('skill_thunderers_wrath');

    const result = resolveDamage({
      move: wrath,
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('war', { stats: { aegis: 18 }, effects: { breach: 'sea' } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    // Storm → War is 2.0 on its own merits; the point is that Breach neither fired nor was spent.
    expect(result.typeMultiplier).toBe(2);
    expect(result.consumed).not.toContain('breach');
  });

  it('a Surge of the matching type is consumed and does boost', () => {
    const wrath = skill('skill_thunderers_wrath');

    const result = resolveDamage({
      move: wrath,
      attacker: player({ stats: { favor: 30 }, effects: { surge: 'storm' } }),
      defender: foe('war', { stats: { aegis: 18 } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(result.consumed).toContain('surge');
    expect(result.damage).toBe(Math.floor(13 * 1.5 * 2));
  });
});

describe('the defensive flags', () => {
  it('Fortify halves incoming damage to the player and is consumed', () => {
    const move = physical(40);

    const hit = resolveDamage({
      move,
      attacker: foe('storm', { stats: { might: 20 } }),
      defender: player({ stats: { resolve: 10 }, effects: { fortify: true } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(hit.damage).toBe(5);
    expect(hit.consumed).toContain('fortify');
  });

  it('Weaken halves the holder’s outgoing damage and is consumed', () => {
    const hit = resolveDamage({
      move: physical(40),
      attacker: foe('storm', { stats: { might: 20 }, effects: { weaken: true } }),
      defender: player({ stats: { resolve: 10 } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(hit.damage).toBe(5);
    expect(hit.consumed).toContain('weaken');
  });

  /** Fortify is player-side (T5 §6) — the side check is the flag's real definition, not a detail. */
  it('does not halve an enemy’s incoming damage when the enemy somehow holds Fortify', () => {
    const hit = resolveDamage({
      move: physical(40),
      attacker: player({ stats: { might: 20 } }),
      defender: foe('storm', { stats: { resolve: 10 }, effects: { fortify: true } }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(hit.damage).toBe(10);
    expect(hit.consumed).not.toContain('fortify');
  });
});

describe('applying and consuming', () => {
  /** Non-stacking is an idempotent set, not a counter (GDD 4 §1). */
  it('re-applying an effect is a no-op that returns the same object', () => {
    const once = applyEffect(NO_EFFECTS, 'fortify');
    const twice = applyEffect(once, 'fortify');

    expect(once.fortify).toBe(true);
    expect(twice).toBe(once);
  });

  it('re-arming a charm with the same type is a no-op, and a different type replaces it', () => {
    const storm = applyEffect(NO_EFFECTS, 'surge', 'storm');

    expect(applyEffect(storm, 'surge', 'storm')).toBe(storm);
    expect(applyEffect(storm, 'surge', 'sea').surge).toBe('sea');
  });

  it('refuses to arm a typed charm without a type', () => {
    expect(() => applyEffect(NO_EFFECTS, 'breach')).toThrow(/type/);
  });

  it('clears exactly what a hit consumed, and nothing else', () => {
    const held = applyEffect(applyEffect(NO_EFFECTS, 'rend'), 'surge', 'war');
    const after = consumeEffects(held, ['rend']);

    expect(after.rend).toBe(false);
    expect(after.surge).toBe('war');
  });

  it('returns the same object when nothing was consumed', () => {
    const held = applyEffect(NO_EFFECTS, 'rend');

    expect(consumeEffects(held, [])).toBe(held);
  });

  it('consumes Swift whether or not it changed the order', () => {
    const swift = applyEffect(NO_EFFECTS, 'swift');

    expect(consumeSwift(swift).swift).toBe(false);
    expect(consumeSwift(NO_EFFECTS)).toBe(NO_EFFECTS);
  });
});
