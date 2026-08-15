import { count, peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { hrMinutesReported, liveSessions, readWatermark, stepHighWater } from '../../db/watermarks';
import { memoryDatabase } from '../../db/__tests__/testDatabase';
import { type MintedDelta, commitHealthRead } from '../deltas';
import { bucketMinutes, segmentSessions, thresholdsForAge } from '../derive';
import type { HealthSnapshot } from '../provider';
import {
  TIER_1_BPM,
  TIER_3_BPM,
  edt,
  edtDates,
  READ_BOTH,
  minutes,
  pastFirstRead,
  recordingDatabase,
} from './fixtures';

/** A database past its first-read baseline — see {@link pastFirstRead}. */
const readyDatabase = () => {
  const db = memoryDatabase();

  pastFirstRead(db);

  return db;
};

/**
 * tech-03 §8 — delta minting against the high-water marks, asserted against fixtures §11.6, §11.7
 * and §11.8. The property under test: the read is cumulative and the merge is additive.
 */

const AGE_30 = thresholdsForAge(30);
const DATE = '2026-07-19';
const READ_AT = edt('2026-07-19T23:59');

const stepSnapshot = (observedTotal: number, consumedThrough = READ_AT): HealthSnapshot => ({
  dailySteps: new Map([[DATE, observedTotal]]),
  sessions: [],
  consumedThrough,
  readSources: READ_BOTH,
});

const hrSnapshot = (samples: Parameters<typeof bucketMinutes>[0]): HealthSnapshot => ({
  dailySteps: new Map(),
  sessions: segmentSessions(bucketMinutes(samples, AGE_30), READ_AT),
  consumedThrough: READ_AT,
  readSources: READ_BOTH,
});

const stepsOf = (deltas: readonly MintedDelta[]) => deltas.map((delta) => delta.stepsDelta);

/**
 * A device's first read credits nothing (tech-03 §4.1). Guards three things at once: every
 * Traverser starts at Level 1, GDD 10 §6's tutorial battle is scripted against Level 1 stats, and a
 * restored identity would otherwise re-mint fresh ids for days the server already holds.
 */
describe('the first read establishes a baseline', () => {
  it('credits nothing and still raises the marks', () => {
    const db = memoryDatabase();

    const first = commitHealthRead(db, stepSnapshot(28_663), edtDates, READ_AT);

    expect(first.deltas).toEqual([]);
    expect(count(db)).toBe(0);
    // The history is accounted for rather than ignored — that is what makes it a baseline.
    expect(stepHighWater(db, DATE)).toBe(28_663);
    expect(readWatermark(db)).toBe(new Date(READ_AT).toISOString());
  });

  it('credits everything walked after it', () => {
    const db = memoryDatabase();

    commitHealthRead(db, stepSnapshot(28_663), edtDates, READ_AT);
    const second = commitHealthRead(db, stepSnapshot(30_663), edtDates, READ_AT);

    expect(stepsOf(second.deltas)).toEqual([2000]);
  });

  it('baselines heart-rate minutes too', () => {
    const db = memoryDatabase();

    const first = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T10:00', 140, TIER_1_BPM)),
      edtDates,
      READ_AT,
    );

    expect(first.deltas).toEqual([]);
    expect(hrMinutesReported(db, DATE, 1)).toBe(140);
  });

  /** The restore case: the server already holds these days, so a fresh device must not re-mint them. */
  it('does not re-credit history after an identity is restored onto a new device', () => {
    const restored = memoryDatabase();

    const first = commitHealthRead(restored, stepSnapshot(28_663), edtDates, READ_AT);

    expect(first.deltas).toEqual([]);
    expect(count(restored)).toBe(0);
  });

  /**
   * The per-source rule. HR needs a birth year, so a fresh install's first pass reads steps and
   * not HR — a single device-wide flag is consumed by steps and HR then credits the whole history.
   */
  it('baselines each source the first time that source is read, not the first time any is', () => {
    const db = memoryDatabase();

    // Pass one: steps readable, heart rate not — no birth year yet.
    const stepsOnly = commitHealthRead(
      db,
      { ...stepSnapshot(28_663), readSources: { steps: true, heartRate: false } },
      edtDates,
      READ_AT,
    );

    expect(stepsOnly.deltas).toEqual([]);

    // Pass two: birth year entered, heart rate readable for the first time. It must not credit the
    // day's accumulated minutes just because *steps* were baselined earlier.
    const withHr = commitHealthRead(
      db,
      {
        ...hrSnapshot(minutes('2026-07-19T10:00', 142, TIER_1_BPM)),
        readSources: READ_BOTH,
      },
      edtDates,
      READ_AT,
    );

    expect(withHr.deltas).toEqual([]);
    expect(hrMinutesReported(db, DATE, 1)).toBe(142);
  });

  /** A source read with nothing to show still marks, or the next read baselines all over again. */
  it('marks a source as read even when it observed nothing', () => {
    const db = memoryDatabase();

    commitHealthRead(
      db,
      { dailySteps: new Map(), sessions: [], consumedThrough: READ_AT, readSources: READ_BOTH },
      edtDates,
      READ_AT,
    );

    // Later the same day, the first real activity appears — and is credited, not baselined away.
    const walked = commitHealthRead(db, stepSnapshot(3000), edtDates, READ_AT);

    expect(stepsOf(walked.deltas)).toEqual([3000]);
  });

  /** The same for heart rate, which is the source that actually arrives late. */
  it('marks heart rate as read even when the window held no minutes', () => {
    const db = memoryDatabase();

    commitHealthRead(
      db,
      { dailySteps: new Map(), sessions: [], consumedThrough: READ_AT, readSources: READ_BOTH },
      edtDates,
      READ_AT,
    );

    const workout = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T10:00', 30, TIER_1_BPM)),
      edtDates,
      READ_AT,
    );

    expect(workout.deltas.map((delta) => [delta.hrTier, delta.minutesDelta])).toEqual([[1, 30]]);
  });

  /** Sessions are still recorded — identity bookkeeping is not crediting. */
  it('still records session identity, so a session spanning the install is not re-minted later', () => {
    const db = memoryDatabase();

    const first = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T10:00', 15, TIER_1_BPM)),
      edtDates,
      READ_AT,
    );

    expect(first.sessions).toHaveLength(1);
    expect(liveSessions(db)).toHaveLength(1);
  });
});

