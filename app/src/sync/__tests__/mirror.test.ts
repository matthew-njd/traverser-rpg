import { readFreshRewards, readOwnedGear, readSatchel } from '../../battle/mirror';
import { seedEmbeddedContent } from '../../content/store';
import { count, enqueue, peek } from '../../db/outbox';
import { recordingDatabase } from '../../health/__tests__/fixtures';
import type { SqliteDatabase } from '../../db/types';
import { parseSyncResponse } from '../dto';
import {
  applySyncResponse,
  readActivityDay,
  readBirthYear,
  readPlayer,
  readStreak,
  writeProjection,
} from '../mirror';
import { PLAYER_ID, registeredDatabase, wireActivityDay, wirePlayer, wireSyncResponse } from './fixtures';

/**
 * L2, the mirror (tech-04 §5.2) — and the one distinction that decides whether it is right:
 * **the mirror mirrors, it does not merge.**
 */

const response = (overrides: Record<string, unknown> = {}) =>
  parseSyncResponse(wireSyncResponse(overrides));

const queueDelta = (db: SqliteDatabase, id: string) =>
  enqueue(db, {
    clientOpId: id,
    kind: 'sync_delta',
    payload: { stepsDelta: 1 },
    createdAt: '2026-08-03T12:00:00.000Z',
  });

describe('applying a sync response', () => {
  it('writes the player block through', () => {
    const db = registeredDatabase();

    applySyncResponse(db, response({ player: wirePlayer({ level: 12, xp_current: 95 }) }));

    expect(readPlayer(db)).toMatchObject({ level: 12, xpCurrent: 95, playerId: PLAYER_ID });
  });

  /**
   * The whole point. tech-02 §6.1's `col = col + delta` is the *server's* discipline; what comes
   * back is the absolute result, stored verbatim. Adding it doubles every sync, and the mistake is
   * the word "delta" is everywhere else in this protocol.
   */
  it('replaces the mirror rather than adding to it', () => {
    const db = registeredDatabase({ lifetime_steps: 205_000, xp_lifetime: 12_400 });

    applySyncResponse(
      db,
      response({ player: wirePlayer({ lifetime_steps: 219_200, xp_lifetime: 13_335 }) }),
    );

    expect(readPlayer(db)?.lifetimeSteps).toBe(219_200);
    expect(readPlayer(db)?.xpLifetime).toBe(13_335);
  });

  it('replaces an activity day it has already seen', () => {
    const db = registeredDatabase();

    applySyncResponse(db, response({ activity_days: [wireActivityDay({ steps: 8000 })] }));
    applySyncResponse(db, response({ activity_days: [wireActivityDay({ steps: 9500 })] }));

    expect(readActivityDay(db, '2026-08-02')?.steps).toBe(9500);
  });

  /**
   * ↯ **Sync reports a grant exactly once.** The server has already charged it against the day's
   * cap, so a response applied without storing it is an encounter the player walked for and will
   * never be offered — which is why this lands in the same transaction as the acknowledgement.
   */
  it('stores the encounter grants a sync issued, and ignores a repeat', () => {
    const db = registeredDatabase();
    const grant = {
      grant_id: 'g1',
      zone_id: 'olympion',
      enemy_id: 'enemy_harpy',
      source: 'travel',
      activity_date: '2026-08-03',
    };

    applySyncResponse(db, response({ encounter_grants: [grant] }));
    applySyncResponse(db, response({ encounter_grants: [grant] }));

    expect(
      db.getAllSync<{ grant_id: string; enemy_id: string }>(
        'SELECT grant_id, enemy_id FROM encounter_grant',
      ),
    ).toEqual([{ grant_id: 'g1', enemy_id: 'enemy_harpy' }]);
  });

  it('opens the zones step 7 unlocked', () => {
    const db = registeredDatabase();

    applySyncResponse(db, response({ unlocked_zone_ids: ['valheon'] }));

    expect(
      db.getAllSync<{ zone_id: string }>('SELECT zone_id FROM player_zone_progress'),
    ).toEqual([{ zone_id: 'valheon' }]);
  });

  it('stores the streak block', () => {
    const db = registeredDatabase();

    applySyncResponse(db, response({ streak: { current: 9, longest: 22, last_credited_date: '2026-08-03' } }));

    expect(readStreak(db)).toEqual({ current: 9, longest: 22, lastCreditedDate: '2026-08-03' });
  });

  /**
   * Acknowledged from `accepted ∪ duplicate`, never from "everything we sent". Both lists mean
   * *stop resending*; an entry the server did not name has not been accounted for and must survive.
   */
  it('drops the entries the server named, in either list', () => {
    const db = registeredDatabase();

    queueDelta(db, 'accepted');
    queueDelta(db, 'duplicate');
    queueDelta(db, 'unmentioned');

    applySyncResponse(
      db,
      response({ accepted_delta_ids: ['accepted'], duplicate_delta_ids: ['duplicate'] }),
    );

    expect(peek(db, 10).map((entry) => entry.clientOpId)).toEqual(['unmentioned']);
  });

  it('keeps everything queued when the server names nothing', () => {
    const db = registeredDatabase();

    queueDelta(db, 'a');
    applySyncResponse(db, response());

    expect(count(db)).toBe(1);
  });

  /**
   * Response and dequeue are one transaction. The dangerous order is dropping the queue first: a
   * crash before the mirror is written loses the only local record those deltas existed, and the
   * health watermark moved past them a step earlier.
   */
  it('applies the response and drops the queue in one transaction', () => {
    const { db, statements } = recordingDatabase(registeredDatabase());

    queueDelta(db as SqliteDatabase, 'accepted');

    statements.length = 0;

    applySyncResponse(db as SqliteDatabase, response({ accepted_delta_ids: ['accepted'] }));

    const begin = statements.findIndex((sql) => sql.startsWith('BEGIN'));
    const commit = statements.findIndex((sql) => sql.startsWith('COMMIT'));
    const player = statements.findIndex((sql) => sql.includes('INTO player'));
    const dequeued = statements.findIndex((sql) => sql.includes('DELETE FROM outbox'));

    expect(begin).toBe(0);
    expect(commit).toBe(statements.length - 1);
    expect(statements.filter((sql) => sql.startsWith('BEGIN'))).toHaveLength(1);
    expect(player).toBeGreaterThan(begin);
    expect(dequeued).toBeGreaterThan(player);
    expect(dequeued).toBeLessThan(commit);
  });
});

