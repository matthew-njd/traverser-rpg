import type { Rng } from './rng';

/**
 * Weighted selection, used by both weighted picks in the engine: enemy move choice (T5 §5) and the
 * drop-pool draw (§10.1).
 *
 * ```
 * total = Σ weights                     (never assume 100)
 * roll  = rng.next() × total
 * scan in a fixed order, accumulating; take the first entry whose cumulative weight
 *   strictly exceeds roll
 * ```
 *
 * ↯ **The scan order must be stable and content-derived** — ordered by primary key, never by object
 * iteration order or by a Map built from a JSON blob. An unstable order makes every scripted test
 * flaky in a way that reproduces about one run in ten, which is the worst possible failure rate to
 * debug. Callers sort before calling; this function trusts the order it is given and nothing else.
 *
 * ↯ **Strictly exceeds**, not "≥". With weights 35/45/20 a draw of exactly 0.35 must select the
 * *second* move: the first entry's cumulative weight is 35, which does not exceed 35. Getting this
 * backwards shifts every boundary by one entry and is invisible outside a boundary test.
 */
export function weightedPick<T>(entries: readonly T[], weightOf: (entry: T) => number, rng: Rng): T {
  if (entries.length === 0) {
    throw new Error('weightedPick was given nothing to pick from');
  }

  let total = 0;

  for (const entry of entries) {
    total += weightOf(entry);
  }

  if (total <= 0) {
    throw new Error('weightedPick was given entries with no positive weight');
  }

  const roll = rng.next() * total;
  let cumulative = 0;

  for (const entry of entries) {
    cumulative += weightOf(entry);

    if (cumulative > roll) {
      return entry;
    }
  }

  // Unreachable while `rng.next()` stays in [0, 1): the final cumulative equals `total`, which
  // strictly exceeds any roll below it. Kept as a real return rather than a non-null assertion.
  const last = entries[entries.length - 1];

  if (last === undefined) {
    throw new Error('weightedPick was given nothing to pick from');
  }

  return last;
}
