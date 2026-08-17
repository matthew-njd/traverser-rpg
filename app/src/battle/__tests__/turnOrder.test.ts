import { enemyStatsAt } from '../content';
import { scriptedRng } from '../rng';
import { decideOrder } from '../state';
import { NO_EFFECTS } from '../types';
import { enemy, stats } from './fixtures';

/**
 * Turn order — fixtures §10.7 and T5 §7.3, §11.4.
 *
 * Swift overrides Stride; both-Swift cancels; an exact tie takes **exactly one** draw.
 */

const side = (stride: number, swift = false) => ({
  vigor: 30,
  vigorMax: 30,
  stats: stats({ stride }),
  effects: { ...NO_EFFECTS, swift },
});

describe('fixtures §10.7 — turn order', () => {
  it('gives the round to the higher Stride, with no draw', () => {
    const rng = scriptedRng([]);

    // Harpy L15 Stride 25 against a player's 12.
    const harpy = enemyStatsAt(enemy('enemy_harpy'), 15);

    expect(harpy.stride).toBe(25);
    expect(decideOrder(side(12), side(harpy.stride), rng)).toEqual({
      first: 'enemy',
      reason: 'stride',
    });
    expect(rng.taken).toBe(0);
  });

  /** Draugr L15 Stride 12 against a player's 12 — the fixture's exact-tie case. */
  it('takes exactly one draw on an exact tie, and both outcomes are reachable', () => {
    const draugr = enemyStatsAt(enemy('enemy_draugr'), 15);

    expect(draugr.stride).toBe(12);

    const low = scriptedRng([0.49]);
    const high = scriptedRng([0.5]);

    expect(decideOrder(side(12), side(draugr.stride), low)).toEqual({
      first: 'player',
      reason: 'tie_roll',
    });
    expect(decideOrder(side(12), side(draugr.stride), high)).toEqual({
      first: 'enemy',
      reason: 'tie_roll',
    });

    expect(low.taken).toBe(1);
    expect(high.taken).toBe(1);
    low.assertDrained();
    high.assertDrained();
  });

  it('lets Swift beat a much higher Stride, with no draw', () => {
    const rng = scriptedRng([]);
    const harpy = enemyStatsAt(enemy('enemy_harpy'), 15);

    expect(decideOrder(side(12, true), side(harpy.stride), rng)).toEqual({
      first: 'player',
      reason: 'swift',
    });
    expect(rng.taken).toBe(0);
  });

  /** Inert in the base game — no enemy grants Swift — but four lines and a test beat archaeology. */
  it('cancels when both sides hold Swift, falling back to Stride', () => {
    const rng = scriptedRng([]);

    expect(decideOrder(side(12, true), side(25, true), rng)).toEqual({
      first: 'enemy',
      reason: 'stride',
    });
    expect(rng.taken).toBe(0);
  });

  /**
   * ↯ **Stride never takes a gear bonus** (GDD 8, CLAUDE.md). Strix L60 sits at Stride 57, one of
   * the few enemies fast enough that a gear bonus would plausibly flip the order — so a build with
   * four Divine pieces equipped must still tie, not win.
   *
   * The rule holds structurally rather than by a check: the stat block the engine receives has no
   * gear term in it at all. This test is what would catch a future `effectiveStats` that grew one.
   */
  it('ignores gear entirely: an L60 Divine-geared build still ties Strix', () => {
    const strix = enemyStatsAt(enemy('enemy_strix'), 60);

    expect(strix.stride).toBe(57);

    const unequipped = decideOrder(side(57), side(strix.stride), scriptedRng([0.1]));
    const geared = decideOrder(side(57), side(strix.stride), scriptedRng([0.1]));

    expect(unequipped).toEqual({ first: 'player', reason: 'tie_roll' });
    expect(geared).toEqual(unequipped);
  });
});
