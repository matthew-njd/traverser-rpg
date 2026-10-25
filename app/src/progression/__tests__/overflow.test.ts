import { grantItem } from '../../battle/mirror';
import { seedEmbeddedContent } from '../../content/store';
import type { SqliteDatabase } from '../../db/types';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { readPlayer } from '../../sync/mirror';
import { ITEM_CAP, readOverflow } from '../overflow';

/** GDD 4 §5.2 and GDD 13 §5.1 — which decision is owed, and what is suggested. */

const satchel = (count: number, newest = 'item_stormveil') => {
  const db = registeredDatabase();

  seedEmbeddedContent(db);
  db.runSync('DELETE FROM player_item');

  const playerId = readPlayer(db)?.playerId ?? '';

  for (let index = 0; index < count - 1; index += 1) {
    const def = index < 3 ? 'item_ambrosia_shard' : 'item_travelers_salve';

    grantItem(db, { playerItemId: `i${index}`, playerId, itemDefId: def, acquiredAt: `2026-08-01T00:00:${String(index).padStart(2, '0')}Z` });
  }

  grantItem(db, { playerItemId: 'newest', playerId, itemDefId: newest, acquiredAt: '2026-08-02T00:00:00Z' });

  return db;
};

const park = (db: SqliteDatabase) =>
  db.runSync(
    `INSERT INTO pending_reward (id, kind, def_id, level_at_drop, bonus_primary, bonus_secondary, created_at)
     VALUES ('r1', 'item', 'item_sunder_oil', NULL, NULL, NULL, '2026-08-03T00:00:00Z')`,
  );

describe('readOverflow', () => {
  it('owes nothing at the cap', () => {
    expect(readOverflow(satchel(ITEM_CAP))).toBeNull();
  });

  /** The newest row is the one that crossed the cap, so it is the one being asked about. */
  it('asks about the newest item once the satchel passes 20', () => {
    const owed = readOverflow(satchel(ITEM_CAP + 1));

    expect(owed?.incoming).toEqual({ id: 'newest', defId: 'item_stormveil' });
    expect(owed?.others).toHaveLength(ITEM_CAP);
  });

  /** "Fullest, lowest-value": a common with the most copies, never one of the three rare Shards. */
  it('suggests the lowest-rarity item held in the most copies', () => {
    const suggested = readOverflow(satchel(ITEM_CAP + 1))?.others.filter((other) => other.suggested);

    expect(suggested?.map((other) => other.defId)).toEqual(['item_travelers_salve']);
  });

  it('asks about a parked reward, with room when it now fits', () => {
    const full = satchel(ITEM_CAP);
    const roomy = satchel(5);

    park(full);
    park(roomy);

    expect(readOverflow(full)).toMatchObject({ pendingId: 'r1', room: false });
    expect(readOverflow(roomy)).toMatchObject({ pendingId: 'r1', room: true });
  });
});

describe('the gear suggestion', () => {
  /** Five spare weapons against four armour and four accessories; the incoming piece is the newest. */
  const rack = (pieces: readonly [string, string, number][]) => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);
    db.runSync('DELETE FROM player_gear');

    const playerId = readPlayer(db)?.playerId ?? '';

    pieces.forEach(([id, def, bonus], index) => {
      db.runSync(
        `INSERT INTO player_gear (id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, acquired_at)
         VALUES (?, ?, ?, NULL, 1, ?, ?)`,
        [id, playerId, def, bonus, `2026-08-01T00:00:${String(index).padStart(2, '0')}Z`],
      );
    });

    return db;
  };

  const suggested = (db: SqliteDatabase) =>
    readOverflow(db)?.others.find((other) => other.suggested)?.id;

  /**
   * The mutation this guards: ranking by tier first. The Heroic weapon at +3 is weaker than the
   * Mortal one at +4 — a frozen bonus from a lower level — so it is the one to suggest.
   */
  it('suggests the weakest piece in the slot with the most spares, whatever its tier', () => {
    const db = rack([
      ['w1', 'gear_weapon_mortal', 4],
      ['w2', 'gear_weapon_heroic', 3],
      ['w3', 'gear_weapon_mythic', 9],
      ['w4', 'gear_weapon_mortal', 5],
      ['w5', 'gear_weapon_mortal', 6],
      ['a1', 'gear_armor_mortal', 1],
      ['a2', 'gear_armor_mortal', 2],
      ['c1', 'gear_accessory_mortal', 1],
      ['c2', 'gear_accessory_mortal', 2],
      ['c3', 'gear_accessory_heroic', 5],
      ['a3', 'gear_armor_heroic', 4],
      ['c4', 'gear_accessory_mythic', 8],
      ['a4', 'gear_armor_mythic', 8],
      ['new', 'gear_weapon_divine', 10],
    ]);

    expect(readOverflow(db)?.incoming.id).toBe('new');
    expect(suggested(db)).toBe('w2');
  });
});
