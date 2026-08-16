/**
 * The engine's only source of randomness (T5 §4).
 *
 * ↯ No React, no Expo, no `Date.now()`, and **no bare `Math.random()` below this file**. The engine
 * is a pure reducer (T5 §1.1) precisely so fixtures §10.8 can be executed as a fold over a list of
 * actions with an explicit draw sequence; a draw taken anywhere else makes that fixture
 * unexecutable and turns the oracle back into documentation.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
}

/** Production. Nothing here is security-sensitive — T2 §1.1 keeps progression server-side. */
export const systemRng: Rng = {
  next: () => Math.random(),
};

/**
 * xorshift128+ over a 32-bit seed (T5 §4). Reproducible across runs and machines, so a failing
 * property test reports its seed and is replayable.
 *
 * ↯ The seed is expanded through SplitMix64 rather than used directly. xorshift128+ with a
 * low-entropy state — which `seed, 0, 0, 0` is — produces visibly poor early draws before it
 * washes out, and the engine's first draws are exactly the ones a short battle uses.
 */
export function seededRng(seed: number): Rng {
  // Two 32-bit halves per 64-bit word, because JS bitwise ops are 32-bit and BigInt is slower than
  // this whole engine needs to be.
  let s0 = splitmix32(seed ^ 0x9e3779b9);
  let s1 = splitmix32(s0);
  let s2 = splitmix32(s1);
  let s3 = splitmix32(s2);

  return {
    next(): number {
      const result = (s0 + s3) >>> 0;

      const t = (s1 << 9) >>> 0;

      s2 ^= s0;
      s3 ^= s1;
      s1 ^= s2;
      s0 ^= s3;
      s2 ^= t;
      s3 = ((s3 << 11) | (s3 >>> 21)) >>> 0;

      // Divided by 2^32, so the result is in [0, 1) and never reaches 1.
      return result / 4294967296;
    },
  };
}

function splitmix32(input: number): number {
  let z = (input + 0x9e3779b9) >>> 0;

  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;

  return (z ^ (z >>> 15)) >>> 0;
}

export class RngExhaustedError extends Error {
  constructor(taken: number) {
    super(`The scripted RNG ran out after ${taken} draws — the engine took more than the fixture specifies.`);
    this.name = 'RngExhaustedError';
  }
}

export class RngUnconsumedError extends Error {
  constructor(remaining: number) {
    super(`The scripted RNG has ${remaining} draws left — the engine took fewer than the fixture specifies.`);
    this.name = 'RngUnconsumedError';
  }
}

export interface ScriptedRng extends Rng {
  /** Throws unless every scripted draw was taken. Call at the end of a fixture test. */
  assertDrained(): void;
  readonly taken: number;
}

/**
 * A queue of exact values, for the fixtures that state their draws explicitly (§10.8).
 *
 * ↯ **Throws on exhaustion *and* on an unconsumed remainder**, and both halves matter. Exhaustion
 * catches an engine that takes a draw it should have skipped — which is how T5 §1.2's tutorial
 * bypass is proved to skip the draws rather than take and discard them. The remainder check catches
 * the opposite: an engine that never took a draw the contract says it must. Either alone would let
 * half of §4.1's draw-order contract rot.
 */
export function scriptedRng(values: readonly number[]): ScriptedRng {
  const queue = [...values];
  let taken = 0;

  return {
    get taken() {
      return taken;
    },
    next(): number {
      const value = queue.shift();

      if (value === undefined) {
        throw new RngExhaustedError(taken);
      }

      taken += 1;

      return value;
    },
    assertDrained(): void {
      if (queue.length > 0) {
        throw new RngUnconsumedError(queue.length);
      }
    },
  };
}
