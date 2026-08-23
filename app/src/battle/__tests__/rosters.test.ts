import { seededRng } from '../rng';
import { startBattle } from './harness';

/**
 * M3/P8 — the rosters beyond Olympion become **selectable**, not merely seeded.
 *
 * Until this milestone the only way into a non-tutorial fight was a debug card hardcoded to
 * `zone_id = 'olympion'`, so Valheon's and Imperion's enemies had stats verified against fixtures §6
 * and no path that could open one. An encounter grant names any unlocked zone's roster, which is
 * what makes these reachable — and reachable is the half that was never checked.
 */
describe('the rosters beyond Olympion', () => {
  const wild = [
    'enemy_draugr',
    'enemy_valkyrie',
    'enemy_strix',
    'enemy_lemures',
  ] as const;

  it.each(wild)('opens and resolves a fight against %s', (enemyId) => {
    const battle = startBattle({
      enemyId,
      level: 30,
      playerStats: { vigor: 60, might: 400, stride: 90 },
      rng: seededRng(11),
    });

    battle.take({ kind: 'begin' });
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    expect(battle.state.enemyId).toBe(enemyId);
    expect(battle.state.enemy.vigorMax).toBeGreaterThan(0);
    expect(battle.state.round).toBeGreaterThanOrEqual(1);
  });
});

