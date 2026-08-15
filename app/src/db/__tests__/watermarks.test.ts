import { count, peek } from '../outbox';
import { transact } from '../transaction';
import {
  commitReadCycle,
  findSession,
  hrMinuteDelta,
  hrMinutesReported,
  liveSessions,
  mergeSessions,
  raiseHrMinutesReported,
  raiseStepHighWater,
  readWatermark,
  recordSession,
  stepDelta,
  stepHighWater,
} from '../watermarks';
import { FileDatabase, memoryDatabase } from './testDatabase';

const DATE = '2026-08-03';

describe('step high-water mark (tech-03 §8.1)', () => {
  it('starts at zero and mints the full observed total', () => {
    const db = memoryDatabase();

    expect(stepHighWater(db, DATE)).toBe(0);
    expect(stepDelta(db, DATE, 2000)).toBe(2000);
  });

  /**
   * fixtures §11.7 walked exactly: total minted must equal the final observed total, 5,600. Read 4
   * is the trap — the delta is against the unlowered mark (200), not the revision (500).
   */
  it('follows the fixtures §11.7 sequence including the downward revision', () => {
    const db = memoryDatabase();
    const minted: number[] = [];

    const read = (observedTotal: number) => {
      const delta = stepDelta(db, DATE, observedTotal);

      minted.push(delta);

      if (delta > 0) {
        raiseStepHighWater(db, DATE, observedTotal);
      }
    };

    read(2000);
    read(5400);
    read(5100); // downward revision
    read(5600);

    expect(minted).toEqual([2000, 3400, 0, 200]);
    expect(minted.reduce((a, b) => a + b, 0)).toBe(5600);
    expect(stepHighWater(db, DATE)).toBe(5600);
  });

  /** Never lowered: XP is never taken back (GDD 1 §1), and the steps would re-send on recovery. */
  it('refuses to lower the mark even if asked directly', () => {
    const db = memoryDatabase();

    raiseStepHighWater(db, DATE, 5400);
    raiseStepHighWater(db, DATE, 5100);

    expect(stepHighWater(db, DATE)).toBe(5400);
  });

  it('keeps marks per date', () => {
    const db = memoryDatabase();

    raiseStepHighWater(db, '2026-08-03', 5000);

    expect(stepHighWater(db, '2026-08-04')).toBe(0);
    expect(stepDelta(db, '2026-08-04', 1200)).toBe(1200);
  });
});

describe('HR minute watermark (tech-03 §8.2)', () => {
  it('tracks minutes per date and tier independently', () => {
    const db = memoryDatabase();

    raiseHrMinutesReported(db, DATE, 2, 30);

    expect(hrMinutesReported(db, DATE, 2)).toBe(30);
    expect(hrMinutesReported(db, DATE, 3)).toBe(0);
    expect(hrMinuteDelta(db, DATE, 2, 37)).toBe(7);
    expect(hrMinuteDelta(db, DATE, 3, 12)).toBe(12);
  });

  /** tech-03 §5.5 — raw uncapped Tier 3; pre-capping under-reports `tier3_minutes` permanently. */
  it('reports raw tier 3 minutes without applying the daily cap', () => {
    const db = memoryDatabase();

    expect(hrMinuteDelta(db, DATE, 3, 15)).toBe(15);
    raiseHrMinutesReported(db, DATE, 3, 15);

    expect(hrMinuteDelta(db, DATE, 3, 27)).toBe(12);
    raiseHrMinutesReported(db, DATE, 3, 27);

    expect(hrMinutesReported(db, DATE, 3)).toBe(27);
  });

  it('never lowers a tier mark', () => {
    const db = memoryDatabase();

    raiseHrMinutesReported(db, DATE, 1, 45);
    raiseHrMinutesReported(db, DATE, 1, 40);

    expect(hrMinutesReported(db, DATE, 1)).toBe(45);
  });

  it('rejects a tier outside 1-3', () => {
    const db = memoryDatabase();

    expect(() => raiseHrMinutesReported(db, DATE, 4, 10)).toThrow();
  });
});

