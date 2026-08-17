import { scriptedRng } from '../rng';
import { damageLog, movesUsed, startBattle } from './harness';

/**
 * fixtures §10.8 — the full worked wild battle, Harpy L15, under an **explicit 18-value draw
 * sequence** rather than a PRNG seed, so the fixture is implementation-independent.
 *
 * This is the integration oracle the tutorial cannot be, because the tutorial has no randomness in
 * it at all. Every draw is consumed and the queue is asserted drained, which is what pins T5 §4.1's
 * draw order: enemy selection, then per hit crit → random, then the loot dice.
 */
describe('fixtures §10.8 — Harpy L15, 18 draws, all consumed', () => {
  /**
   * Player L15, the reference Might build: 42 points as Vigor +16 / Might +18 / Resolve +8, plus a
   * Mortal Weapon's +2 Might. Harpy L15 Stride 25 against the player's 10 → the Harpy acts first
   * every round and **no tie draw is ever taken**.
   */
  const DRAWS = [
    0.42, 0.8, 0.5, 0.99, 0.0, // round 1: select, crit, roll · crit, roll
    0.85, 0.03, 0.95, 0.5, 0.5, // round 2
    0.1, 0.02, 0.5, 0.5, 0.99, // round 3
    0.2, 0.5, 0.6, // loot: item die, gear die, pool draw
  ];

  const fight = () => {
    const rng = scriptedRng(DRAWS);

    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 15,
      playerStats: { vigor: 36, might: 30, resolve: 18, favor: 10, aegis: 10, stride: 10 },
      rng,
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });
    battle.take({ kind: 'move', moveId: 'skill_thunderers_wrath' });
    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });

    return { battle, rng };
  };

  it('the Harpy acts first every round, on Stride', () => {
    const { battle } = fight();

    expect(battle.state.first).toBe('enemy');
    expect(battle.state.firstReason).toBe('stride');
  });

  it('produces the fixture’s damage, round by round', () => {
    const { battle } = fight();

    // Harpy 9, player 25 · Harpy 1 (crit on a base of 1), player 6 · Harpy 13 (crit), player 30.
    expect(damageLog(battle.events)).toEqual([9, 25, 1, 6, 13, 30]);
  });

  it('selects the Harpy’s moves as the draws dictate', () => {
    const { battle } = fight();

    expect(movesUsed(battle.events)).toEqual([
      'emove_gust_strike',
      'skill_iron_advance',
      'emove_buffet',
      'skill_thunderers_wrath',
      'emove_gust_strike',
      'skill_iron_advance',
    ]);
  });

  it('ends in a win in 3 rounds at 13/36 Vigor', () => {
    const { battle } = fight();

    expect(battle.state.outcome).toBe('win');
    expect(battle.state.round).toBe(3);
    expect(battle.state.player.vigor).toBe(13);
    expect(battle.state.enemy.vigor).toBe(0);
  });

  /**
   * Round 2 is load-bearing: a crit on a base of 1 still yields 1, exercising the clamp and
   * crit-on-a-small-base together. Round 2's Thunderer's Wrath is the "wrong tool" case — Storm into
   * a Storm enemy is neutral, and this build has no Favor.
   */
  it('keeps a crit on a base of 1 at 1 damage', () => {
    const { battle } = fight();

    const crits = battle.events.flatMap((event) =>
      event.type === 'damage_dealt' && event.wasCrit ? [event.amount] : [],
    );

    expect(crits).toEqual([1, 13]);
  });

  it('rolls one item and no gear, and takes exactly 18 draws', () => {
    const { battle, rng } = fight();

    // item die 0.20 < 0.35 → drops; gear die 0.50 ≥ 0.20 → none; wild has no trinket row, so no
    // third die is taken at all.
    expect(battle.state.drops?.gear).toEqual([]);
    expect(battle.state.drops?.trinket).toBeNull();
    expect(battle.state.drops?.items).toHaveLength(1);

    expect(rng.taken).toBe(18);
    rng.assertDrained();
  });

  /**
   * `0.60 × 2 = 1.2` → index 1 → Stormveil, with the pool in GDD 5 §3.1's listed order
   * (Traveler's Salve, Stormveil). That order is `ordinal`, added 2026-08-17 — under the primary
   * key the two rows sort the other way and this draw would select the Salve instead.
   */
  it('selects the pool entry at index 1 in the GDD’s listed order', () => {
    const { battle } = fight();

    expect(battle.state.drops?.items).toEqual(['item_stormveil']);
  });
});