describe('step high-water marks (fixtures §11.7)', () => {
  /**
   * fixtures §11.7 in order on one database. Read 4 is the trap: the delta is against the unlowered
   * mark (200), not the revised observation (500 would re-send 300 already-credited steps).
   */
  it('mints 2000, 3400, nothing, then 200 across a rising total and a revision', () => {
    const db = readyDatabase();
    const minted: number[][] = [];

    for (const observed of [2000, 5400, 5100, 5600]) {
      minted.push(stepsOf(commitHealthRead(db, stepSnapshot(observed), edtDates, READ_AT).deltas));
    }

    expect(minted).toEqual([[2000], [3400], [], [200]]);

    // The sum of everything minted is the final observed total — no step counted twice, none lost.
    expect(minted.flat().reduce((total, steps) => total + steps, 0)).toBe(5600);
  });

  it('does not lower the mark on a downward revision', () => {
    const db = readyDatabase();

    commitHealthRead(db, stepSnapshot(5400), edtDates, READ_AT);
    commitHealthRead(db, stepSnapshot(5100), edtDates, READ_AT);

    expect(stepHighWater(db, DATE)).toBe(5400);
  });

  it('mints nothing at all when a re-read observes exactly what it did before', () => {
    const db = readyDatabase();

    commitHealthRead(db, stepSnapshot(2000), edtDates, READ_AT);
    const replay = commitHealthRead(db, stepSnapshot(2000), edtDates, READ_AT);

    expect(replay.deltas).toEqual([]);
    expect(count(db)).toBe(1);
  });

  it('keeps each date on its own mark', () => {
    const db = readyDatabase();

    const twoDays: HealthSnapshot = {
      dailySteps: new Map([
        ['2026-07-19', 3000],
        ['2026-07-20', 1200],
      ]),
      sessions: [],
      consumedThrough: READ_AT,
      readSources: READ_BOTH,
    };

    const result = commitHealthRead(db, twoDays, edtDates, READ_AT);

    expect(result.deltas.map((delta) => [delta.activityDate, delta.stepsDelta])).toEqual([
      ['2026-07-19', 3000],
      ['2026-07-20', 1200],
    ]);
  });
});