describe('read watermark ordering (tech-03 §8.4)', () => {
  it('is null before the first consumed read', () => {
    expect(readWatermark(memoryDatabase())).toBeNull();
  });

  it('advances once a cycle commits', () => {
    const db = memoryDatabase();

    commitReadCycle(db, {
      deltas: [
        {
          clientOpId: 'd1',
          kind: 'sync_delta',
          payload: { steps_delta: 2000 },
          createdAt: '2026-08-03T10:00:00Z',
        },
      ],
      stepMarks: [{ activityDate: DATE, observedTotal: 2000 }],
      hrMarks: [],
      consumedThrough: '2026-08-03T10:00:00Z',
    });

    expect(readWatermark(db)).toBe('2026-08-03T10:00:00Z');
    expect(count(db)).toBe(1);
    expect(stepHighWater(db, DATE)).toBe(2000);
  });

  /**
   * tech-03 §8.4's ordering: the watermark advances only after the deltas are queued, so a crash
   * between read and enqueue re-reads the same window. The other order loses a walk silently.
   */
  it('leaves the watermark untouched when a cycle fails part-way', () => {
    const db = memoryDatabase();

    expect(() =>
      transact(db, () => {
        commitReadCycle(db, {
          deltas: [
            {
              clientOpId: 'd1',
              kind: 'sync_delta',
              payload: { steps_delta: 2000 },
              createdAt: '2026-08-03T10:00:00Z',
            },
          ],
          stepMarks: [{ activityDate: DATE, observedTotal: 2000 }],
          hrMarks: [],
          consumedThrough: '2026-08-03T10:00:00Z',
        });

        throw new Error('killed after the read, before anything durable');
      }),
    ).toThrow('killed after the read, before anything durable');

    // Nothing moved: the same window will be re-read and produce the same deltas.
    expect(readWatermark(db)).toBeNull();
    expect(count(db)).toBe(0);
    expect(stepHighWater(db, DATE)).toBe(0);
  });

  /**
   * White-box on purpose — the black-box versions cannot see this failure. **Verified by
   * mutation:** moving `setReadWatermark` outside the transaction, in either direction, passes
   * every other test in this file. Before it a crash loses the walk; after it the re-read mints
   * fresh UUIDv7s the idempotency ledger cannot match, and the day is credited twice.
   *
   * The "fails part-way" test cannot catch either — its outer transaction's rollback hides any
   * write that escaped the inner one.
   */
  it('performs every write of a cycle inside one transaction', () => {
    const db = memoryDatabase();
    const statements: string[] = [];

    const recording = {
      ...db,
      execSync: (sql: string) => {
        statements.push(sql.trim());

        return db.execSync(sql);
      },
      runSync: (sql: string, params?: Parameters<typeof db.runSync>[1]) => {
        statements.push(sql.trim());

        return db.runSync(sql, params);
      },
      getAllSync: db.getAllSync.bind(db),
      getFirstSync: db.getFirstSync.bind(db),
      closeSync: db.closeSync.bind(db),
    };

    commitReadCycle(recording, {
      deltas: [
        {
          clientOpId: 'd1',
          kind: 'sync_delta',
          payload: { steps_delta: 2000 },
          createdAt: '2026-08-03T10:00:00Z',
        },
      ],
      stepMarks: [{ activityDate: DATE, observedTotal: 2000 }],
      hrMarks: [],
      consumedThrough: '2026-08-03T10:00:00Z',
    });

    const begin = statements.findIndex((s) => s.startsWith('BEGIN'));
    const commit = statements.findIndex((s) => s.startsWith('COMMIT'));
    const queued = statements.findIndex((s) => s.includes('INTO outbox'));
    const advanced = statements.findIndex((s) => s.includes('INTO read_watermark'));

    expect(begin).toBe(0);
    expect(commit).toBe(statements.length - 1);

    // Both inside the one transaction, queue write first — the order the spec states.
    expect(queued).toBeGreaterThan(begin);
    expect(advanced).toBeGreaterThan(queued);
    expect(advanced).toBeLessThan(commit);

    // Exactly one transaction: the nested enqueue must have used a savepoint, not a second BEGIN.
    expect(statements.filter((s) => s.startsWith('BEGIN'))).toHaveLength(1);
  });

  /** Across a real process death: a watermark in the reopened database implies its deltas. */
  it('keeps deltas and watermark consistent across process death', () => {
    const file = new FileDatabase();

    try {
      const before = file.open();

      commitReadCycle(before, {
        deltas: [
          {
            clientOpId: 'd1',
            kind: 'sync_delta',
            payload: { steps_delta: 3200 },
            createdAt: '2026-08-03T10:00:00Z',
          },
        ],
        stepMarks: [{ activityDate: DATE, observedTotal: 3200 }],
        hrMarks: [{ activityDate: DATE, tier: 2, observedMinutes: 20 }],
        consumedThrough: '2026-08-03T10:00:00Z',
      });

      file.kill();

      const after = file.open();

      expect(readWatermark(after)).toBe('2026-08-03T10:00:00Z');
      expect(peek(after, 10).map((e) => e.clientOpId)).toEqual(['d1']);
      expect(stepHighWater(after, DATE)).toBe(3200);
      expect(hrMinutesReported(after, DATE, 2)).toBe(20);
    } finally {
      file.cleanup();
    }
  });

  /** The re-read produces the same deltas, which is what makes it safe rather than duplicative. */
  it('re-reading the same window after a failed cycle mints the same delta', () => {
    const db = memoryDatabase();

    const attemptCycle = (shouldFail: boolean) => {
      const delta = stepDelta(db, DATE, 2000);

      const run = () =>
        commitReadCycle(db, {
          deltas: [
            {
              clientOpId: 'd1',
              kind: 'sync_delta',
              payload: { steps_delta: delta },
              createdAt: '2026-08-03T10:00:00Z',
            },
          ],
          stepMarks: [{ activityDate: DATE, observedTotal: 2000 }],
          hrMarks: [],
          consumedThrough: '2026-08-03T10:00:00Z',
        });

      if (shouldFail) {
        expect(() =>
          transact(db, () => {
            run();
            throw new Error('crash');
          }),
        ).toThrow('crash');
      } else {
        run();
      }

      return delta;
    };

    expect(attemptCycle(true)).toBe(2000);
    expect(attemptCycle(false)).toBe(2000);
    expect(count(db)).toBe(1);
  });
});

