import { RngExhaustedError, RngUnconsumedError, scriptedRng, seededRng } from '../rng';

/**
 * The injected RNG (T5 §4). Nothing here is about game rules — it is about the two properties the
 * fixture suite leans on: a seeded stream is reproducible, and a scripted stream is exact.
 */
describe('the seeded stream', () => {
  it('is reproducible across instances for the same seed', () => {
    const first = seededRng(12_345);
    const second = seededRng(12_345);

    const draws = Array.from({ length: 100 }, () => first.next());

    expect(draws).toEqual(Array.from({ length: 100 }, () => second.next()));
  });

  it('differs between seeds', () => {
    expect(seededRng(1).next()).not.toBe(seededRng(2).next());
  });

  it('stays inside [0, 1)', () => {
    const rng = seededRng(99);

    for (let index = 0; index < 100_000; index += 1) {
      const draw = rng.next();

      expect(draw).toBeGreaterThanOrEqual(0);
      expect(draw).toBeLessThan(1);
    }
  });

  /**
   * Not a randomness-quality test — it is a smoke test for the seeding. A state expanded badly
   * from a low-entropy seed produces visibly clumped early draws, and the engine's first draws are
   * exactly the ones a three-round battle uses.
   */
  it('spreads its first draws across the range', () => {
    const buckets = new Map<number, number>([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);

    for (let seed = 0; seed < 400; seed += 1) {
      const bucket = Math.min(3, Math.floor(seededRng(seed).next() * 4));

      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    for (const count of buckets.values()) {
      expect(count).toBeGreaterThan(50);
    }
  });
});

describe('the scripted stream', () => {
  it('hands back its values in order', () => {
    const rng = scriptedRng([0.1, 0.2, 0.3]);

    expect([rng.next(), rng.next(), rng.next()]).toEqual([0.1, 0.2, 0.3]);
    expect(rng.taken).toBe(3);
  });

  /** Catches an engine that takes a draw the contract says it should skip (T5 §1.2). */
  it('throws when the engine takes more draws than the fixture specifies', () => {
    const rng = scriptedRng([0.5]);

    rng.next();

    expect(() => rng.next()).toThrow(RngExhaustedError);
  });

  /** And the other half: an engine that never took a draw §4.1 says it must. */
  it('throws when draws are left unconsumed', () => {
    const rng = scriptedRng([0.5, 0.5]);

    rng.next();

    expect(() => rng.assertDrained()).toThrow(RngUnconsumedError);
  });

  it('is drained when every value was taken', () => {
    const rng = scriptedRng([0.5]);

    rng.next();

    expect(() => rng.assertDrained()).not.toThrow();
  });
});