describe('HR minute high-water marks (fixtures §11.6)', () => {
  /**
   * The client column of fixtures §11.6 — 15 then 12, reaching 27, not the capped 20. A client that
   * pre-capped would mint 5 here and the day's `tier3_minutes` would read 20 forever.
   */
  it('mints the increment per (date, tier) and never caps Tier 3', () => {
    const db = readyDatabase();

    const first = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T10:00', 15, TIER_3_BPM)),
      edtDates,
      READ_AT,
    );

    expect(first.deltas).toHaveLength(1);
    expect(first.deltas[0]).toMatchObject({ source: 'hr', hrTier: 3, minutesDelta: 15 });

    const second = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T10:00', 27, TIER_3_BPM)),
      edtDates,
      READ_AT,
    );

    expect(second.deltas[0]).toMatchObject({ hrTier: 3, minutesDelta: 12 });
    expect(hrMinutesReported(db, DATE, 3)).toBe(27);
  });

  it('tracks tiers on the same day independently', () => {
    const db = readyDatabase();

    const result = commitHealthRead(
      db,
      hrSnapshot([
        ...minutes('2026-07-19T10:00', 12, TIER_1_BPM),
        ...minutes('2026-07-19T10:12', 8, TIER_3_BPM),
      ]),
      edtDates,
      READ_AT,
    );

    expect(result.deltas.map((delta) => [delta.hrTier, delta.minutesDelta])).toEqual([
      [1, 12],
      [3, 8],
    ]);
  });

  /**
   * A session crossing midnight pays into two dates. The session is one row; the deltas are two
   * (fixtures §11.5).
   */
  it('splits a midnight-crossing session across two dates', () => {
    const db = readyDatabase();

    const result = commitHealthRead(
      db,
      {
        ...hrSnapshot(minutes('2026-07-19T23:50', 26, TIER_1_BPM)),
        consumedThrough: edt('2026-07-20T02:00'),
        readSources: READ_BOTH,
      },
      edtDates,
      edt('2026-07-20T02:00'),
    );

    expect(result.sessions).toHaveLength(1);
    expect(result.deltas.map((delta) => [delta.activityDate, delta.minutesDelta])).toEqual([
      ['2026-07-19', 10],
      ['2026-07-20', 16],
    ]);
  });
});

describe('session identity (fixtures §11.4, §11.8)', () => {
  /** 10:00–10:14 tiered · 11 silent minutes · 10:26–10:35 tiered — fixtures §11.4's two sessions. */
  const beforeBackfill = [
    ...minutes('2026-07-19T10:00', 15, TIER_1_BPM),
    ...minutes('2026-07-19T10:26', 10, TIER_1_BPM),
  ];

  /** The same read once 10:16–10:24 has backfilled, cutting every gap below the close threshold. */
  const afterBackfill = [
    ...beforeBackfill,
    ...minutes('2026-07-19T10:16', 9, TIER_1_BPM),
  ];

  it('records both sessions when the gap has not yet closed', () => {
    const db = readyDatabase();

    const result = commitHealthRead(db, hrSnapshot(beforeBackfill), edtDates, READ_AT);

    expect(result.sessions.map((session) => session.sessionId)).toEqual([
      'hr:1784469600',
      'hr:1784471160',
    ]);
  });

  /**
   * The earlier id wins (tech-03 §6.2). Minting a third id, or keeping the later one, leaves the
   * server holding two sessions for one workout.
   */
  it('merges two sessions into the earlier id when backfill joins them', () => {
    const db = readyDatabase();

    commitHealthRead(db, hrSnapshot(beforeBackfill), edtDates, READ_AT);
    const merged = commitHealthRead(db, hrSnapshot(afterBackfill), edtDates, READ_AT);

    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0]?.sessionId).toBe('hr:1784469600');
    // 15 + 9 + 10; the two still-silent minutes at 10:15 and 10:25 are in-session but untiered.
    expect(merged.sessions[0]?.tier1Minutes).toBe(34);

    const live = liveSessions(db);

    expect(live).toHaveLength(1);
    expect(live[0]?.sessionId).toBe('hr:1784469600');
    expect(live[0]?.endedAt).toBe(new Date(edt('2026-07-19T10:35')).toISOString());
  });

  /** The start is frozen (tech-03 §6.1): a late-syncing watch keeps the id and start first seen. */
  it('keeps the frozen start when backfill would place the session earlier', () => {
    const db = readyDatabase();

    commitHealthRead(db, hrSnapshot(minutes('2026-07-19T10:00', 15, TIER_1_BPM)), edtDates, READ_AT);

    const earlier = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T09:50', 25, TIER_1_BPM)),
      edtDates,
      READ_AT,
    );

    expect(earlier.sessions[0]?.sessionId).toBe('hr:1784469600');
    expect(earlier.sessions[0]?.startedAt).toBe(edt('2026-07-19T10:00'));
  });

  it('mints a new id for a session that overlaps nothing in the ledger', () => {
    const db = readyDatabase();

    commitHealthRead(db, hrSnapshot(minutes('2026-07-19T10:00', 15, TIER_1_BPM)), edtDates, READ_AT);

    const later = commitHealthRead(
      db,
      hrSnapshot(minutes('2026-07-19T14:00', 15, TIER_1_BPM)),
      edtDates,
      READ_AT,
    );

    expect(later.sessions.map((session) => session.sessionId)).toEqual(['hr:1784484000']);
    expect(liveSessions(db)).toHaveLength(2);
  });
});

