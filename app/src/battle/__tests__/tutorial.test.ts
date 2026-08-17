import { scriptedRng } from '../rng';
import { TUTORIAL_RULES, rulesFor } from '../types';
import { damageLog, startBattle } from './harness';

/**
 * The tutorial battle, fixtures §3, **executed end to end** (T5 §11.3).
 *
 * Not four assertions but one fight: the six actions a player would tap, fed into the same `step`
 * every other battle uses. GDD 10 §6.4's script is a UI layer; the engine knows only that crit,
 * variance and the type chart are off (§7.4).
 *
 * ↯ The whole battle runs under a ScriptedRng with an **empty queue**, so any draw at all throws.
 * That is what proves T5 §1.2's bypass *skips* the draws rather than taking and discarding them —
 * a fixed-value RNG would coincidentally produce these same numbers and hide the difference.
 */
describe('fixtures §3 — the tutorial battle', () => {
  const runTutorial = () => {
    const rng = scriptedRng([]);

    // Player L1: Vigor 20, Might 10 + 1 from the starter Traveler's Blade = 11, Aegis 10.
    // Wisp: Vigor 15, Resolve 8, Favor 12, no type, Stride 6 against the player's 10.
    const battle = startBattle({
      enemyId: 'enemy_waystone_wisp',
      level: 1,
      playerStats: { vigor: 20, might: 11, aegis: 10, stride: 10 },
      encounterKind: 'tutorial',
      rules: TUTORIAL_RULES,
      dropEncounterKind: null,
      rng,
    });

    battle.take({ kind: 'begin' });

    return { battle, rng };
  };

  it('plays out round by round exactly as the fixture states', () => {
    const { battle, rng } = runTutorial();

    const vigorAfterEachRound: { player: number; wisp: number }[] = [];

    // Rounds 1 and 2: attack. Round 3: the Salve, demonstrating the Item action. Round 4: attack.
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    vigorAfterEachRound.push({ player: battle.state.player.vigor, wisp: battle.state.enemy.vigor });

    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    vigorAfterEachRound.push({ player: battle.state.player.vigor, wisp: battle.state.enemy.vigor });

    battle.take({ kind: 'item', playerItemId: 'pi-1', itemDefId: 'item_travelers_salve' });
    vigorAfterEachRound.push({ player: battle.state.player.vigor, wisp: battle.state.enemy.vigor });

    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    vigorAfterEachRound.push({ player: battle.state.player.vigor, wisp: battle.state.enemy.vigor });

    // Wisp 15 → 9 → 3 → 3 (the Salve round deals nothing) → 0.
    expect(vigorAfterEachRound.map((row) => row.wisp)).toEqual([9, 3, 3, 0]);

    // Player 20 → 16 → 12 → 16 (Salve +4, then the Wisp's 4) → 12.
    expect(vigorAfterEachRound.map((row) => row.player)).toEqual([16, 12, 12, 12]);

    expect(battle.state.outcome).toBe('win');
    expect(battle.state.player.vigor).toBe(12);
    expect(battle.state.player.vigorMax).toBe(20);
    expect(battle.state.round).toBe(4);

    // Drops: none. The Wisp has no pool rows and the tutorial has no drop_rate entries, so this
    // falls out of empty content rather than a special case — and takes no draw.
    expect(battle.state.drops).toEqual({ items: [], gear: [], trinket: null });

    rng.assertDrained();
    expect(rng.taken).toBe(0);
  });

  it('deals 6 every hit and takes 4 every hit', () => {
    const { battle } = runTutorial();

    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    // floor((40 × 11) / (8 × 8)) = 6 outgoing; floor((30 × 12) / (10 × 8)) = 4 incoming.
    expect(damageLog(battle.events)).toEqual([6, 4, 6, 4]);
  });

  it('heals exactly +4, which is 20% of a 20 Vigor pool', () => {
    const { battle } = runTutorial();

    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });
    battle.take({ kind: 'move', moveId: 'skill_basic_attack' });

    expect(battle.state.player.vigor).toBe(12);

    battle.take({ kind: 'item', playerItemId: 'pi-1', itemDefId: 'item_travelers_salve' });

    const healed = battle.events.flatMap((event) =>
      event.type === 'item_used' ? [event.healed] : [],
    );

    expect(healed).toEqual([4]);
    // 12 + 4 = 16, then the Wisp's 4 lands in the same round → 12.
    expect(battle.state.player.vigor).toBe(12);
    expect(battle.state.itemsConsumed).toEqual(['pi-1']);
  });

  it('the player acts first every round, on Stride and with no draw', () => {
    const { battle } = runTutorial();

    expect(battle.state.first).toBe('player');
    expect(battle.state.firstReason).toBe('stride');
  });

  /** The tutorial exception cannot leak into an ordinary encounter (T5 §11.3). */
  it('does not leak its rule flags to wild or boss encounters', () => {
    for (const kind of ['wild', 'zone_boss'] as const) {
      expect(rulesFor(kind)).toMatchObject({ crit: true, randomFactor: true });
    }

    expect(TUTORIAL_RULES).toMatchObject({ crit: false, randomFactor: false, skillsEnabled: false });
  });
});
