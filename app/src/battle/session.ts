import { type ContentRow, readContentRows, readContentVersion } from '../content/bundle';
import type { ContentTable } from '../content/schema';
import type { SqliteDatabase } from '../db/types';
import { effectiveStats } from '../progression/stats';
import { type MirrorPlayer, readPlayer } from '../sync/mirror';
import type { StatDeltas } from '../sync/writes';
import { type BattleContent, loadBattleContent } from './content';
import { type DropEncounterKind, dropTablesFrom } from './loot';
import {
  readBestiary,
  readEquippedGear,
  readSatchel,
  readStoredLoadout,
  readTrinketMove,
} from './mirror';
import { SNAPSHOT_SCHEMA_VERSION, type BattleSnapshot } from './snapshot';
import { type BattleContext, type BattleEvent, type BattleItem, beginBattle } from './state';
import { type EncounterKind, type Move, rulesFor } from './types';

/**
 * Assembling a real battle from the mirror and the bundle — the door between the device and the
 * pure engine below it (T5 §1.1).
 *
 * The test harness builds the same shape from the embedded bundle with no database. Everything the
 * engine needs is gathered **once, here**, so no reducer call reaches for content mid-fight.
 */

export class NoPlayerError extends Error {
  constructor() {
    super('there is no player on this device');
    this.name = 'NoPlayerError';
  }
}

/**
 * T5 §10.1 — which `drop_rate` rows the victory roll consults. Null for the tutorial, which has no
 * rows at all, so fixtures §3's "Drops: None" needs no branch in the engine.
 *
 * `zone_boss_first` vs `zone_boss_repeat` is decided on the bestiary **as it stands before this
 * battle**, because the row is incremented by the very battle being resolved.
 */
export function dropKindFor(
  encounterKind: EncounterKind,
  previousDefeats: number,
): DropEncounterKind | null {
  switch (encounterKind) {
    case 'wild':
    case 'explore':
      return 'wild';
    case 'mini_boss':
      return 'mini_boss';
    case 'zone_boss':
      return previousDefeats === 0 ? 'zone_boss_first' : 'zone_boss_repeat';
    case 'tutorial':
      return null;
  }
}

/** GDD 2 §5 — four skill slots, plus Basic Attack, which never takes one. */
export const LOADOUT_SLOTS = 4;

export type LimitedMove = Move & { readonly uses: number };

export interface Loadout {
  readonly attack: Move;
  /** Slot order, at most {@link LOADOUT_SLOTS}. */
  readonly skills: readonly LimitedMove[];
  /** Everything the slots may hold, in unlock order with a Trinket move last (GDD 3 §4.1). */
  readonly available: readonly LimitedMove[];
}

function basicAttack(content: BattleContent): Move {
  const attack = content.skills.find((skill) => skill.uses === null);

  if (attack === undefined) {
    throw new Error('the content bundle has no unlimited-use skill to serve as Basic Attack');
  }

  return attack;
}

/**
 * GDD 2 §5 / GDD 3 §4.1 — the stored choices still available, then empty slots filled from the
 * rest in unlock order (GDD 10 §7.1), a worn Trinket's move last.
 *
 * *Unlocked* is derivable — `level >= unlock_level`, never stored (T1 §4). A stored id that is no
 * longer available (its Trinket came off) simply drops out, and the fill takes its slot.
 */
export function loadoutFor(
  content: BattleContent,
  level: number,
  trinketMoveId: string | null,
  stored: readonly string[],
): Loadout {
  const skills = content.skills
    .filter((skill): skill is LimitedMove & typeof skill => skill.uses !== null && skill.unlockLevel <= level)
    .sort((a, b) => a.unlockLevel - b.unlockLevel || a.id.localeCompare(b.id));
  const gear = trinketMoveId === null ? undefined : content.gearMoves.get(trinketMoveId);
  const pool: LimitedMove[] = gear === undefined ? skills : [...skills, gear];

  const equipped = [...new Set(stored)]
    .map((id) => pool.find((move) => move.id === id))
    .filter((move) => move !== undefined)
    .slice(0, LOADOUT_SLOTS);

  for (const move of pool) {
    if (equipped.length < LOADOUT_SLOTS && !equipped.includes(move)) {
      equipped.push(move);
    }
  }

  return {
    attack: basicAttack(content),
    skills: equipped,
    available: pool,
  };
}

export function readLoadout(db: SqliteDatabase, content: BattleContent, level: number): Loadout {
  return loadoutFor(content, level, readTrinketMove(db), readStoredLoadout(db));
}

/** Per-battle use budgets for the equipped moves, in slot order, reset every battle (T5 §7.2). */
export function usesFor(moves: readonly LimitedMove[]): Record<string, number> {
  return Object.fromEntries(moves.map((move) => [move.id, move.uses]));
}

/**
 * What the action menu offers: Basic Attack, then the moves this fight was built with.
 *
 * Read from the state's use budgets rather than the stored loadout, so a resumed fight offers what
 * it started with.
 */
export function offeredMoves(context: BattleContext, uses: Readonly<Record<string, number>>): Move[] {
  const equipped = Object.keys(uses)
    .map((id) => context.moves.get(id))
    .filter((move) => move !== undefined);

  return [basicAttack(context.content), ...equipped];
}

