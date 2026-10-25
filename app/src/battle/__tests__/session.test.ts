import { seedEmbeddedContent } from '../../content/store';
import type { SqliteDatabase } from '../../db/types';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { recordBattle } from '../mirror';
import { buildContext, dropKindFor, loadoutFor, startEncounter, usesFor } from '../session';
import { CONTENT } from './fixtures';

/**
 * Assembling a real battle from the mirror and the bundle.
 *
 * What is worth pinning here is not the engine — that is proven above — but the four values this
 * layer decides *for* it: the enemy's level, the player's Vigor, which drop table applies, and which
 * moves the player may pick. Each of them is a rule the GDD states and none is visible from a
 * reducer test.
 */
function battleReady(overrides: Record<string, unknown> = {}): SqliteDatabase {
  const db = registeredDatabase(overrides);

  seedEmbeddedContent(db);

  return db;
}

describe('dropKindFor', () => {
  it('maps each encounter kind onto its drop table', () => {
    expect(dropKindFor('wild', 0)).toBe('wild');
    expect(dropKindFor('explore', 0)).toBe('wild');
    expect(dropKindFor('mini_boss', 0)).toBe('mini_boss');
  });

  /**
   * ↯ Read from the bestiary **as it stands before this battle** (T5 §10.1) — the row is incremented
   * by the very fight being resolved, so a victory that re-read it would always see a repeat kill and
   * a first-clear boss would never pay its first-clear table.
   */
  it('pays the first-clear table until the boss has actually been beaten', () => {
    expect(dropKindFor('zone_boss', 0)).toBe('zone_boss_first');
    expect(dropKindFor('zone_boss', 1)).toBe('zone_boss_repeat');
  });

  /** The tutorial has no `drop_rate` rows at all, so there is nothing to roll and no draw taken. */
  it('gives the tutorial no drop table', () => {
    expect(dropKindFor('tutorial', 0)).toBeNull();
  });
});

describe('loadoutFor', () => {
  const ids = (moves: readonly { id: string }[]) => moves.map((move) => move.id);
  const loadout = (level: number, trinket: string | null = null, stored: string[] = []) =>
    loadoutFor(CONTENT, level, trinket, stored);

  /** *Unlocked* is derivable from `level >= unlock_level` and is never stored (T1 §4). */
  it('offers only what the level has unlocked', () => {
    expect(loadout(1).skills).toEqual([]);
    expect(ids(loadout(4).skills)).toEqual(['skill_iron_advance']);
  });

  it('always offers Basic Attack as Attack, never in a slot', () => {
    expect(loadout(60).attack.id).toBe('skill_basic_attack');
    expect(ids(loadout(60).skills)).not.toContain('skill_basic_attack');
  });

  /** GDD 3 §2.4 — with nothing chosen, the first four by unlock order; the fifth is benched. */
  it('fills unchosen slots in unlock order, not id order', () => {
    expect(ids(loadout(22).skills)).toEqual([
      'skill_iron_advance',
      'skill_thunderers_wrath',
      'skill_warlords_advance',
      'skill_shadowstep',
    ]);
    expect(ids(loadout(22).available)).toContain('skill_titans_reach');
    expect(ids(loadout(22).skills)).not.toContain('skill_titans_reach');
  });

  it('keeps a stored choice and fills around it', () => {
    expect(ids(loadout(22, null, ['skill_titans_reach']).skills)).toEqual([
      'skill_titans_reach',
      'skill_iron_advance',
      'skill_thunderers_wrath',
      'skill_warlords_advance',
    ]);
  });

  /** GDD 3 §4.1 — unequipping removes access, and the freed slot fills. */
  it("drops a Trinket move whose Trinket is no longer worn", () => {
    expect(ids(loadout(16, null, ['move_gatekeepers_ruse']).skills)).not.toContain('move_gatekeepers_ruse');
    expect(loadout(16, null, ['move_gatekeepers_ruse']).skills).toHaveLength(4);
  });

  it('fills a free slot with a worn Trinket move, and benches it when the slots are full', () => {
    expect(ids(loadout(10, 'move_gatekeepers_ruse').skills)).toContain('move_gatekeepers_ruse');
    expect(ids(loadout(16, 'move_gatekeepers_ruse').skills)).not.toContain('move_gatekeepers_ruse');
    expect(ids(loadout(16, 'move_gatekeepers_ruse').available).at(-1)).toBe('move_gatekeepers_ruse');
    expect(ids(loadout(16, 'move_gatekeepers_ruse', ['move_gatekeepers_ruse']).skills)[0]).toBe(
      'move_gatekeepers_ruse',
    );
  });

  it('never holds more than four, whatever was stored', () => {
    const stored = ['skill_titans_reach', 'skill_shadowstep', 'skill_pale_sentence', 'skill_iron_advance', 'skill_warlords_advance'];

    expect(loadout(30, null, stored).skills).toHaveLength(4);
  });
});

describe('usesFor', () => {
  /** GDD 8 §4.1 — a Mythic Trinket move has 4 uses, replenished each battle like every skill. */
  it('budgets each equipped move in slot order', () => {
    const uses = usesFor(loadoutFor(CONTENT, 10, 'move_gatekeepers_ruse', []).skills);

    expect(uses).toEqual({
      skill_iron_advance: 5,
      skill_thunderers_wrath: 4,
      skill_warlords_advance: 4,
      move_gatekeepers_ruse: 4,
    });
  });

  it('is empty when nothing is equipped', () => {
    expect(usesFor([])).toEqual({});
  });
});

