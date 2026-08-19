import { readSatchel, recordBattle } from '../../battle/mirror';
import { TUTORIAL_ENEMY_ID } from '../../battle/session';
import { seedEmbeddedContent } from '../../content/store';
import { peek } from '../../db/outbox';
import type { SqliteDatabase } from '../../db/types';
import { PLAYER_ID, registeredDatabase } from '../../sync/__tests__/fixtures';
import { readPlayer } from '../../sync/mirror';
import { useBattleStore } from '../../state/battleStore';
import { TUTORIAL_BEATS, beatFor, hasFinishedTutorial } from '../tutorial';

/**
 * GDD 10 Screen 6, **played through the real engine** (M2 plan §3.4).
 *
 * The engine's own suite already asserts fixtures §3 round by round. What is unproven below it is
 * the *screen's* half: that the script's four beats line up with the four rounds the engine
 * actually plays, that the fight is driven entirely through the store, and that a fresh install
 * comes out the other side with the battle recorded and the Salve gone.
 *
 * ↯ No damage number is asserted here. Two transcriptions of fixtures §3 that agree with each other
 * prove nothing — the engine test is the one that owns those values.
 */
function freshInstall(): SqliteDatabase {
  const db = registeredDatabase({ level: 1, vigor_current: 20 });

  seedEmbeddedContent(db);

  // GDD 10 §5.2's loadout, as registration returns it — the Blade equipped, three Salves held.
  db.runSync(
    `INSERT INTO player_gear (
       id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, acquired_at
     ) VALUES ('g1', ?, 'gear_weapon_mortal', 'weapon', 1, 1, '2026-08-18T10:00:00Z')`,
    [PLAYER_ID],
  );

  for (const id of ['s1', 's2', 's3']) {
    db.runSync(
      `INSERT INTO player_item (id, player_id, item_def_id, acquired_at)
       VALUES (?, ?, 'item_travelers_salve', '2026-08-18T10:00:00Z')`,
      [id, PLAYER_ID],
    );
  }

  return db;
}

const open = (db: SqliteDatabase) =>
  useBattleStore.getState().begin(db, {
    enemyId: TUTORIAL_ENEMY_ID,
    encounterKind: 'tutorial',
    clientBattleId: '019fd954-0745-7748-9892-00000000e5e0',
    startedAt: '2026-08-18T10:00:00-04:00',
  });

const state = () => {
  const current = useBattleStore.getState().snapshot?.state;

  if (current === undefined) {
    throw new Error('no battle is open');
  }

  return current;
};

/** The four taps GDD 10 §6.4's script asks for, in order. */
function playScript(db: SqliteDatabase): void {
  const store = () => useBattleStore.getState();

  store().dispatch(db, { kind: 'begin' });
  store().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });
  store().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });
  store().dispatch(db, {
    kind: 'item',
    playerItemId: readSatchel(db)[0]?.playerItemId ?? 's1',
    itemDefId: 'item_travelers_salve',
  });
  store().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });
}

afterEach(() => {
  useBattleStore.setState({ snapshot: null, context: null, labels: null, events: [], items: [] });
});

describe('the script', () => {
  /**
   * The script is four beats and fixtures §3's battle is four rounds. Not a coincidence to leave
   * unasserted: a beat list shorter than the fight leaves the player unprompted mid-tutorial, and a
   * longer one means a round the engine never reaches.
   */
  it('has exactly one beat per round the tutorial actually plays', () => {
    const db = freshInstall();

    open(db);
    playScript(db);

    expect(state().round).toBe(TUTORIAL_BEATS.length);
    expect(state().outcome).toBe('win');
  });

  it('withholds Attack on the round the Salve is demonstrated, and nowhere else', () => {
    expect(TUTORIAL_BEATS.filter((beat) => !beat.attackEnabled)).toHaveLength(1);
    expect(TUTORIAL_BEATS[2]?.attackEnabled).toBe(false);
  });

  it('offers no beat once the fight is over', () => {
    const db = freshInstall();

    open(db);
    playScript(db);

    expect(beatFor(state())).toBeNull();
  });

  it('offers no beat before the battle has begun', () => {
    const db = freshInstall();

    open(db);

    expect(beatFor(state())).toBeNull();
  });

  it('advances a beat per round while the fight runs', () => {
    const db = freshInstall();

    open(db);
    useBattleStore.getState().dispatch(db, { kind: 'begin' });

    expect(beatFor(state())).toBe(TUTORIAL_BEATS[0]);

    useBattleStore.getState().dispatch(db, { kind: 'move', moveId: 'skill_basic_attack' });

    expect(beatFor(state())).toBe(TUTORIAL_BEATS[1]);
  });
});

describe('a fresh install through the tutorial', () => {
  /**
   * ↯ **The Blade's +1 Might is what makes the fixture's arithmetic hold.** GDD 10 §6.3 works from
   * Might 11, which is base 10 plus the equipped Mortal weapon (§5.2). Asserted through the stat the
   * battle actually opened with, so a gear term that silently stopped applying fails here.
   */
  it('fights with the equipped Blade counted in', () => {
    const db = freshInstall();

    open(db);

    expect(state().player.stats.might).toBe(11);
  });

  it('spends exactly one Salve, leaving two', () => {
    const db = freshInstall();

    open(db);
    playScript(db);

    expect(readSatchel(db)).toHaveLength(2);
    expect(state().itemsConsumed).toHaveLength(1);
  });

  it('records the battle and reaches the hub having finished onboarding', () => {
    const db = freshInstall();

    expect(hasFinishedTutorial(db)).toBe(false);

    open(db);
    playScript(db);
    useBattleStore.getState().settle(db, '2026-08-18');

    expect(peek(db, 10, 'battle')).toHaveLength(1);
    expect(readPlayer(db)?.vigorCurrent).toBe(state().player.vigor);
    expect(hasFinishedTutorial(db)).toBe(true);
  });

  /** Drops: none. The Wisp has no pool rows and the tutorial has no `drop_rate` entries (§6.5). */
  it('rolls nothing, because the Wisp is in no drop table', () => {
    const db = freshInstall();

    open(db);
    playScript(db);

    expect(state().drops).toEqual({ items: [], gear: [], trinket: null });
  });
});

describe('hasFinishedTutorial', () => {
  /**
   * ↯ Read from the bestiary rather than from `tutorial_completed_at`. That column is the server's
   * and only lands once the battle syncs — but the API is off between sessions by design, so a
   * player who fought the tutorial offline would be walked through it again on every cold start.
   */
  it('is true offline, before the server has ever seen the battle', () => {
    const db = freshInstall();

    recordBattle(db, { playerId: PLAYER_ID, enemyId: TUTORIAL_ENEMY_ID, won: true });

    expect(readPlayer(db)?.tutorialCompletedAt).toBeNull();
    expect(hasFinishedTutorial(db)).toBe(true);
  });

  /** A restored profile that finished the tutorial elsewhere carries the column and no local row. */
  it('honours the server column for a profile restored onto new hardware', () => {
    const db = freshInstall();

    db.runSync("UPDATE player SET tutorial_completed_at = '2026-08-01T00:00:00Z'");

    expect(hasFinishedTutorial(db)).toBe(true);
  });

  /** A lost tutorial still counts as met — §6 is one-time, and losing it is not possible anyway. */
  it('counts an encounter, not a win', () => {
    const db = freshInstall();

    recordBattle(db, { playerId: PLAYER_ID, enemyId: TUTORIAL_ENEMY_ID, won: false });

    expect(hasFinishedTutorial(db)).toBe(true);
  });
});
