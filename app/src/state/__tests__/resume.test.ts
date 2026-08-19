import { readSnapshot, writeSnapshot } from '../../battle/mirror';
import { seededRng } from '../../battle/rng';
import { SNAPSHOT_SCHEMA_VERSION } from '../../battle/snapshot';
import { seedEmbeddedContent } from '../../content/store';
import type { SqliteDatabase } from '../../db/types';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { useBattleStore } from '../battleStore';

/**
 * T5 §8 — a cold start with an unresolved snapshot resumes the fight.
 *
 * Android kills a backgrounded app without warning and without a callback (T4 §5.3), so this is the
 * ordinary path rather than an edge case: the player takes a turn, answers a call, comes back.
 *
 * ↯ Two of §8.1's three hazards **abandon** the battle, and that is the kinder outcome rather than
 * the harsher one: a sync between backgrounding and resuming can change a move's Power underneath a
 * fight in progress, and resuming a battle whose numbers moved is worse than losing it. The player
 * keeps the encounter either way, because grants are held client-side until spent.
 */
const BATTLE_ID = '019fd954-0745-7748-9892-00000000c0dd';

function battleReady(): SqliteDatabase {
  const db = registeredDatabase({ level: 6, vigor_current: 20 });

  seedEmbeddedContent(db);

  return db;
}

const open = (db: SqliteDatabase) =>
  useBattleStore.getState().begin(db, {
    enemyId: 'enemy_harpy',
    encounterKind: 'wild',
    clientBattleId: BATTLE_ID,
    startedAt: '2026-08-18T10:00:00-04:00',
    rng: seededRng(11),
  });

/** The closest a test gets to the process simply ending: the row survives, the store does not. */
const processDies = () =>
  useBattleStore.setState({
    snapshot: null,
    context: null,
    labels: null,
    events: [],
    items: [],
    moves: [],
    playerId: null,
  });

const store = () => useBattleStore.getState();

afterEach(processDies);

describe('resuming', () => {
  it('reports nothing to resume on a device with no battle open', () => {
    expect(store().resume(battleReady())).toBeNull();
  });

  it('re-enters a fight at the round it was interrupted in', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    store().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });

    const interrupted = store().snapshot?.state;

    processDies();

    expect(store().resume(db)).toBe('resumed');
    expect(store().snapshot?.state).toEqual(interrupted);
  });

  it('resumes with the battle playable — context, labels and moves all rebuilt', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    processDies();
    store().resume(db);

    expect(store().context?.enemy.id).toBe('enemy_harpy');
    expect(store().labels?.get('enemy_harpy')).toBe('Harpy');
    expect(store().moves.map((move) => move.id)).toContain('skill_basic_attack');
    expect(store().playerId).not.toBeNull();
  });

  /** The turn after a resume must land in the same battle, not open a second one. */
  it('keeps the client_battle_id it began with, so the payload is not a second fight', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    processDies();
    store().resume(db);

    expect(store().snapshot?.clientBattleId).toBe(BATTLE_ID);
  });

  /**
   * The event log is L3 session state (T4 §5.2) — a record of *this* session, not of the battle. It
   * is deliberately not persisted, so a resumed fight opens with an empty combat log rather than a
   * reconstruction that could disagree with the state it sits beside.
   */
  it('starts the combat log fresh rather than reconstructing it', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    processDies();
    store().resume(db);

    expect(store().events).toEqual([]);
  });

  /** The whole reason the item leaves the satchel with the turn rather than with the settle. */
  it('spends an item once across an interruption, not twice', () => {
    const db = battleReady();

    db.runSync(
      `INSERT INTO player_item (id, player_id, item_def_id, acquired_at)
       SELECT 'pi-1', id, 'item_travelers_salve', '2026-08-18T09:00:00Z' FROM player`,
    );

    open(db);
    store().dispatch(db, { kind: 'begin' });
    store().dispatch(db, {
      kind: 'item',
      playerItemId: 'pi-1',
      itemDefId: 'item_travelers_salve',
    });

    processDies();
    store().resume(db);

    expect(store().items).toEqual([]);
    expect(db.getAllSync('SELECT id FROM player_item')).toEqual([]);
  });
});

describe('the three resume hazards (§8.1)', () => {
  /**
   * Content moved underneath the fight. Abandoned rather than resumed, because a move's Power may
   * have changed mid-battle and the numbers on screen would stop matching the ones being computed.
   */
  it('abandons a battle whose content version moved', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    processDies();

    db.runSync('UPDATE content_version SET version = version + 1');

    expect(store().resume(db)).toBe('content_moved');
    expect(readSnapshot(db)).toBeNull();
    expect(store().snapshot).toBeNull();
  });

  /** A snapshot the current code cannot read is abandoned, never migrated — these live for minutes. */
  it('abandons a battle written by a different snapshot schema', () => {
    const db = battleReady();

    open(db);

    const snapshot = store().snapshot;

    if (snapshot === null) {
      throw new Error('the battle did not open');
    }

    processDies();
    writeSnapshot(db, { ...snapshot, schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 }, Date.now());

    expect(store().resume(db)).toBe('schema_moved');
    expect(readSnapshot(db)).toBeNull();
  });

  /**
   * The third hazard needs no code: the player was mid-`await_player`, which holds no partial input,
   * so re-entering simply redraws. Asserted so the claim is checked rather than merely written down.
   */
  it('re-enters an awaiting-input battle with nothing half-entered', () => {
    const db = battleReady();

    open(db);
    store().dispatch(db, { kind: 'begin' });
    processDies();
    store().resume(db);

    expect(store().snapshot?.state.phase).toBe('await_player');
    expect(store().resolving).toBe(false);
  });

  /** A hand-over took the profile with it, and the fight belonged to whoever left. */
  it('abandons a battle whose player is gone', () => {
    const db = battleReady();

    open(db);
    processDies();
    db.runSync('DELETE FROM player');

    expect(store().resume(db)).toBe('schema_moved');
    expect(readSnapshot(db)).toBeNull();
  });
});