describe('buildContext', () => {
  it('carries only the drop pool belonging to this enemy', () => {
    const context = buildContext(battleReady(), 'enemy_harpy', 'wild');

    expect(context.pool.length).toBeGreaterThan(0);
    expect(context.enemy.id).toBe('enemy_harpy');
  });

  /**
   * GDD 5 §3.4 and §5 — Cerberus's first kill draws from Fleet Omen, Gravemark and Pale Ash, and a
   * repeat kill never offers the Rare. The pool used to be filtered by enemy alone, which merged the
   * two lists: drill 7 dropped the repeat-only Warhex on a first kill.
   */
  it("draws a zone boss's first and repeat kills from their own lists", () => {
    const ids = (kind: 'zone_boss_first' | 'zone_boss_repeat') =>
      buildContext(battleReady(), 'enemy_cerberus', kind).pool.map((entry) => entry.itemDefId);

    expect(ids('zone_boss_first')).toEqual(['item_fleet_omen', 'item_gravemark', 'item_pale_ash']);
    expect(ids('zone_boss_repeat')).not.toContain('item_fleet_omen');
    expect(ids('zone_boss_repeat')).toContain('item_warhex');
  });

  it('refuses an enemy the bundle does not have', () => {
    expect(() => buildContext(battleReady(), 'enemy_nonexistent', 'wild')).toThrow(/no such enemy/);
  });
});

describe('startEncounter', () => {
  const open = (db: SqliteDatabase, enemyId = 'enemy_harpy') =>
    startEncounter(db, {
      enemyId,
      encounterKind: 'wild',
      clientBattleId: 'cb-1',
      startedAt: '2026-08-18T10:00:00-04:00',
    });

  /** ↯ Enemy level always equals the player's level at encounter time (GDD 5–7). */
  it('scales the enemy to the player\'s level', () => {
    const encounter = open(battleReady({ level: 23 }));

    expect(encounter.snapshot.state.enemyLevel).toBe(23);
  });

  /** GDD 2 §6 — Vigor persists between battles; a battle does not open at full health. */
  it('opens with the Vigor the player is actually carrying', () => {
    const encounter = open(battleReady({ level: 1, vigor_current: 12 }));

    expect(encounter.snapshot.state.player.vigor).toBe(12);
    expect(encounter.snapshot.state.player.vigorMax).toBe(20);
  });

  /**
   * A stale mirror can hold a Vigor above the pool the player's allocation supports — a level-up
   * arrives from the server before the allocation replays. Clamped rather than trusted, and never
   * to zero, which would open a fight already lost.
   */
  it('clamps a Vigor the current pool cannot hold', () => {
    const encounter = open(battleReady({ level: 1, vigor_current: 999 }));

    expect(encounter.snapshot.state.player.vigor).toBe(20);
  });

  /** GDD 13 §6.2 — the chevron needs a prior *fight*, which is later than Bestiary discovery. */
  it('withholds the chevron hint until this enemy has been fought once', () => {
    const db = battleReady();

    expect(open(db).chevronsUnlocked).toBe(false);

    recordBattle(db, {
      playerId: open(db).player.playerId,
      enemyId: 'enemy_harpy',
      won: false,
    });

    expect(open(db).chevronsUnlocked).toBe(true);
  });

  it('carries the first-kill flag from the bestiary, not from the encounter count', () => {
    const db = battleReady();
    const { playerId } = open(db).player;

    recordBattle(db, { playerId, enemyId: 'enemy_harpy', won: false });

    // Fought and lost: it has been met, but never beaten, so the first-clear table still applies.
    expect(open(db).snapshot.state.firstKill).toBe(true);

    recordBattle(db, { playerId, enemyId: 'enemy_harpy', won: true });

    expect(open(db).snapshot.state.firstKill).toBe(false);
  });

  it('stamps the snapshot with the content version the fight is being resolved against', () => {
    const db = battleReady();

    expect(open(db).snapshot.contentVersion).toBeGreaterThan(0);
  });
});

describe('the Trinket move in a real encounter', () => {
  const withTrinket = (gearDefId: string) => {
    const db = battleReady({ level: 10 });
    const playerId = db.getFirstSync<{ id: string }>('SELECT id FROM player')?.id ?? '';

    db.runSync(
      `INSERT INTO player_gear (id, player_id, gear_def_id, equipped_slot, level_at_drop, bonus_primary, bonus_secondary, acquired_at)
       VALUES ('t', ?, ?, 'trinket', 10, 3, 3, '2026-08-01T00:00:00Z')`,
      [playerId, gearDefId],
    );

    return startEncounter(db, {
      enemyId: 'enemy_harpy',
      encounterKind: 'wild',
      clientBattleId: 'cb-t',
      startedAt: '2026-08-18T10:00:00-04:00',
    }).snapshot.state.uses;
  };

  /** GDD 8 §2.1 — Mythic and Divine Trinkets grant a move; Heroic ones never do. */
  it('offers a Mythic Trinket move and nothing for a Heroic one', () => {
    expect(withTrinket('gear_gatekeepers_ruse')).toHaveProperty('move_gatekeepers_ruse', 4);
    expect(Object.keys(withTrinket('gear_skyroad_sigil'))).not.toContain('move_gatekeepers_ruse');
  });
});
