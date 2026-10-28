import { readSatchel, readSnapshot } from '../../battle/mirror';
import { grantItem } from '../../battle/mirror';
import { seededRng } from '../../battle/rng';
import { seedEmbeddedContent } from '../../content/store';
import { peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { PLAYER_ID, registeredDatabase } from '../../sync/__tests__/fixtures';
import { readPlayer } from '../../sync/mirror';
import { backAction, battleInProgress, fightOpen, useBattleStore } from '../battleStore';

/**
 * T5 §9's adapter. The engine is proven elsewhere; what is only observable here is **durability** —
 * that a turn is on disk before it is on screen, that an item cannot be spent twice across a crash,
 * and that a settled battle cannot be queued twice.
 */
function battleReady(overrides: Record<string, unknown> = {}): SqliteDatabase {
  const db = registeredDatabase({ level: 6, vigor_current: 20, ...overrides });

  seedEmbeddedContent(db);

  return db;
}

const open = (db: SqliteDatabase, seed = 7) =>
  useBattleStore.getState().begin(db, {
    enemyId: 'enemy_harpy',
    encounterKind: 'wild',
    clientBattleId: '019fd954-0745-7748-9892-00000000ba11',
    startedAt: '2026-08-18T10:00:00-04:00',
    rng: seededRng(seed),
  });

/** Fights to a conclusion, whichever way it goes. */
function fightOut(db: SqliteDatabase): void {
  useBattleStore.getState().dispatch(db, { kind: 'begin' });

  for (let turn = 0; turn < 50; turn += 1) {
    if (useBattleStore.getState().snapshot?.state.outcome !== null) {
      return;
    }

    useBattleStore.getState().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });
  }

  throw new Error('the battle never ended');
}

afterEach(() => {
  useBattleStore.setState({ snapshot: null, context: null, labels: null, events: [], items: [] });
});

describe('opening a battle', () => {
  /** A process death between opening and the first tap must resume, not lose the encounter. */
  it('writes the snapshot before the player has acted', () => {
    const db = battleReady();

    open(db);

    expect(readSnapshot(db)?.clientBattleId).toBe('019fd954-0745-7748-9892-00000000ba11');
  });

  it('offers only the moves this level has unlocked', () => {
    const db = battleReady({ level: 4 });

    open(db);

    expect(useBattleStore.getState().moves.map((move) => move.id)).toEqual([
      'skill_basic_attack',
      'skill_iron_advance',
    ]);
  });

  it('lists the satchel with the names the bundle gives its items', () => {
    const db = battleReady();

    grantItem(db, {
      playerItemId: 'pi-1',
      playerId: PLAYER_ID,
      itemDefId: 'item_travelers_salve',
      acquiredAt: '2026-08-18T09:00:00Z',
    });

    open(db);

    expect(useBattleStore.getState().items).toEqual([
      { playerItemId: 'pi-1', itemDefId: 'item_travelers_salve', label: "Traveller's Salve" },
    ]);
  });
});

describe('taking a turn', () => {
  it('persists the state after every resolved turn', () => {
    const db = battleReady();

    open(db);
    useBattleStore.getState().dispatch(db, { kind: 'begin' });
    useBattleStore.getState().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });

    expect(readSnapshot(db)?.state).toEqual(useBattleStore.getState().snapshot?.state);
  });

  /**
   * ↯ The row leaves `player_item` **when the item is used**, not at settle (T4 §5.3). Deleting it
   * at settle would leave a crash mid-battle with a Salve that the snapshot has already spent and
   * the satchel still holds — so the resumed fight offers the same physical item a second time.
   */
  it('takes the item out of the satchel in the same breath as the turn', () => {
    const db = battleReady();

    grantItem(db, {
      playerItemId: 'pi-1',
      playerId: PLAYER_ID,
      itemDefId: 'item_travelers_salve',
      acquiredAt: '2026-08-18T09:00:00Z',
    });

    open(db);
    useBattleStore.getState().dispatch(db, { kind: 'begin' });
    useBattleStore.getState().dispatch(db, {
      kind: 'item',
      playerItemId: 'pi-1',
      itemDefId: 'item_travelers_salve',
    });

    expect(readSatchel(db)).toEqual([]);
    expect(useBattleStore.getState().items).toEqual([]);
  });

  it('accumulates the event queue the screen renders', () => {
    const db = battleReady();

    open(db);
    useBattleStore.getState().dispatch(db, { kind: 'begin' });

    const types = useBattleStore.getState().events.map((event) => event.type);

    expect(types[0]).toBe('battle_started');
    expect(types).toContain('turn_order_decided');
  });
});

