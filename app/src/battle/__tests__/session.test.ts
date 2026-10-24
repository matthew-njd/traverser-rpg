import { seedEmbeddedContent } from '../../content/store';
import type { SqliteDatabase } from '../../db/types';
import { registeredDatabase } from '../../sync/__tests__/fixtures';
import { recordBattle } from '../mirror';
import { availableMoves, buildContext, dropKindFor, startEncounter, usesFor } from '../session';
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

describe('availableMoves', () => {
  /** *Unlocked* is derivable from `level >= unlock_level` and is never stored (T1 §4). */
  it('offers only what the level has unlocked', () => {
    expect(availableMoves(CONTENT, 1).skills).toEqual([]);
    expect(availableMoves(CONTENT, 4).skills.map((move) => move.id)).toEqual(['skill_iron_advance']);
  });

  it('always offers the unlimited move as Attack, at every level', () => {
    expect(availableMoves(CONTENT, 1).attack.id).toBe('skill_basic_attack');
    expect(availableMoves(CONTENT, 60).attack.id).toBe('skill_basic_attack');
  });

  it('never lists Basic Attack among the Skills', () => {
    expect(availableMoves(CONTENT, 60).skills.map((move) => move.id)).not.toContain(
      'skill_basic_attack',
    );
  });
});

describe('usesFor', () => {
  it('budgets each unlocked limited skill and leaves the unlimited one out', () => {
    const uses = usesFor(CONTENT, 6);

    expect(uses).toEqual({ skill_iron_advance: 5, skill_thunderers_wrath: 4 });
  });

  it('is empty at Level 1, where nothing limited is unlocked', () => {
    expect(usesFor(CONTENT, 1)).toEqual({});
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