describe('the provisional flag (tech-04 §8.4)', () => {
  it('is set by a projection and cleared by a response', () => {
    const db = registeredDatabase();

    writeProjection(db, { xpCurrent: 900, xpLifetime: 12_900, lifetimeSteps: 210_000 });

    expect(readPlayer(db)).toMatchObject({ provisional: true, xpCurrent: 900 });

    applySyncResponse(db, response());

    expect(readPlayer(db)).toMatchObject({ provisional: false, xpCurrent: 400 });
  });

  /**
   * A projection writes three columns and no others. It has no authority over level, unspent
   * points or allocations — and those are exactly the fields a player can change from another screen
   * while a sync is in flight.
   */
  it('leaves every other column alone', () => {
    const db = registeredDatabase({ level: 11, unspent_stat_points: 6 });

    writeProjection(db, { xpCurrent: 900, xpLifetime: 12_900, lifetimeSteps: 210_000 });

    expect(readPlayer(db)).toMatchObject({ level: 11, unspentStatPoints: 6 });
  });
});

describe('reads', () => {
  it('reports no player before registration', () => {
    const db = registeredDatabase();

    db.runSync('DELETE FROM player', []);

    expect(readPlayer(db)).toBeNull();
  });

  it('reports a zeroed streak before the first sync', () => {
    expect(readStreak(registeredDatabase())).toEqual({
      current: 0,
      longest: 0,
      lastCreditedDate: null,
    });
  });

  /** Null means *not yet collected*, which is why it is not defaulted (tech-03 §1.4). */
  it('reads the birth year, and reports null when it has not been collected', () => {
    const db = registeredDatabase();

    expect(readBirthYear(db)).toBe(1990);

    db.runSync('UPDATE player_settings SET birth_year = NULL', []);

    expect(readBirthYear(db)).toBeNull();
  });
});

describe('step 10 rewards', () => {
  const salve = {
    kind: 'item',
    id: '01a1750b-0000-7000-8000-000000000001',
    def_id: 'item_travelers_salve',
    source: 'daily_goal',
    level_at_drop: null,
    bonus_primary: null,
    bonus_secondary: null,
    acquired_at: '2026-10-25T12:00:00Z',
  };
  const blade = {
    ...salve,
    kind: 'gear',
    id: '01a1750b-0000-7000-8000-000000000002',
    def_id: 'gear_weapon_heroic',
    source: 'level_milestone',
    level_at_drop: 15,
    bonus_primary: 4,
  };

  /** The response carries no inventory, so this is the only way a reward reaches the satchel. */
  it('mirrors each reward with the server id, and queues it as fresh', () => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);
    applySyncResponse(db, response({ rewards_granted: [salve, blade] }));

    expect(readSatchel(db).map((item) => item.playerItemId)).toContain(salve.id);
    expect(readOwnedGear(db).find((gear) => gear.playerGearId === blade.id)?.bonusPrimary).toBe(4);
    expect(readFreshRewards(db).map((reward) => reward.source)).toEqual(['daily_goal', 'level_milestone']);
  });

  it('applies a repeated reward once', () => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);
    applySyncResponse(db, response({ rewards_granted: [salve] }));
    applySyncResponse(db, response({ rewards_granted: [salve] }));

    expect(readSatchel(db).filter((item) => item.playerItemId === salve.id)).toHaveLength(1);
    expect(readFreshRewards(db)).toHaveLength(1);
  });
});
