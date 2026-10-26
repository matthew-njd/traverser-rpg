import { enqueue, peek } from '../../db/outbox';
import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { type MintedDelta, coalesceQueue } from '../deltas';

/** tech-02 §5: past the cap, merge rather than drop, and lose not one step or minute. */
const NOW = Date.parse('2026-10-25T12:00:00Z');

const delta = (
  id: string,
  activityDate: string,
  source: 'steps' | 'hr',
  amount: number,
  hrTier: 1 | 2 | 3 | null = null,
): MintedDelta => ({
  clientDeltaId: id,
  activityDate,
  source,
  stepsDelta: source === 'steps' ? amount : 0,
  minutesDelta: source === 'hr' ? amount : 0,
  hrTier,
  recordedAt: `2026-10-25T00:00:0${id.slice(-1)}Z`,
});

const queued = (db: ReturnType<typeof memoryDatabase>) =>
  peek(db, 100, 'sync_delta').map((entry) => JSON.parse(entry.payload) as MintedDelta);

const fill = (deltas: MintedDelta[]) => {
  const db = memoryDatabase();

  deltas.forEach((entry, index) =>
    enqueue(db, {
      clientOpId: entry.clientDeltaId,
      kind: 'sync_delta',
      payload: entry,
      createdAt: `2026-10-25T00:00:0${index}Z`,
    }),
  );

  return db;
};

describe('coalesceQueue', () => {
  it('leaves a queue at or under the cap untouched', () => {
    const db = fill([delta('d1', '2026-10-01', 'steps', 100), delta('d2', '2026-10-01', 'steps', 50)]);

    coalesceQueue(db, NOW, 2);

    expect(queued(db).map((entry) => entry.clientDeltaId)).toEqual(['d1', 'd2']);
  });

  it('merges the oldest group back to the cap and keeps every step and minute', () => {
    const db = fill([
      delta('d1', '2026-10-01', 'steps', 100),
      delta('d2', '2026-10-01', 'hr', 10, 2),
      delta('d3', '2026-10-01', 'steps', 50),
      delta('d4', '2026-10-02', 'steps', 7),
      delta('d5', '2026-10-02', 'steps', 3),
    ]);

    coalesceQueue(db, NOW, 4);

    const after = queued(db);

    expect(after).toHaveLength(4);
    // The oldest group merged, under a fresh id, in its first entry's place.
    expect(after[0]).toMatchObject({ activityDate: '2026-10-01', source: 'steps', stepsDelta: 150 });
    expect(['d1', 'd3']).not.toContain(after[0]?.clientDeltaId);
    // A newer group was not touched, because the cap was already met.
    expect(after.filter((entry) => entry.activityDate === '2026-10-02')).toHaveLength(2);
    expect(after.reduce((sum, entry) => sum + entry.stepsDelta + entry.minutesDelta, 0)).toBe(170);
  });

  /** A minute's XP rate is its tier's, so tiers never merge into one another. */
  it('never merges heart-rate minutes across tiers', () => {
    const db = fill([
      delta('d1', '2026-10-01', 'hr', 10, 1),
      delta('d2', '2026-10-01', 'hr', 20, 2),
      delta('d3', '2026-10-01', 'hr', 30, 3),
    ]);

    coalesceQueue(db, NOW, 1);

    expect(queued(db).map((entry) => [entry.hrTier, entry.minutesDelta])).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ]);
  });
});
