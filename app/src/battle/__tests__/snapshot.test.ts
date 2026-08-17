import { seededRng } from '../rng';
import {
  SNAPSHOT_SCHEMA_VERSION,
  type BattleSnapshot,
  parseSnapshot,
  resumeSnapshot,
  serialiseSnapshot,
} from '../snapshot';
import { step } from '../state';
import { startBattle } from './harness';

/**
 * The snapshot — T5 §8, §8.1 and §11.7.
 *
 * The property that matters: a fight interrupted and resumed is **identical** to the same fight
 * uninterrupted under the same draws. Everything else here is about the two hazards that abandon a
 * battle rather than resume it wrongly.
 */

const snapshotOf = (state: BattleSnapshot['state'], overrides: Partial<BattleSnapshot> = {}): BattleSnapshot => ({
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  clientBattleId: '019fd954-0745-7748-9892-000000000001',
  grantId: null,
  startedAt: '2026-08-17T10:00:00-04:00',
  contentVersion: 2,
  rngSeed: null,
  state,
  ...overrides,
});

/** The same fight, with the same draws, played straight through or serialised halfway. */
const play = (interrupt: boolean) => {
  const rng = seededRng(4_242);

  const battle = startBattle({
    enemyId: 'enemy_cerberus',
    level: 15,
    playerStats: { vigor: 60, might: 24, resolve: 16, favor: 10, aegis: 12, stride: 20 },
    rng,
  });

  battle.take({ kind: 'begin' });
  battle.take({ kind: 'move', moveId: 'skill_iron_advance' });

  let state = battle.state;

  if (interrupt) {
    // Killed and reopened: the state crosses JSON and comes back.
    const resumed = resumeSnapshot(parseSnapshot(serialiseSnapshot(snapshotOf(state))), {
      contentVersion: 2,
    });

    expect(resumed.ok).toBe(true);

    if (resumed.ok) {
      state = resumed.snapshot.state;
    }
  }

  while (state.outcome === null) {
    state = step(state, { kind: 'move', moveId: 'skill_basic_attack' }, battle.context, rng).state;
  }

  return state;
};

describe('round trip', () => {
  it('survives serialisation with nothing lost', () => {
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 15,
      playerStats: { vigor: 36, might: 30, stride: 10 },
      rng: seededRng(1),
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });

    const restored = parseSnapshot(serialiseSnapshot(snapshotOf(battle.state)));

    expect(restored.state).toEqual(battle.state);
  });

  /**
   * The one that would matter on a device: continue the fight from the restored state and the
   * outcome is the same as if it had never been interrupted.
   */
  it('completes identically whether or not it was interrupted', () => {
    const straight = play(false);
    const interrupted = play(true);

    expect(interrupted).toEqual(straight);
  });

  it('is written only between turns, so no transient phase can be observed', () => {
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 15,
      playerStats: { vigor: 36, might: 8, resolve: 20, aegis: 20, stride: 10 },
      rng: seededRng(2),
    });

    const phases = new Set<string>([battle.state.phase]);

    battle.take({ kind: 'begin' });
    phases.add(battle.state.phase);

    for (let turn = 0; turn < 3 && battle.state.outcome === null; turn += 1) {
      battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
      phases.add(battle.state.phase);
    }

    for (const phase of phases) {
      expect(['enemy_intro', 'await_player', 'victory', 'defeat', 'fled']).toContain(phase);
    }
  });
});

describe('the resume hazards (§8.1)', () => {
  const state = (() => {
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 15,
      playerStats: { vigor: 36, might: 30, stride: 10 },
      rng: seededRng(9),
    });

    battle.take({ kind: 'begin' });

    return battle.state;
  })();

  /**
   * A sync between backgrounding and resuming can bump `content_version` and change a move's Power.
   * Resuming a fight whose numbers moved mid-flight is worse than losing it — and the player keeps
   * the encounter either way, because grants are held client-side until spent.
   */
  it('abandons a battle whose content moved', () => {
    const result = resumeSnapshot(snapshotOf(state, { contentVersion: 2 }), { contentVersion: 3 });

    expect(result).toEqual({ ok: false, reason: 'content_moved' });
  });

  it('abandons a battle whose state shape moved', () => {
    const result = resumeSnapshot(
      snapshotOf(state, { schemaVersion: SNAPSHOT_SCHEMA_VERSION + 1 }),
      { contentVersion: 2 },
    );

    expect(result).toEqual({ ok: false, reason: 'schema_moved' });
  });

  it('resumes when both match', () => {
    expect(resumeSnapshot(snapshotOf(state), { contentVersion: 2 }).ok).toBe(true);
  });

  /** The battle id is minted once and carried, so a replayed payload is a no-op (T2 §5). */
  it('keeps the battle id across a resume', () => {
    const snapshot = snapshotOf(state);
    const restored = parseSnapshot(serialiseSnapshot(snapshot));

    expect(restored.clientBattleId).toBe(snapshot.clientBattleId);
  });
});
