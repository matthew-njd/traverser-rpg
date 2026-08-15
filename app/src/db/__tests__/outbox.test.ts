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
   * Same-millisecond deltas are not hypothetical: one read mints one per date and per tier, all
   * stamped from the same clock. Without the tie-break a half-drained queue cannot be resumed.
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

  /** Re-enqueueing after an ambiguous failure is correct, so it must be a no-op, never a duplicate. */
  it('ignores a duplicate client_op_id', () => {
    const db = memoryDatabase();

    enqueue(db, entry('a', '2026-08-03T10:00:00Z', 100));
    enqueue(db, entry('a', '2026-08-03T10:05:00Z', 999));

    expect(count(db)).toBe(1);
    expect(JSON.parse(peek(db, 1)[0]!.payload).steps_delta).toBe(100);
  });

  /** T2 §5 — both lists mean "stop resending". */
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
   * Dropping what was *sent* rather than what was *acknowledged* is the difference between
   * at-least-once delivery and losing a day to a truncated response.
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
   * ↯ Durability tested by actually killing the connection. Android kills a backgrounded app with
   * no warning and no callback (tech-04 §5.3), so this is the ordinary case — a queue flushed on a
   * lifecycle event that never fires loses the walk.
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

  /** One transaction per batch, or the watermark advances past activity only partially queued. */
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
