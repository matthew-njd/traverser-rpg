import { scriptedRng, seededRng } from '../rng';
import { weightedPick } from '../select';
import { selectEnemyMove } from '../state';
import { enemy } from './fixtures';

/**
 * Enemy AI — T5 §5 and §11.6. Weighted random selection each turn, no conditional logic: GDD 5, 6
 * and 7 say it in identical words, thirteen times.
 */
describe('weighted move selection', () => {
  /**
   * Cerberus is 35/45/20 in GDD 5's table order, so the cumulative boundaries are 35 and 80. These
   * six draws pin both the scan direction and the strict-inequality boundary — a `>=` comparison
   * shifts every one of them by an entry, and nothing else in the suite would notice.
   */
  it('lands on the exact boundaries for Cerberus', () => {
    const cerberus = enemy('enemy_cerberus');

    const at = (draw: number) => selectEnemyMove(cerberus, scriptedRng([draw])).id;

    expect(at(0.0)).toBe('emove_three_fanged_strike');
    expect(at(0.3499)).toBe('emove_three_fanged_strike');
    expect(at(0.35)).toBe('emove_death_breath');
    expect(at(0.7999)).toBe('emove_death_breath');
    expect(at(0.8)).toBe('emove_savage_bite_cerberus');
    expect(at(0.9999)).toBe('emove_savage_bite_cerberus');
  });

  it('takes exactly one draw per selection', () => {
    const rng = scriptedRng([0.5]);

    selectEnemyMove(enemy('enemy_cerberus'), rng);

    expect(rng.taken).toBe(1);
    rng.assertDrained();
  });

  /** The Wisp's single move needs no selection, which is what lets the tutorial take no draws. */
  it('takes no draw when the enemy has one move', () => {
    const rng = scriptedRng([]);

    expect(selectEnemyMove(enemy('enemy_waystone_wisp'), rng).id).toBe('emove_chilling_gust');
    expect(rng.taken).toBe(0);
  });

  it('distributes within tolerance over 10⁵ selections', () => {
    const cerberus = enemy('enemy_cerberus');
    const rng = seededRng(12_345);
    const counts = new Map<string, number>();
    const runs = 100_000;

    for (let index = 0; index < runs; index += 1) {
      const move = selectEnemyMove(cerberus, rng);

      counts.set(move.id, (counts.get(move.id) ?? 0) + 1);
    }

    const share = (id: string) => ((counts.get(id) ?? 0) / runs) * 100;

    expect(share('emove_three_fanged_strike')).toBeGreaterThan(34);
    expect(share('emove_three_fanged_strike')).toBeLessThan(36);
    expect(share('emove_death_breath')).toBeGreaterThan(44);
    expect(share('emove_death_breath')).toBeLessThan(46);
    expect(share('emove_savage_bite_cerberus')).toBeGreaterThan(19);
    expect(share('emove_savage_bite_cerberus')).toBeLessThan(21);
  });

  /**
   * Every current roster row sums to 100, so nothing in the content would catch an engine that
   * assumed it. T5 §5 is explicit that the total is observed rather than assumed.
   */
  it('normalises weights that do not sum to 100', () => {
    const entries = [
      { id: 'a', weight: 3 },
      { id: 'b', weight: 4 },
    ];

    const pick = (draw: number) => weightedPick(entries, (entry) => entry.weight, scriptedRng([draw])).id;

    // Total 7: 'a' holds [0, 3/7), 'b' holds [3/7, 1).
    expect(pick(0.42)).toBe('a');
    expect(pick(0.4286)).toBe('b');
    expect(pick(0.99)).toBe('b');
  });

  it('refuses to pick from an empty set, or one with no positive weight', () => {
    expect(() => weightedPick([], () => 1, scriptedRng([0.5]))).toThrow(/nothing to pick/);
    expect(() => weightedPick([{ w: 0 }], (entry) => entry.w, scriptedRng([0.5]))).toThrow(
      /positive weight/,
    );
  });

  /**
   * The failure T5 §12 named as uncaught by §11.6 — an enemy whose move rows are missing produces a
   * battle with no enemy actions. `ContentValidationTests` catches it at seed time; this is what it
   * does if one ever reaches the engine anyway.
   */
  it('names the enemy when it has no moves at all', () => {
    expect(() =>
      selectEnemyMove({ ...enemy('enemy_harpy'), moves: [] }, scriptedRng([0.5])),
    ).toThrow(/enemy_harpy has no moves/);
  });
});
