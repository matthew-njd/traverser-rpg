import type { SqliteDatabase } from '../../db/types';
import { PLAYER_ID, registeredDatabase } from '../../sync/__tests__/fixtures';
import {
  NEVER_MET,
  clearSnapshot,
  grantItem,
  readBestiary,
  readSatchel,
  readSnapshot,
  recordBattle,
  spendItems,
  writeSnapshot,
} from '../mirror';
import type { BattleSnapshot } from '../snapshot';
import { SNAPSHOT_SCHEMA_VERSION } from '../snapshot';

/** The three schema-v5 tables a battle reads and writes. */
const SNAPSHOT: BattleSnapshot = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  clientBattleId: 'cb-1',
  grantId: null,
  startedAt: '2026-08-18T10:00:00-04:00',
  contentVersion: 2,
  rngSeed: null,
  state: { round: 3 } as unknown as BattleSnapshot['state'],
};

const salve = (db: SqliteDatabase, id: string) =>
  grantItem(db, {
    playerItemId: id,
    playerId: PLAYER_ID,
    itemDefId: 'item_travelers_salve',
    acquiredAt: `2026-08-18T10:0${id.slice(-1)}:00Z`,
  });

describe('the satchel', () => {
  it('lists what is held, oldest first', () => {
    const db = registeredDatabase();

    salve(db, 'pi-2');
    salve(db, 'pi-1');

    expect(readSatchel(db).map((item) => item.playerItemId)).toEqual(['pi-1', 'pi-2']);
  });

  it('removes a spent item, and re-spending it is a no-op', () => {
    const db = registeredDatabase();

    salve(db, 'pi-1');
    spendItems(db, ['pi-1']);
    spendItems(db, ['pi-1']);

    expect(readSatchel(db)).toEqual([]);
  });

  /** ↯ Cascades with the player row, which is what a Settings hand-over relies on. */
  it('goes with the player when the profile is replaced', () => {
    const db = registeredDatabase();

    salve(db, 'pi-1');
    db.runSync('DELETE FROM player');

    expect(readSatchel(db)).toEqual([]);
  });
});

describe('the bestiary', () => {
  it('reports an enemy never met as zero, not as missing', () => {
    expect(readBestiary(registeredDatabase(), 'enemy_harpy')).toEqual(NEVER_MET);
  });

  /** Mirrors T2 §4 step 2: encounters count every battle, defeats count wins only. */
  it('counts every battle but only credits a defeat for a win', () => {
    const db = registeredDatabase();

    recordBattle(db, { playerId: PLAYER_ID, enemyId: 'enemy_harpy', won: false });
    recordBattle(db, { playerId: PLAYER_ID, enemyId: 'enemy_harpy', won: true });
    recordBattle(db, { playerId: PLAYER_ID, enemyId: 'enemy_harpy', won: false });

    expect(readBestiary(db, 'enemy_harpy')).toEqual({ encounterCount: 3, defeatCount: 1 });
  });

  it('keeps enemies apart', () => {
    const db = registeredDatabase();

    recordBattle(db, { playerId: PLAYER_ID, enemyId: 'enemy_harpy', won: true });

    expect(readBestiary(db, 'enemy_satyr')).toEqual(NEVER_MET);
  });
});

describe('the snapshot slot', () => {
  it('round-trips the whole snapshot', () => {
    const db = registeredDatabase();

    writeSnapshot(db, SNAPSHOT, Date.now());

    expect(readSnapshot(db)).toEqual(SNAPSHOT);
  });

  /** At most one row (T4 §6.2) — a second battle replaces the first rather than queueing behind it. */
  it('holds at most one battle', () => {
    const db = registeredDatabase();

    writeSnapshot(db, SNAPSHOT, Date.now());
    writeSnapshot(db, { ...SNAPSHOT, clientBattleId: 'cb-2' }, Date.now());

    expect(readSnapshot(db)?.clientBattleId).toBe('cb-2');
    expect(db.getAllSync('SELECT one_row FROM battle_snapshot')).toHaveLength(1);
  });

  it('reports nothing when no battle is open', () => {
    expect(readSnapshot(registeredDatabase())).toBeNull();

    const db = registeredDatabase();

    writeSnapshot(db, SNAPSHOT, Date.now());
    clearSnapshot(db);

    expect(readSnapshot(db)).toBeNull();
  });

  /**
   * ↯ This is read at boot. A snapshot the current code cannot parse must abandon the battle, not
   * stop the app from starting — the only recovery from a boot crash is an uninstall (T4 §6.5),
   * which destroys the profile.
   */
  it('abandons an unreadable snapshot rather than throwing', () => {
    const db = registeredDatabase();

    db.runSync(
      `INSERT INTO battle_snapshot (one_row, client_battle_id, snapshot, updated_at)
       VALUES (1, 'cb-1', 'not json', '2026-08-18T10:00:00Z')`,
    );

    expect(readSnapshot(db)).toBeNull();
  });
});