describe('the outbox entry', () => {
  it('queues each delta under its own client_delta_id', () => {
    const db = readyDatabase();

    const { deltas } = commitHealthRead(db, stepSnapshot(2000), edtDates, READ_AT);
    const queued = peek(db, 10);

    expect(queued).toHaveLength(1);
    expect(queued[0]?.clientOpId).toBe(deltas[0]?.clientDeltaId);
    expect(queued[0]?.kind).toBe('sync_delta');
    expect(JSON.parse(queued[0]?.payload ?? '{}')).toEqual({
      clientDeltaId: deltas[0]?.clientDeltaId,
      activityDate: DATE,
      source: 'steps',
      stepsDelta: 2000,
      minutesDelta: 0,
      hrTier: null,
      recordedAt: new Date(READ_AT).toISOString(),
    });
  });

  /**
   * Never derived from content (tech-02 §5): two days of the same walk produce the same number, so
   * a content key would collide and silently drop the second.
   */
  it('gives identical-valued deltas distinct ids', () => {
    const db = readyDatabase();

    const first = commitHealthRead(db, stepSnapshot(2000), edtDates, READ_AT);
    const second = commitHealthRead(
      db,
      {
        dailySteps: new Map([['2026-07-20', 2000]]),
        sessions: [],
        consumedThrough: READ_AT,
        readSources: READ_BOTH,
      },
      edtDates,
      READ_AT,
    );

    expect(first.deltas[0]?.stepsDelta).toBe(second.deltas[0]?.stepsDelta);
    expect(first.deltas[0]?.clientDeltaId).not.toBe(second.deltas[0]?.clientDeltaId);
  });
});

describe('the watermark advance (tech-03 §8.4)', () => {
  it('advances the read watermark to the end of the consumed window', () => {
    const db = readyDatabase();

    commitHealthRead(db, stepSnapshot(2000, edt('2026-07-19T18:30')), edtDates, READ_AT);

    expect(readWatermark(db)).toBe(new Date(edt('2026-07-19T18:30')).toISOString());
  });

  /**
   * White-box on purpose: a violation is invisible in the resulting rows — the app comes back from
   * a crash looking healthy with a watermark past a walk it never queued. Also pins the composition,
   * since only a re-entrant `transact` keeps four transactional calls to one `BEGIN`.
   */
  it('performs the whole pass in a single transaction', () => {
    const { db, statements } = recordingDatabase(readyDatabase());

    commitHealthRead(
      db as SqliteDatabase,
      {
        dailySteps: new Map([[DATE, 2000]]),
        sessions: segmentSessions(
          bucketMinutes(minutes('2026-07-19T10:00', 15, TIER_1_BPM), AGE_30),
          READ_AT,
        ),
        consumedThrough: READ_AT,
        readSources: READ_BOTH,
      },
      edtDates,
      READ_AT,
    );

    const begin = statements.findIndex((sql) => sql.startsWith('BEGIN'));
    const commit = statements.findIndex((sql) => sql.startsWith('COMMIT'));
    const ledger = statements.findIndex((sql) => sql.includes('INTO hr_session_ledger'));
    const queued = statements.findIndex((sql) => sql.includes('INTO outbox'));
    const advanced = statements.findIndex((sql) => sql.includes('INTO read_watermark'));

    expect(begin).toBe(0);
    expect(commit).toBe(statements.length - 1);
    expect(statements.filter((sql) => sql.startsWith('BEGIN'))).toHaveLength(1);

    expect(ledger).toBeGreaterThan(begin);
    expect(queued).toBeGreaterThan(begin);
    expect(advanced).toBeGreaterThan(queued);
    expect(advanced).toBeLessThan(commit);
  });

  /** A read that observes nothing new must still not move anything it should not. */
  it('advances nothing when there is nothing to advance', () => {
    const db = readyDatabase();

    const empty: HealthSnapshot = {
      dailySteps: new Map(),
      sessions: [],
      consumedThrough: READ_AT,
      readSources: READ_BOTH,
    };

    const result = commitHealthRead(db, empty, edtDates, READ_AT);

    expect(result).toEqual({ deltas: [], sessions: [] });
    expect(count(db)).toBe(0);
    expect(readWatermark(db)).toBe(new Date(READ_AT).toISOString());
  });
});
