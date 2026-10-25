import { enemyStatsAt } from '../content';
import { resolveDamage } from '../damage';
import { scriptedRng } from '../rng';
import type { BattleRules } from '../types';
import { CONTENT, enemy, foe, player } from './fixtures';
import { damageLog, startBattle } from './harness';

/** fixtures §10.10 — the six Trinket moves (GDD 8 §4.3) and the effect each Divine one leaves. */

const NO_DRAWS: BattleRules = {
  crit: false,
  randomFactor: false,
  fleeable: true,
  skillsEnabled: true,
  itemsEnabled: true,
};

const gearMove = (id: string) => {
  const move = CONTENT.gearMoves.get(id);

  if (move === undefined) {
    throw new Error(`no gear move ${id}`);
  }

  return move;
};

const CERBERUS_L15 = enemyStatsAt(enemy('enemy_cerberus'), 15);

describe('fixtures §10.10 — Trinket move damage at Cerberus L15, Favor 30', () => {
  it.each([
    ['move_gatekeepers_ruse', 40],
    ['move_coilbreakers_oath', 40],
    ['move_emberwise_ward', 10],
    ['move_gatekeepers_snare', 36],
    ['move_coilbreakers_wrath', 36],
    ['move_emberwise_verdict', 9],
  ])('%s deals %i', (id, expected) => {
    const result = resolveDamage({
      move: gearMove(id),
      attacker: player({ stats: { favor: 30 } }),
      defender: foe('underworld', { stats: CERBERUS_L15 }),
      chart: CONTENT.chart,
      rules: NO_DRAWS,
      rng: scriptedRng([]),
    });

    expect(result.damage).toBe(expected);
  });
});

describe('fixtures §10.10 — the effect lands after its own hit', () => {
  /** Stride 20 outruns Cerberus's 8, so no tie draw is taken; 0.5 picks Death Breath every turn. */
  const fight = (uses: Record<string, number>, draws: number) => {
    const battle = startBattle({
      enemyId: 'enemy_cerberus',
      level: 15,
      encounterKind: 'zone_boss',
      rules: NO_DRAWS,
      playerStats: { vigor: 60, favor: 30, aegis: 10, stride: 20 },
      uses,
      rng: scriptedRng(Array<number>(draws).fill(0.5)),
    });

    battle.take({ kind: 'begin' });

    return battle;
  };

  /** The mutation this guards: applying Rend before the damage, so Snare amplifies itself to 54. */
  it('Snare deals 36, then Warlord’s Advance takes the Rend for 48', () => {
    // 84 beats Cerberus's 61 Vigor (§10.9), so the spare draws feed the victory's loot roll.
    const battle = fight({ move_gatekeepers_snare: 3, skill_warlords_advance: 4 }, 10);

    battle.take({ kind: 'move', moveId: 'move_gatekeepers_snare' });
    expect(battle.state.enemy.effects.rend).toBe(true);

    battle.take({ kind: 'move', moveId: 'skill_warlords_advance' });

    expect(damageLog(battle.events).filter((_, index) => index % 2 === 0)).toEqual([36, 48]);
    expect(battle.state.enemy.effects.rend).toBe(false);
  });

  it.each([
    ['Wrath', 'move_coilbreakers_wrath', 'weaken', 'enemy'],
    ['Verdict', 'move_emberwise_verdict', 'fortify', 'player'],
  ] as const)('%s halves the next Death Breath to 4, and is spent', (_, moveId, effect, holder) => {
    const battle = fight({ [moveId]: 3 }, 1);

    battle.take({ kind: 'move', moveId });

    // Player first, so the log is [the Trinket hit, Death Breath].
    expect(damageLog(battle.events)[1]).toBe(4);
    expect(battle.state[holder].effects[effect]).toBe(false);
  });

  it('spends a use like any skill', () => {
    const battle = fight({ move_gatekeepers_ruse: 4 }, 1);

    battle.take({ kind: 'move', moveId: 'move_gatekeepers_ruse' });

    expect(battle.state.uses.move_gatekeepers_ruse).toBe(3);
  });
});
