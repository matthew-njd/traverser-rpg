import { peek } from '../../db/outbox';
import { PLAYER_ID, registeredDatabase } from '../../sync/__tests__/fixtures';
import { readPlayer } from '../../sync/mirror';
import { seededRng } from '../rng';
import { battlePayload, settleBattle, toWireBattle } from '../settle';
import { startBattle } from './harness';

/**
 * Writing a settled battle out (T5 §10.3, T2 §4.1).
 *
 * The ingest side is asserted by the API suite; what is unproven here is the payload's shape and
 * the local transaction — the queue entry and the Vigor result landing together.
 */

const META = {
  clientBattleId: '019fd954-0745-7748-9892-00000000ba11',
  grantId: null,
  activityDate: '2026-08-17',
  startedAt: '2026-08-17T10:00:00-04:00',
  endedAt: '2026-08-17T10:03:00-04:00',
};

/** A won fight, resolved through the real engine rather than hand-built. */
function wonBattle() {
  const battle = startBattle({
    enemyId: 'enemy_harpy',
    level: 5,
    playerStats: { vigor: 40, might: 400, stride: 60 },
    rng: seededRng(7),
  });

  battle.take({ kind: 'begin' });
  battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

  return battle;
}

describe('the payload', () => {
  it('carries the outcome, the Vigor result and the drops', () => {
    const battle = wonBattle();
    const payload = battlePayload(battle.state, META);

    expect(payload).toMatchObject({
      clientBattleId: META.clientBattleId,
      enemyId: 'enemy_harpy',
      encounterKind: 'wild',
      enemyLevel: 5,
      outcome: 'win',
      vigorAfter: battle.state.player.vigor,
    });

    expect(payload.drops).toEqual(battle.state.drops);
  });

  it('refuses to build one from a battle still in progress', () => {
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { might: 5 },
      rng: seededRng(1),
    });

    battle.take({ kind: 'begin' });

    expect(() => battlePayload(battle.state, META)).toThrow(/not settled/);
  });

  /** T2 §4.1's shape: one flat `drops` array of `{ kind, def_id }`, not three keyed lists. */
  it('flattens drops onto the wire as kind + def_id', () => {
    const wire = toWireBattle({
      ...battlePayload(wonBattle().state, META),
      drops: { items: ['item_stormveil'], gear: ['mortal'], trinket: 'heroic' },
    });

    expect(wire.drops).toEqual([
      { kind: 'item', def_id: 'item_stormveil' },
      { kind: 'gear', def_id: 'mortal' },
      { kind: 'trinket', def_id: 'heroic' },
    ]);

    expect(wire.client_battle_id).toBe(META.clientBattleId);
    expect(wire.activity_date).toBe('2026-08-17');
  });

  it('sends an empty drops array for a loss rather than omitting it', () => {
    const wire = toWireBattle({
      ...battlePayload(wonBattle().state, META),
      outcome: 'loss',
      drops: { items: [], gear: [], trinket: null },
    });

    expect(wire.drops).toEqual([]);
  });
});

describe('settling', () => {
  it('queues the battle and applies the Vigor in one go', () => {
    const db = registeredDatabase({ vigor_current: 36 });
    const payload = { ...battlePayload(wonBattle().state, META), vigorAfter: 13 };

    settleBattle(db, payload, PLAYER_ID, Date.parse('2026-08-17T14:03:00Z'));

    const queued = peek(db, 10, 'battle');

    expect(queued).toHaveLength(1);
    expect(queued[0]?.clientOpId).toBe(META.clientBattleId);
    expect(JSON.parse(queued[0]?.payload ?? '{}')).toMatchObject({ outcome: 'win', vigorAfter: 13 });

    expect(readPlayer(db)?.vigorCurrent).toBe(13);
  });

  /**
   * The outbox key is the `client_battle_id`, so settling the same battle twice — a resumed fight
   * completed on both sides of a crash — queues one entry, not two. `INSERT OR IGNORE` does it.
   */
  it('queues one entry for a battle settled twice', () => {
    const db = registeredDatabase();
    const payload = battlePayload(wonBattle().state, META);

    settleBattle(db, payload, PLAYER_ID, Date.now());
    settleBattle(db, payload, PLAYER_ID, Date.now());

    expect(peek(db, 10, 'battle')).toHaveLength(1);
  });
});