describe('settling', () => {
  it('queues the battle, applies the Vigor and counts the bestiary', () => {
    const db = battleReady();

    open(db);
    fightOut(db);

    const outcome = useBattleStore.getState().snapshot?.state.outcome;

    useBattleStore.getState().settle(db, '2026-08-18');

    expect(peek(db, 10, 'battle')).toHaveLength(1);
    expect(readPlayer(db)?.vigorCurrent).toBe(
      useBattleStore.getState().snapshot?.state.player.vigor,
    );
    expect(db.getFirstSync<{ n: number }>('SELECT encounter_count AS n FROM player_bestiary')?.n).toBe(
      1,
    );
    expect(outcome).not.toBeNull();
  });

  /** No window in which a battle is both settled and resumable (T5 §8). */
  it('clears the snapshot in the same transaction', () => {
    const db = battleReady();

    open(db);
    fightOut(db);
    useBattleStore.getState().settle(db, '2026-08-18');

    expect(readSnapshot(db)).toBeNull();
  });

  it('cannot queue the same battle twice', () => {
    const db = battleReady();

    open(db);
    fightOut(db);
    useBattleStore.getState().settle(db, '2026-08-18');
    useBattleStore.getState().settle(db, '2026-08-18');

    expect(peek(db, 10, 'battle')).toHaveLength(1);
    expect(db.getFirstSync<{ n: number }>('SELECT encounter_count AS n FROM player_bestiary')?.n).toBe(
      1,
    );
  });

  it('refuses to settle a battle that has not ended', () => {
    const db = battleReady();

    open(db);
    useBattleStore.getState().dispatch(db, { kind: 'begin' });
    useBattleStore.getState().settle(db, '2026-08-18');

    expect(peek(db, 10, 'battle')).toEqual([]);
  });

  it('abandons a fight without recording it', () => {
    const db = battleReady();

    open(db);
    useBattleStore.getState().abandon(db);

    expect(readSnapshot(db)).toBeNull();
    expect(peek(db, 10, 'battle')).toEqual([]);
    expect(useBattleStore.getState().snapshot).toBeNull();
  });
});

/**
 * ↯ **P8 found this on the device.** `settle` leaves the finished battle in the store so the outcome
 * panel can keep rendering, and the battle route skipped `begin` whenever a snapshot existed — so
 * every fight after the first re-rendered the previous one’s defeat screen and no new battle could
 * be started. The route now asks whether a fight is *unresolved*, which is the condition it always
 * meant.
 */
describe('battleInProgress', () => {
  it('is false with no battle open', () => {
    expect(battleInProgress()).toBe(false);
  });

  it('is true while a fight is unresolved', () => {
    const db = battleReady();

    open(db);

    expect(battleInProgress()).toBe(true);
  });

  /**
   * An ended fight is unrecorded until Continue settles it. This used to read `false`, and a
   * dev-build hot reload re-ran the route's `begin` over a won boss fight on its victory panel — the
   * win and its drops were never queued.
   */
  it('is still true once the fight has ended, until it is settled', () => {
    const db = battleReady();

    open(db);
    fightOut(db);

    expect(battleInProgress()).toBe(true);
  });

  it('is false after settling, so the next battle can start', () => {
    const db = battleReady();

    open(db);
    fightOut(db);
    useBattleStore.getState().settle(db, '2026-08-19');

    expect(useBattleStore.getState().snapshot).not.toBeNull();
    expect(battleInProgress()).toBe(false);
  });

  /** The reveal, the overflow prompt and the banners hid after every fight until a restart (M5/P8). */
  it('reads the same through the selector the layouts subscribe with', () => {
    const db = battleReady();

    open(db);
    fightOut(db);
    expect(fightOpen(useBattleStore.getState())).toBe(true);

    useBattleStore.getState().settle(db, '2026-08-19');
    expect(fightOpen(useBattleStore.getState())).toBe(false);
  });
});

/**
 * Android back on the battle route. Before Begin it cancels an accidental tap; after it, it must not
 * abandon the fight — an abandoned fight resumed on the next encounter tap, whatever was tapped.
 */
describe('backAction', () => {
  const action = () => backAction(useBattleStore.getState().snapshot);

  it('cancels before Begin, blocks mid-fight, and finishes once the outcome is in', () => {
    const db = battleReady();

    useBattleStore.getState().abandon(db);
    expect(action()).toBe('leave');

    open(db);
    expect(action()).toBe('cancel');

    useBattleStore.getState().dispatch(db, { kind: 'begin' });
    expect(action()).toBe('block');

    useBattleStore.getState().dispatch(db, { kind: 'flee' });
    expect(action()).toBe('finish');
  });
});
