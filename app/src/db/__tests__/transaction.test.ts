import { count, enqueue, enqueueAll } from '../outbox';
import { transact } from '../transaction';
import { memoryDatabase } from './testDatabase';

const entry = (id: string) => ({
  clientOpId: id,
  kind: 'sync_delta' as const,
  payload: { steps_delta: 1 },
  createdAt: '2026-08-03T10:00:00Z',
});

describe('transact', () => {
  it('commits on success', () => {
    const db = memoryDatabase();

    transact(db, () => enqueue(db, entry('a')));

    expect(count(db)).toBe(1);
  });

  it('rolls back and rethrows on failure', () => {
    const db = memoryDatabase();

    expect(() =>
      transact(db, () => {
        enqueue(db, entry('a'));
        throw new Error('nope');
      }),
    ).toThrow('nope');

    expect(count(db)).toBe(0);
  });

  /**
   * ↯ The bug this helper exists for. `expo-sqlite`'s `withTransactionSync` issues a bare `BEGIN`,
   * and SQLite has no nested transactions — so one transactional function calling another throws
   * `cannot start a transaction within a transaction`. That is the required arrangement here, not an
   * exotic one: tech-03 §8.4 makes `commitReadCycle` wrap an atomic enqueue plus the watermark
   * advance in one unit of work. Caught by this suite; it would have thrown on every health read
   * cycle on the device.
   */
  it('nests without opening a second transaction', () => {
    const db = memoryDatabase();

    expect(() =>
      transact(db, () => {
        enqueueAll(db, [entry('a')]);
        enqueueAll(db, [entry('b')]);
      }),
    ).not.toThrow();

    expect(count(db)).toBe(2);
  });

  /** An inner failure that the outer block catches must not take the outer work down with it. */
  it('rolls an inner block back to its own boundary', () => {
    const db = memoryDatabase();

    transact(db, () => {
      enqueue(db, entry('outer'));

      try {
        transact(db, () => {
          enqueue(db, entry('inner'));
          throw new Error('inner failed');
        });
      } catch {
        // Deliberately swallowed — the outer unit of work continues.
      }

      enqueue(db, entry('after'));
    });

    const ids = db
      .getAllSync<{ client_op_id: string }>('SELECT client_op_id FROM outbox ORDER BY client_op_id')
      .map((r) => r.client_op_id);

    expect(ids).toEqual(['after', 'outer']);
  });

  /** An inner failure that propagates must still roll back everything. */
  it('rolls the whole transaction back when an inner failure escapes', () => {
    const db = memoryDatabase();

    expect(() =>
      transact(db, () => {
        enqueue(db, entry('outer'));
        transact(db, () => {
          throw new Error('boom');
        });
      }),
    ).toThrow('boom');

    expect(count(db)).toBe(0);
  });

  /** Depth must return to zero after a failure, or every later write runs unprotected. */
  it('recovers its depth after a failure', () => {
    const db = memoryDatabase();

    expect(() => transact(db, () => { throw new Error('first'); })).toThrow('first');

    transact(db, () => enqueue(db, entry('a')));

    expect(count(db)).toBe(1);

    expect(() =>
      transact(db, () => {
        enqueue(db, entry('b'));
        throw new Error('second');
      }),
    ).toThrow('second');

    expect(count(db)).toBe(1);
  });

  it('handles three levels of nesting', () => {
    const db = memoryDatabase();

    transact(db, () =>
      transact(db, () =>
        transact(db, () => {
          enqueue(db, entry('deep'));
        }),
      ),
    );

    expect(count(db)).toBe(1);
  });

  /** Two databases must not share a depth counter. */
  it('tracks depth per database', () => {
    const first = memoryDatabase();
    const second = memoryDatabase();

    transact(first, () => {
      transact(second, () => enqueue(second, entry('b')));
      enqueue(first, entry('a'));
    });

    expect(count(first)).toBe(1);
    expect(count(second)).toBe(1);
  });
});
