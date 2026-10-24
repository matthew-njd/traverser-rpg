import { scriptedRng, seededRng } from '../rng';
import { markSettled, step } from '../state';
import { rulesFor } from '../types';
import { movesUsed, startBattle } from './harness';

/**
 * The round state machine — T5 §7 and §11.6.
 *
 * Assertions here are about *flow*: who acts, when the fight stops, what is rejected. The arithmetic
 * is already pinned by the damage suite and is not restated.
 */

/** A one-sided matchup: a huge Might build against a Harpy, so one hit ends it. */
const overwhelming = (rng = seededRng(7)) =>
  startBattle({
    enemyId: 'enemy_harpy',
    level: 5,
    playerStats: { vigor: 40, might: 400, stride: 60 },
    rng,
  });

describe('ending the battle', () => {
  /**
   * ↯ A KO by the faster combatant ends the fight **that instant** — the slower one does not act
   * (GDD 2 §5.3). Asserted on the event stream rather than the final state, because a second
   * `move_used` is the whole bug and the final state looks identical either way.
   */
  it('gives the slower combatant no action when the faster one lands a KO', () => {
    const battle = overwhelming();

    battle.take({ kind: 'begin' });

    expect(battle.state.first).toBe('player');

    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    expect(battle.state.outcome).toBe('win');
    expect(movesUsed(battle.events)).toEqual(['skill_basic_attack']);
  });

  it('leaves the player at the 25% Vigor floor on a loss, and rolls no loot', () => {
    const battle = startBattle({
      enemyId: 'enemy_cerberus',
      level: 30,
      playerStats: { vigor: 40, might: 1, resolve: 1, aegis: 1, stride: 1 },
      rng: seededRng(3),
    });

    battle.take({ kind: 'begin' });

    while (battle.state.outcome === null) {
      battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    }

    expect(battle.state.outcome).toBe('loss');
    expect(battle.state.player.vigor).toBe(10);
    expect(battle.state.drops).toBeNull();
  });

  /** GDD 2 §5.7 — retreat always succeeds, takes no draw, and forfeits the loot chance. */
  it('flees a wild encounter with no draw and no loot', () => {
    const rng = scriptedRng([]);
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { might: 20, stride: 60 },
      rng,
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'flee' });

    expect(battle.state.outcome).toBe('flee');
    expect(battle.state.drops).toBeNull();
    expect(rng.taken).toBe(0);
  });

  it('rejects Flee outright when the rules forbid it', () => {
    const battle = startBattle({
      enemyId: 'enemy_cerberus',
      level: 15,
      playerStats: { might: 20, stride: 60 },
      encounterKind: 'zone_boss',
      rng: seededRng(1),
    });

    battle.take({ kind: 'begin' });

    expect(() => battle.take({ kind: 'flee' })).toThrow(/cannot be fled/);
    expect(rulesFor('zone_boss').fleeable).toBe(false);
    // GDD 2 §9 — none of the six bosses, mid-bosses included.
    expect(rulesFor('mini_boss').fleeable).toBe(false);
  });

  /** Terminal and idempotent — what makes a resumed-then-completed battle safe to submit once. */
  it('is idempotent once settled', () => {
    const battle = overwhelming();

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    const settled = battle.state;

    for (const action of [
      { kind: 'move', moveId: 'skill_basic_attack' },
      { kind: 'flee' },
      { kind: 'begin' },
    ] as const) {
      const again = step(settled, action, battle.context, scriptedRng([]));

      expect(again.state).toBe(settled);
      expect(again.events).toEqual([]);
    }

    expect(markSettled(settled).phase).toBe('settled');
  });
});

describe('per-battle uses', () => {
  it('decrements, reaches zero, and then rejects the move', () => {
    // Might 2 against a Harpy: ~2 damage a swing, so the fight outlasts the allowance rather than
    // ending before the third attempt and returning the idempotent settled state instead.
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { vigor: 200, might: 2, resolve: 40, aegis: 40, stride: 60 },
      uses: { skill_iron_advance: 2 },
      rng: seededRng(11),
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });

    expect(battle.state.uses.skill_iron_advance).toBe(1);

    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });

    expect(battle.state.uses.skill_iron_advance).toBe(0);
    expect(() => battle.take({ kind: 'move', moveId: 'skill_iron_advance' })).toThrow(/no uses left/);
  });

  it('reports the remaining uses on the event, and leaves an unlimited move null', () => {
    const battle = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { vigor: 200, might: 12, stride: 60 },
      uses: { skill_iron_advance: 3 },
      rng: seededRng(5),
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_iron_advance' });
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    const reported = battle.events.flatMap((event) =>
      event.type === 'move_used' && event.actor === 'player' ? [event.usesLeft] : [],
    );

    expect(reported).toEqual([2, null]);
  });

  /** A fresh battle gets a fresh allowance — uses are per battle, not per day (GDD 2 §4). */
  it('starts each battle with its own allowance', () => {
    const first = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { vigor: 200, might: 12, stride: 60 },
      uses: { skill_iron_advance: 1 },
      rng: seededRng(5),
    });

    first.take({ kind: 'begin' });
    first.take({ kind: 'move', moveId: 'skill_iron_advance' });

    expect(first.state.uses.skill_iron_advance).toBe(0);

    const second = startBattle({
      enemyId: 'enemy_harpy',
      level: 5,
      playerStats: { vigor: 200, might: 12, stride: 60 },
      uses: { skill_iron_advance: 1 },
      rng: seededRng(5),
    });

    expect(second.state.uses.skill_iron_advance).toBe(1);
  });
});

describe('the input boundary', () => {
  it('refuses a move before the battle has begun', () => {
    const battle = overwhelming();

    expect(() => battle.take({ kind: 'move', moveId: 'skill_basic_attack' })).toThrow(/not begun/);
  });

  it('refuses a second begin', () => {
    const battle = overwhelming();

    battle.take({ kind: 'begin' });

    expect(() => battle.take({ kind: 'begin' })).toThrow(/already begun/);
  });

  it('names a move it does not know rather than silently missing the turn', () => {
    const battle = overwhelming();

    battle.take({ kind: 'begin' });

    expect(() => battle.take({ kind: 'move', moveId: 'skill_nonexistent' })).toThrow(/no such move/);
  });
});

/**
 * T5 §11.7's property test, at a size that runs in a second rather than a minute. Every battle
 * terminates, Vigor stays inside its bounds, and no hit ever deals 0.
 */
describe('over many seeds', () => {
  it('terminates with Vigor in bounds and no zero-damage hit', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const rng = seededRng(seed);
      const level = 1 + (seed % 60);

      const battle = startBattle({
        enemyId: ['enemy_harpy', 'enemy_satyr', 'enemy_cerberus', 'enemy_strix'][seed % 4]!,
        level,
        playerStats: { vigor: 20 + level, might: 10 + level, resolve: 10, favor: 10, aegis: 10 },
        rng,
      });

      battle.take({ kind: 'begin' });

      let rounds = 0;

      while (battle.state.outcome === null) {
        battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
        rounds += 1;

        expect(rounds).toBeLessThan(500);
      }

      expect(battle.state.player.vigor).toBeGreaterThanOrEqual(0);
      expect(battle.state.player.vigor).toBeLessThanOrEqual(battle.state.player.vigorMax);
      expect(battle.state.enemy.vigor).toBeGreaterThanOrEqual(0);

      for (const event of battle.events) {
        if (event.type === 'damage_dealt') {
          expect(event.amount).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});
