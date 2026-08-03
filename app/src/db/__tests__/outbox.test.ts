import { acknowledge, count, enqueue, enqueueAll, peek, recordAttempt } from '../outbox';
import { transact } from '../transaction';
import { FileDatabase, memoryDatabase } from './testDatabase';

const entry = (id: string, createdAt: string, steps = 100) => ({
  clientOpId: id,
  kind: 'sync_delta' as const,
  payload: { activity_date: '2026-08-03', steps_delta: steps },
  createdAt,
});

describe('outbox', () => {
  it('drains FIFO by created_at', () => {
    const db = memoryDatabase();

    // Enqueued out of order on purpose — insertion order must not be what the drain follows.
    enqueue(db, entry('c', '2026-08-03T10:02:00Z'));
    enqueue(db, entry('a', '2026-08-03T10:00:00Z'));
    enqueue(db, entry('b', '2026-08-03T10:01:00Z'));

    expect(peek(db, 10).map((e) => e.clientOpId)).toEqual(['a', 'b', 'c']);
  });

  /**
   * ↯ Two deltas minted in the same millisecond are not hypothetical — tech-03 §8.1's high-water
   * marks mint one delta per date and per tier from a single read, all stamped from the same clock
   * read. Without the tie-break the drain order is whatever SQLite happens to return, which means a
   * drain interrupted half-way cannot be resumed deterministically.
   */
  it('breaks created_at ties by client_op_id', () => {
    const db = memoryDatabase();
    const sameInstant = '2026-08-03T10:00:00Z';

    enqueue(db, entry('0192f0c0-0003', sameInstant));
    enqueue(db, entry('0192f0c0-0001', sameInstant));
    enqueue(db, entry('0192f0c0-0002', sameInstant));

    expect(peek(db, 10).map((e) => e.clientOpId)).toEqual([
      '0192f0c0-0001',
      '0192f0c0-0002',
      '0192f0c0-0003',
    ]);
  });

  it('respects the peek limit and keeps the rest queued', () => {
    const db = memoryDatabase();

    enqueueAll(db, [
      entry('a', '2026-08-03T10:00:00Z'),
      entry('b', '2026-08-03T10:01:00Z'),
      entry('c', '2026-08-03T10:02:00Z'),
    ]);

    expect(peek(db, 2).map((e) => e.clientOpId)).toEqual(['a', 'b']);
    expect(count(db)).toBe(3);
  });

  it('round-trips the payload untouched', () => {
    const db = memoryDatabase();

    enqueue(db, entry('a', '2026-08-03T10:00:00Z', 4321));

    const [queued] = peek(db, 1);

    expect(JSON.parse(queued!.payload)).toEqual({ activity_date: '2026-08-03', steps_delta: 4321 });
    expect(queued!.attempts).toBe(0);
  });

  /**
   * ↯ Re-enqueueing the same id is the correct behaviour after an ambiguous failure, so it must be
   * a no-op rather than a crash — and it must not duplicate, because `client_op_id` is the server's
   * idempotency key and two rows would be two uploads of one fact.
   */
  it('ignores a duplicate client_op_id', () => {
    const db = memoryDatabase();

    enqueue(db, entry('a', '2026-08-03T10:00:00Z', 100));
    enqueue(db, entry('a', '2026-08-03T10:05:00Z', 999));

    expect(count(db)).toBe(1);
    expect(JSON.parse(peek(db, 1)[0]!.payload).steps_delta).toBe(100);
  });

  /**
   * T2 §5: an entry is removed only once the server names its id. Both `accepted_delta_ids` and
   * `duplicate_delta_ids` mean the same thing here — stop resending.
   */
  it('removes only acknowledged entries', () => {
    const db = memoryDatabase();

    enqueueAll(db, [
      entry('a', '2026-08-03T10:00:00Z'),
      entry('b', '2026-08-03T10:01:00Z'),
      entry('c', '2026-08-03T10:02:00Z'),
    ]);

    expect(acknowledge(db, ['a', 'c'])).toBe(2);
    expect(peek(db, 10).map((e) => e.clientOpId)).toEqual(['b']);
  });

  /**
   * ↯ The entry the server did not name has *not* been accounted for. Dropping everything that was
   * sent — rather than everything that was acknowledged — is the difference between at-least-once
   * delivery and losing a day's steps to a truncated response.
   */
  it('keeps entries the server did not acknowledge', () => {
    const db = memoryDatabase();

    enqueueAll(db, [entry('a', '2026-08-03T10:00:00Z'), entry('b', '2026-08-03T10:01:00Z')]);

    acknowledge(db, ['a']);

    expect(peek(db, 10).map((e) => e.clientOpId)).toEqual(['b']);
  });

  it('tolerates acknowledging an id it never held', () => {
    const db = memoryDatabase();

    enqueue(db, entry('a', '2026-08-03T10:00:00Z'));

    expect(acknowledge(db, ['ghost'])).toBe(0);
    expect(count(db)).toBe(1);
  });

  it('counts attempts', () => {
    const db = memoryDatabase();

    enqueue(db, entry('a', '2026-08-03T10:00:00Z'));
    recordAttempt(db, ['a']);
    recordAttempt(db, ['a']);

    expect(peek(db, 1)[0]!.attempts).toBe(2);
  });

  /**
   * ↯ **The durability requirement, tested by actually killing the connection.** T2 §5 fixes the
   * contract as "an entry survives process death", and Android kills a backgrounded app without
   * warning and without a callback (tech-04 §5.3) — so this is the ordinary case, not an edge case.
   * A queue held in memory, or flushed on a lifecycle event that never fires, loses the walk.
   */
  it('survives process death with its order and payloads intact', () => {
    const file = new FileDatabase();

    try {
      const before = file.open();

      enqueueAll(before, [
        entry('a', '2026-08-03T10:00:00Z', 1000),
        entry('b', '2026-08-03T10:01:00Z', 2000),
        entry('c', '2026-08-03T10:02:00Z', 3000),
      ]);

      recordAttempt(before, ['a']);
      acknowledge(before, ['a']);

      // No close handler, no flush — the process simply ends.
      file.kill();

      const after = file.open();
      const queued = peek(after, 10);

      expect(queued.map((e) => e.clientOpId)).toEqual(['b', 'c']);
      expect(JSON.parse(queued[0]!.payload).steps_delta).toBe(2000);
    } finally {
      file.cleanup();
    }
  });

  /**
   * A batch is enqueued in one transaction, so a failure part-way leaves none of it. Anything else
   * would break tech-03 §8.4: the watermark would advance past activity only partially queued.
   */
  it('enqueues a batch atomically', () => {
    const db = memoryDatabase();

    expect(() =>
      transact(db, () => {
        enqueueAll(db, [entry('a', '2026-08-03T10:00:00Z')]);

        throw new Error('interrupted');
      }),
    ).toThrow('interrupted');

    expect(count(db)).toBe(0);
  });

  it('treats an empty batch as a no-op', () => {
    const db = memoryDatabase();

    enqueueAll(db, []);

    expect(count(db)).toBe(0);
    expect(acknowledge(db, [])).toBe(0);
  });
});
