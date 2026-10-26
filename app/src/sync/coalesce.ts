/**
 * Coalescing foreground passes (T4 §7.2).
 *
 * ↯ **Two callers want opposite things from a pass that is already running**, and treating them the
 * same is what produced the M2 defect. `AppState` delivers `'active'` more than once in quick
 * succession — a permission dialog dismissing, a sheet closing — and the second of those should
 * *join* the running pass rather than start a second upload. But a caller that has just written to
 * the outbox cannot join it: that pass built its payload before the entry existed, so joining means
 * the entry waits for a foreground that may not come. A battle settled at 14:32:21 against a pass
 * begun at 14:32:17 sat unsent for four minutes on the device (DECISIONS 2026-08-22).
 *
 * So: joiners join, and a caller with new work gets **one** more pass after this one. One, not a
 * queue of them — the outbox is already the queue, and every later request joins the follow-up
 * that is pending rather than adding to it.
 */
export function coalescePasses<T>(start: (now?: number) => Promise<T>) {
  let inFlight: Promise<T> | null = null;
  let queued: Promise<T> | null = null;

  const begin = (now?: number): Promise<T> => {
    const pass = start(now).finally(() => {
      inFlight = null;
    });

    inFlight = pass;

    return pass;
  };

  return (now?: number, withNewWork = false): Promise<T> => {
    if (inFlight === null) {
      return begin(now);
    }

    if (!withNewWork) {
      return inFlight;
    }

    queued ??= inFlight
      // The follow-up runs whether or not the pass ahead of it succeeded. An unreachable server is
      // the ordinary case (T2 §1.2), and the new entry still has to be offered to the next one.
      .catch(() => undefined)
      .then(() => {
        queued = null;

        // No `now`: the follow-up happens later than the call that asked for it, and dating it from
        // that call would read a health window that has already moved.
        return begin();
      });

    return queued;
  };
}

/**
 * T2 §5's retry: capped exponential backoff, 1s → 60s, with full jitter. `attempt` counts from 0.
 */
export function retryDelay(attempt: number, random: () => number = Math.random): number {
  return Math.floor(random() * Math.min(60_000, 1_000 * 2 ** attempt));
}
