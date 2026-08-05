import { count, peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { recordingDatabase } from '../../health/__tests__/fixtures';
import { readBirthYear, readPlayer } from '../mirror';
import { AllocationError, NO_STATS, allocateStatPoints, changeSettings } from '../writes';
import { registeredDatabase } from './fixtures';

/**
 * tech-02 §3's progression writes — the endpoints that apply optimistically to the mirror and replay
 * to the server.
 */

const NOW = Date.parse('2026-08-04T10:00:00Z');

const spend = (db: SqliteDatabase, deltas: Partial<typeof NO_STATS>) =>
  allocateStatPoints(db, { ...NO_STATS, ...deltas }, NOW);

describe('stat allocation', () => {
  it('applies to the mirror and queues the replay', () => {
    const db = registeredDatabase({ unspent_stat_points: 6 });

    const payload = spend(db, { might: 2, vigor: 1 });

    expect(readPlayer(db)).toMatchObject({
      allocMight: 2,
      allocVigor: 1,
      unspentStatPoints: 3,
    });

    const queued = peek(db, 10);

    expect(queued).toHaveLength(1);
    expect(queued[0]?.kind).toBe('allocation');
    expect(queued[0]?.clientOpId).toBe(payload.operationId);
    expect(JSON.parse(queued[0]?.payload ?? '{}')).toMatchObject({
      operationId: payload.operationId,
      might: 2,
      vigor: 1,
      resolve: 0,
    });
  });

  /**
   * ↯ Neither half is safe alone. A mirror updated without a queued replay is a change the server
   * never hears about; a queued replay without the mirror update is a change the player cannot see.
   * The app is offline most of the time by design, so "the next sync will fix it" is not a recovery.
   */
  it('writes the mirror and the queue in one transaction', () => {
    const { db, statements } = recordingDatabase(registeredDatabase({ unspent_stat_points: 3 }));

    statements.length = 0;

    spend(db as SqliteDatabase, { might: 3 });

    const begin = statements.findIndex((sql) => sql.startsWith('BEGIN'));
    const commit = statements.findIndex((sql) => sql.startsWith('COMMIT'));
    const mirror = statements.findIndex((sql) => sql.includes('UPDATE player SET'));
    const queued = statements.findIndex((sql) => sql.includes('INTO outbox'));

    expect(begin).toBe(0);
    expect(commit).toBe(statements.length - 1);
    expect(statements.filter((sql) => sql.startsWith('BEGIN'))).toHaveLength(1);
    expect(mirror).toBeGreaterThan(begin);
    expect(queued).toBeGreaterThan(begin);
    expect(queued).toBeLessThan(commit);
  });

  it('refuses to spend more points than are unspent, and changes nothing', () => {
    const db = registeredDatabase({ unspent_stat_points: 2 });

    expect(() => spend(db, { might: 3 })).toThrow(AllocationError);
    expect(readPlayer(db)).toMatchObject({ allocMight: 0, unspentStatPoints: 2 });
    expect(count(db)).toBe(0);
  });

  it('refuses a negative delta', () => {
    const db = registeredDatabase({ unspent_stat_points: 6 });

    expect(() => spend(db, { might: 3, vigor: -1 })).toThrow(AllocationError);
    expect(count(db)).toBe(0);
  });

  it('refuses an empty allocation', () => {
    expect(() => spend(registeredDatabase({ unspent_stat_points: 3 }), {})).toThrow(AllocationError);
  });

  it('spends the full balance exactly', () => {
    const db = registeredDatabase({ unspent_stat_points: 3 });

    spend(db, { stride: 3 });

    expect(readPlayer(db)).toMatchObject({ allocStride: 3, unspentStatPoints: 0 });
  });

  /** ↯ Minted once and reused on retry — a fresh id per attempt is the difference from doubling. */
  it('gives each allocation its own operation id', () => {
    const db = registeredDatabase({ unspent_stat_points: 6 });

    const first = spend(db, { might: 1 });
    const second = spend(db, { might: 1 });

    expect(first.operationId).not.toBe(second.operationId);
    expect(count(db)).toBe(2);
  });
});

describe('settings', () => {
  it('applies the step goal locally and queues it', () => {
    const db = registeredDatabase();

    changeSettings(db, { dailyStepGoal: 9000, birthYear: null }, NOW);

    expect(readPlayer(db)?.dailyStepGoal).toBe(9000);

    const queued = peek(db, 10);

    expect(queued[0]?.kind).toBe('settings');
    expect(JSON.parse(queued[0]?.payload ?? '{}')).toEqual({
      dailyStepGoal: 9000,
      birthYear: null,
    });
  });

  it('applies the birth year locally', () => {
    const db = registeredDatabase();

    changeSettings(db, { dailyStepGoal: null, birthYear: 1985 }, NOW);

    expect(readBirthYear(db)).toBe(1985);
  });

  /** ↯ Null means *leave alone*, not *clear* — a partial update must not be destructive (§6.3). */
  it('leaves a null field untouched', () => {
    const db = registeredDatabase();

    changeSettings(db, { dailyStepGoal: 9000, birthYear: null }, NOW);

    expect(readBirthYear(db)).toBe(1990);
    expect(readPlayer(db)?.dailyStepGoal).toBe(9000);
  });

  it('queues nothing when there is nothing to change', () => {
    const db = registeredDatabase();

    changeSettings(db, { dailyStepGoal: null, birthYear: null }, NOW);

    expect(count(db)).toBe(0);
  });
});