function itemsFrom(rows: (table: ContentTable) => readonly ContentRow[]): Map<string, BattleItem> {
  const items = new Map<string, BattleItem>();

  for (const row of rows('item_def')) {
    const id = String(row.id);

    items.set(id, {
      id,
      category: String(row.category) as BattleItem['category'],
      healPct: typeof row.heal_pct === 'number' ? row.heal_pct : null,
      effect: typeof row.effect === 'string' ? row.effect : null,
      typeId: typeof row.type_id === 'string' ? row.type_id : null,
    });
  }

  return items;
}

export function buildContext(
  db: SqliteDatabase,
  enemyId: string,
  dropEncounterKind: DropEncounterKind | null,
): BattleContext {
  const rows = (table: ContentTable) => readContentRows(db, table);
  const content = loadBattleContent(db);
  const enemy = content.enemies.get(enemyId);

  if (enemy === undefined) {
    throw new Error(`no such enemy in the content bundle: ${enemyId}`);
  }

  const moves = new Map<string, Move>();

  for (const skill of content.skills) {
    moves.set(skill.id, skill);
  }

  for (const move of content.gearMoves.values()) {
    moves.set(move.id, move);
  }

  return {
    content,
    enemy,
    moves,
    items: itemsFrom(rows),
    tables: dropTablesFrom(rows),
    // By drop kind as well as enemy: a zone boss has separate first-kill and repeat lists, and
    // merging them gave a first kill repeat-only items and a repeat kill the first-kill Rare.
    pool: rows('enemy_drop_pool')
      .filter((row) => row.enemy_id === enemyId && row.encounter_kind === dropEncounterKind)
      .map((row) => ({
        itemDefId: String(row.item_def_id),
        weight: Number(row.weight),
        ordinal: Number(row.ordinal ?? 0),
      })),
    dropEncounterKind,
  };
}

export interface Encounter {
  readonly snapshot: BattleSnapshot;
  readonly context: BattleContext;
  readonly events: readonly BattleEvent[];
  readonly player: MirrorPlayer;
  /** GDD 13 §6.2 — the chevron hint needs a *prior* fight, not merely a sighting. */
  readonly chevronsUnlocked: boolean;
  readonly playerStats: StatDeltas;
}

/**
 * Opens a battle against `enemyId` at the player's own level.
 *
 * ↯ **Enemy level equals the player's level at encounter time** (GDD 5–7). It is read here, once,
 * and carried in the state — a level-up landing mid-fight from a sync must not re-scale the enemy.
 */
export function startEncounter(
  db: SqliteDatabase,
  input: {
    readonly enemyId: string;
    readonly encounterKind: EncounterKind;
    readonly clientBattleId: string;
    readonly grantId?: string | null;
    readonly startedAt: string;
    /** Set only when reproducing a seeded run; production battles use the system RNG. */
    readonly rngSeed?: number | null;
  },
): Encounter {
  const player = readPlayer(db);

  if (player === null) {
    throw new NoPlayerError();
  }

  const bestiary = readBestiary(db, input.enemyId);
  const context = buildContext(
    db,
    input.enemyId,
    dropKindFor(input.encounterKind, bestiary.defeatCount),
  );

  // Equipped gear counts — GDD 10 §6.3's tutorial arithmetic reads from Might 11, which is the
  // Traveler's Blade's +1 (§5.2). ↯ Stride is unreachable from here by construction (GDD 8 §2).
  const playerStats = effectiveStats(player, readEquippedGear(db));

  const opening = beginBattle({
    encounterKind: input.encounterKind,
    rules: rulesFor(input.encounterKind),
    enemy: context.enemy,
    enemyLevel: player.level,
    playerStats,
    // The pool the player actually walks in with (GDD 2 §6) — Vigor persists between battles.
    playerVigor: Math.max(1, Math.min(playerStats.vigor, player.vigorCurrent)),
    // ↯ Frozen here, like the stat block. The Trinket and the loadout cannot change mid-fight, and a
    // resume reads these keys rather than the stored loadout (`offeredMoves`).
    uses: usesFor(readLoadout(db, context.content, player.level).skills),
    firstKill: bestiary.defeatCount === 0,
  });

  return {
    snapshot: {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      clientBattleId: input.clientBattleId,
      grantId: input.grantId ?? null,
      startedAt: input.startedAt,
      contentVersion: readContentVersion(db) ?? 0,
      rngSeed: input.rngSeed ?? null,
      state: opening.state,
    },
    context,
    events: opening.events,
    player,
    chevronsUnlocked: bestiary.encounterCount > 0,
    playerStats,
  };
}

/**
 * GDD 10 §6 — the tutorial's enemy, and the one place its id is written down.
 *
 * `enemy_waystone_wisp` is tutorial-exclusive and non-canon: no zone, no type, no drop-table rows
 * (§6.2). Its "Drops: None" therefore falls out of empty content rather than a special case, which
 * is what lets the whole fight run without taking a single RNG draw (T5 §11.3).
 */
export const TUTORIAL_ENEMY_ID = 'enemy_waystone_wisp';

/** The satchel as the Item menu needs it: what is held, and what each one does. */
export function battleItems(
  db: SqliteDatabase,
  context: BattleContext,
): { playerItemId: string; item: BattleItem }[] {
  return readSatchel(db).flatMap((held) => {
    const item = context.items.get(held.itemDefId);

    return item === undefined ? [] : [{ playerItemId: held.playerItemId, item }];
  });
}
