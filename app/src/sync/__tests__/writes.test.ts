import { grantItem, readEquippedGear, readOwnedGear, readSatchel, readStoredLoadout } from '../../battle/mirror';
import { edtDates } from '../../health/__tests__/fixtures';
import { seedEmbeddedContent } from '../../content/store';
import { count, peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { recordingDatabase } from '../../health/__tests__/fixtures';
import { effectiveStats } from '../../progression/stats';
import { isRestTagged, readBirthYear, readPlayer } from '../mirror';
import {
  AllocationError,
  EquipError,
  NO_STATS,
  allocateStatPoints,
  changeSettings,
  consumeItem,
  equipGear,
  setSkills,
  requestExplore,
  tagRestDay,
} from '../writes';
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
   * Neither half is safe alone. A mirror updated without a queued replay is a change the server
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

  /** Minted once and reused on retry — a fresh id per attempt is the difference from doubling. */
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

  /** Null means *leave alone*, not *clear* — a partial update must not be destructive (§6.3). */
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

describe('the Rest Day tag', () => {
  /** GDD 11 §3.1 — one tag, two effects, and neither of them waits for the server. */
  it('restores Vigor, tags the day, and queues one replay', () => {
    const db = registeredDatabase({ vigor_current: 3 });

    const payload = tagRestDay(db, '2026-08-04', NOW);

    expect(payload).toEqual({ activityDate: '2026-08-04', vigorAfter: 20 });
    expect(readPlayer(db)).toMatchObject({
      vigorCurrent: 20,
      vigorAnchorAt: new Date(NOW).toISOString(),
    });
    expect(isRestTagged(db, '2026-08-04')).toBe(true);

    const queued = peek(db, 10);

    expect(queued).toHaveLength(1);
    expect(queued[0]?.kind).toBe('rest_day');
  });

  /** Max Vigor is the stat block's, so an allocated point is worth a point of restore. */
  it('restores to max including allocation', () => {
    const db = registeredDatabase({ vigor_current: 3 });

    db.runSync('UPDATE player SET alloc_vigor = 5');

    expect(tagRestDay(db, '2026-08-04', NOW)?.vigorAfter).toBe(25);
  });

  /**
   * Unlimited and uncapped (GDD 11 §3.1). Tagging twice is two queued writes and one tagged day —
   * the mutation this catches is a cap or a cooldown someone adds for tidiness.
   */
  it('does not refuse a second tag', () => {
    const db = registeredDatabase({ vigor_current: 3 });

    tagRestDay(db, '2026-08-04', NOW);
    expect(tagRestDay(db, '2026-08-04', NOW + 60_000)).not.toBeNull();
    expect(count(db)).toBe(2);
  });

  /** The row a real rest day usually has: none. The tag creates it rather than being dropped. */
  it('tags a date the mirror has never seen', () => {
    const db = registeredDatabase();

    tagRestDay(db, '2026-12-25', NOW);

    expect(isRestTagged(db, '2026-12-25')).toBe(true);
  });
});

describe('equipping gear', () => {
  const gearDatabase = (vigorCurrent = 20) => {
    const db = registeredDatabase({ vigor_current: vigorCurrent });

    seedEmbeddedContent(db);

    const playerId = readPlayer(db)?.playerId ?? '';
    const own = (id: string, gearDefId: string, bonus: number, slot: string | null) =>
      db.runSync(
        `INSERT INTO player_gear (id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, acquired_at)
         VALUES (?, ?, ?, ?, 1, ?, '2026-08-01T00:00:00Z')`,
        [id, playerId, gearDefId, slot, bonus],
      );

    own('blade', 'gear_weapon_mortal', 1, 'weapon');
    own('sword', 'gear_weapon_heroic', 4, null);
    own('charm', 'gear_accessory_mortal', 3, 'accessory');

    return db;
  };

  const might = (db: SqliteDatabase) => {
    const player = readPlayer(db);

    return player === null ? 0 : effectiveStats(player, readEquippedGear(db)).might;
  };

  const worn = (db: SqliteDatabase) =>
    Object.fromEntries(readOwnedGear(db).map((gear) => [gear.playerGearId, gear.equippedSlot]));

  it('wears the piece in its own slot, displaces the occupant, and queues one replay', () => {
    const db = gearDatabase();

    expect(equipGear(db, 'sword', true, NOW)).toEqual({
      playerGearId: 'sword',
      equippedSlot: 'weapon',
      vigorAfter: null,
    });
    expect(worn(db)).toMatchObject({ sword: 'weapon', blade: null });
    expect(peek(db, 10).map((entry) => entry.kind)).toEqual(['equip']);
  });

  /** Gear never touches the stored allocation, so the round trip is lossless (tech-01 §4). */
  it('moves effective stats with an equip and back with an unequip', () => {
    const db = gearDatabase();
    const before = might(db);

    equipGear(db, 'sword', true, NOW);
    expect(might(db)).toBe(before - 1 + 4);

    equipGear(db, 'sword', false, NOW);
    expect(might(db)).toBe(before - 1);
    expect(worn(db).sword).toBeNull();
  });

  /** GDD 8 §3.1 — the fourth slot, and the only one that moves two stats. */
  it('wears a Trinket in its own slot and moves Favor and Aegis', () => {
    const db = gearDatabase();
    const playerId = readPlayer(db)?.playerId ?? '';

    db.runSync(
      `INSERT INTO player_gear (id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, bonus_secondary, acquired_at)
       VALUES ('sigil', ?, 'gear_skyroad_sigil', NULL, 10, 2, 2, '2026-08-01T00:00:00Z')`,
      [playerId],
    );

    expect(equipGear(db, 'sigil', true, NOW).equippedSlot).toBe('trinket');

    const player = readPlayer(db);
    const stats = player === null ? null : effectiveStats(player, readEquippedGear(db));

    expect(stats).toMatchObject({ favor: 12, aegis: 12 });
    expect(worn(db)).toMatchObject({ sigil: 'trinket', blade: 'weapon' });
  });

  it('clamps Vigor when unequipping leaves it above the new max, and sends the clamp', () => {
    const db = gearDatabase(23);

    expect(equipGear(db, 'charm', false, NOW).vigorAfter).toBe(20);
    expect(readPlayer(db)?.vigorCurrent).toBe(20);
  });

  it('leaves Vigor alone when it is already within the new max', () => {
    const db = gearDatabase(12);

    expect(equipGear(db, 'charm', false, NOW).vigorAfter).toBeNull();
    expect(readPlayer(db)?.vigorCurrent).toBe(12);
  });

  /** Drills note 13's shape: a fight holds its own stat block and writes Vigor back on settle. */
  it('refuses while a battle is open, and changes nothing', () => {
    const db = gearDatabase();

    db.runSync(
      `INSERT INTO battle_snapshot (one_row, client_battle_id, snapshot, updated_at) VALUES (1, 'b', '{}', '')`,
    );

    expect(() => equipGear(db, 'sword', true, NOW)).toThrow(EquipError);
    expect(worn(db)).toMatchObject({ sword: null, blade: 'weapon' });
    expect(count(db)).toBe(0);
  });

  it('refuses gear the player does not own', () => {
    expect(() => equipGear(gearDatabase(), 'nope', true, NOW)).toThrow(EquipError);
  });
});

/**
 * GDD 9 §4.3's Explore tap — the one write on this surface with no optimistic local effect, because
 * the roll it asks for is the server's (T2 §4 step 8).
 */
describe('the Explore tap', () => {
  it('queues the tap under its own operation id', () => {
    const db = registeredDatabase();

    const payload = requestExplore(db, 'olympion', '2026-08-04', NOW);
    const [entry] = peek(db, 10, 'explore');

    expect(payload).toMatchObject({ zoneId: 'olympion', activityDate: '2026-08-04' });

    // ↯ The operation id *is* the outbox key. A tap spends a roll, so a resend under a fresh id
    // would spend a second one — the server's ledger can only stop that if the id never changes.
    expect(entry?.clientOpId).toBe(payload.operationId);
    expect(JSON.parse(entry?.payload ?? '{}')).toEqual(payload);
  });

  /**
   * Nothing local moves. The mirror has no encounter to show until the server rules on the roll,
   * and inventing one would mean taking it back when the day's cap turns out to be spent.
   */
  it('changes nothing in the mirror', () => {
    const db = registeredDatabase();

    requestExplore(db, 'olympion', '2026-08-04', NOW);

    expect(db.getAllSync('SELECT grant_id FROM encounter_grant')).toEqual([]);
  });

  it('queues a second tap rather than folding it into the first', () => {
    const db = registeredDatabase();

    const first = requestExplore(db, 'olympion', '2026-08-04', NOW);
    const second = requestExplore(db, 'valheon', '2026-08-04', NOW + 1_000);

    expect(second.operationId).not.toBe(first.operationId);
    expect(peek(db, 10, 'explore')).toHaveLength(2);
  });
});

describe('using a healing item outside a fight', () => {
  /** Max Vigour 20 with nothing worn, so a Salve's 20% is 4. */
  const itemDatabase = (vigorCurrent: number, anchorAt = new Date(NOW).toISOString()) => {
    const db = registeredDatabase({ vigor_current: vigorCurrent, vigor_anchor_at: anchorAt });

    seedEmbeddedContent(db);
    db.runSync('DELETE FROM player_gear');

    const playerId = readPlayer(db)?.playerId ?? '';

    grantItem(db, { playerItemId: 'salve', playerId, itemDefId: 'item_travelers_salve', acquiredAt: '' });
    grantItem(db, { playerItemId: 'warhex', playerId, itemDefId: 'item_warhex', acquiredAt: '' });

    return db;
  };

  const held = (db: SqliteDatabase) => readSatchel(db).map((item) => item.playerItemId);

  it('heals by the item’s share of max, spends it, and queues one replay', () => {
    const db = itemDatabase(10);

    expect(consumeItem(db, 'salve', NOW, edtDates)).toEqual({ playerItemId: 'salve', vigorAfter: 14 });
    expect(readPlayer(db)?.vigorCurrent).toBe(14);
    expect(held(db)).toEqual(['warhex']);
    expect(peek(db, 10).map((entry) => entry.kind)).toEqual(['use_item']);
  });

  /** The mutation this guards: healing the stored number and discarding regen since the anchor. */
  it('heals on top of the regen already accrued', () => {
    // 100 minutes at max 20 is two points (GDD 2 §6).
    const db = itemDatabase(10, new Date(NOW - 100 * 60_000).toISOString());

    expect(consumeItem(db, 'salve', NOW, edtDates)?.vigorAfter).toBe(16);
  });

  it('stops at max', () => {
    expect(consumeItem(itemDatabase(18), 'salve', NOW, edtDates)?.vigorAfter).toBe(20);
  });

  it.each([
    ['a battle-only item', 10, 'warhex', false],
    ['full Vigour', 20, 'salve', false],
    ['an open fight', 10, 'salve', true],
  ])('refuses with %s, and changes nothing', (_, vigor, item, fighting) => {
    const db = itemDatabase(vigor);

    if (fighting) {
      db.runSync(
        `INSERT INTO battle_snapshot (one_row, client_battle_id, snapshot, updated_at) VALUES (1, 'b', '{}', '')`,
      );
    }

    expect(consumeItem(db, item, NOW, edtDates)).toBeNull();
    expect(held(db)).toEqual(['salve', 'warhex']);
    expect(readPlayer(db)?.vigorCurrent).toBe(vigor);
    expect(count(db)).toBe(0);
  });
});

describe('setting the skill loadout', () => {
  it('stores the loadout in slot order and queues one replay', () => {
    const db = registeredDatabase();

    expect(setSkills(db, ['skill_titans_reach', 'skill_iron_advance'], NOW)).toEqual({
      skillIds: ['skill_titans_reach', 'skill_iron_advance'],
    });
    expect(readStoredLoadout(db)).toEqual(['skill_titans_reach', 'skill_iron_advance']);
    expect(peek(db, 10).map((entry) => entry.kind)).toEqual(['skills']);
  });

  /** The fight froze its moves when it opened, so a mid-fight change would be invisible to it. */
  it('refuses while a battle is open, and changes nothing', () => {
    const db = registeredDatabase();

    db.runSync(
      `INSERT INTO battle_snapshot (one_row, client_battle_id, snapshot, updated_at) VALUES (1, 'b', '{}', '')`,
    );

    expect(setSkills(db, ['skill_iron_advance'], NOW)).toBeNull();
    expect(readStoredLoadout(db)).toEqual([]);
    expect(count(db)).toBe(0);
  });
});