describe('session ledger (tech-03 §6)', () => {
  const early = { sessionId: 'hr:1000', startedAt: '2026-08-03T10:00:00Z', endedAt: '2026-08-03T10:20:00Z' };
  const late = { sessionId: 'hr:2000', startedAt: '2026-08-03T10:28:00Z', endedAt: '2026-08-03T10:45:00Z' };

  /** The frozen start: the id derives from `started_at`, so a moved start is a second session. */
  it('freezes started_at on first observation and only grows ended_at', () => {
    const db = memoryDatabase();

    recordSession(db, early);
    recordSession(db, { ...early, startedAt: '2026-08-03T09:45:00Z', endedAt: '2026-08-03T10:35:00Z' });

    const stored = findSession(db, early.sessionId);

    expect(stored?.startedAt).toBe('2026-08-03T10:00:00Z');
    expect(stored?.endedAt).toBe('2026-08-03T10:35:00Z');
  });

  it('never shortens a session', () => {
    const db = memoryDatabase();

    recordSession(db, early);
    recordSession(db, { ...early, endedAt: '2026-08-03T10:05:00Z' });

    expect(findSession(db, early.sessionId)?.endedAt).toBe('2026-08-03T10:20:00Z');
  });

  /** tech-03 §6.2 — the earlier id wins and the later is tombstoned, never sent again. */
  it('merges the later session into the earlier one', () => {
    const db = memoryDatabase();

    recordSession(db, early);
    recordSession(db, late);
    mergeSessions(db, early.sessionId, late.sessionId);

    expect(findSession(db, early.sessionId)?.endedAt).toBe(late.endedAt);
    expect(findSession(db, late.sessionId)?.tombstonedInto).toBe(early.sessionId);
    expect(liveSessions(db).map((s) => s.sessionId)).toEqual([early.sessionId]);
  });

  it('refuses a merge that would keep the later session', () => {
    const db = memoryDatabase();

    recordSession(db, early);
    recordSession(db, late);

    expect(() => mergeSessions(db, late.sessionId, early.sessionId)).toThrow(/earlier session/);
  });

  it('refuses to merge sessions it does not know', () => {
    const db = memoryDatabase();

    recordSession(db, early);

    expect(() => mergeSessions(db, early.sessionId, 'hr:9999')).toThrow(/unknown/);
  });
});
