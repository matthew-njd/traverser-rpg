import { coalescePasses, retryDelay } from '../coalesce';

/**
 * The re-entrancy rules, as behaviour rather than as a comment. This is the module the M2 defect
 * lived in: the guard was right about duplicate `AppState` events and silently wrong about a caller
 * that had just queued something (DECISIONS 2026-08-22).
 */
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = () => res();
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('coalescePasses', () => {
  it('runs a pass when none is in flight', async () => {
    const runs: number[] = [];
    const run = coalescePasses(async () => {
      runs.push(1);
    });

    await run();

    expect(runs).toHaveLength(1);
  });

  /** A duplicate `AppState` → `active` mints nothing and must not upload twice. */
  it('joins an in-flight pass rather than starting a second', async () => {
    const gate = deferred();
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;
      await gate.promise;
    });

    const first = run();
    const second = run();

    expect(started).toBe(1);
    expect(second).toBe(first);

    gate.resolve();
    await first;
  });

  /**
   * The defect. The running pass built its payload before this caller's entry existed, so joining
   * it leaves the entry queued until some later foreground.
   */
  it('runs one more pass for a caller that has new work', async () => {
    const gate = deferred();
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;

      if (started === 1) {
        await gate.promise;
      }
    });

    const first = run();
    const follow = run(undefined, true);

    expect(started).toBe(1);

    gate.resolve();
    await follow;

    expect(started).toBe(2);
  });

  /** One follow-up, not one per caller — the outbox is the queue, this is just a nudge. */
  it('coalesces several new-work callers into a single follow-up', async () => {
    const gate = deferred();
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;

      if (started === 1) {
        await gate.promise;
      }
    });

    const first = run();
    const a = run(undefined, true);
    const b = run(undefined, true);
    const c = run(undefined, true);

    expect(a).toBe(b);
    expect(b).toBe(c);

    gate.resolve();
    await Promise.all([first, a]);

    expect(started).toBe(2);
  });

  /** Offline is the ordinary outcome, so the follow-up cannot be conditional on success. */
  it('still runs the follow-up when the pass ahead of it failed', async () => {
    const gate = deferred();
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;

      if (started === 1) {
        await gate.promise;
      }
    });

    const first = run();
    const follow = run(undefined, true);

    gate.reject(new Error('no route to host'));
    await expect(first).rejects.toThrow('no route to host');
    await follow;

    expect(started).toBe(2);
  });

  it('starts fresh once the queue has drained', async () => {
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;
    });

    await run();
    await run();

    expect(started).toBe(2);
  });

  /** A failed pass must not wedge the gate — the next foreground has to be able to try again. */
  it('clears the guard after a failure', async () => {
    let started = 0;
    const run = coalescePasses(async () => {
      started += 1;
      throw new Error('failed');
    });

    await expect(run()).rejects.toThrow('failed');
    await expect(run()).rejects.toThrow('failed');

    expect(started).toBe(2);
  });
});

/** T2 §5: 1s, 2s, 4s … capped at 60s, with full jitter below the cap. */
describe('retryDelay', () => {
  const top = () => 0.999_999;

  it('doubles from one second and stops at sixty', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 20].map((attempt) => Math.round(retryDelay(attempt, top) / 1000))).toEqual([
      1, 2, 4, 8, 16, 32, 60, 60, 60,
    ]);
  });

  it('draws anywhere from zero up to the cap', () => {
    expect(retryDelay(3, () => 0)).toBe(0);
    expect(retryDelay(3, () => 0.5)).toBe(4_000);
  });
});
