import type { StatDeltas } from '../sync/writes';
import { type ContentRow, readContentRows } from '../content/bundle';
import type { ContentTable } from '../content/schema';
import type { SqliteDatabase } from '../db/types';
import type { Move, MoveCategory } from './types';

/**
 * The content the engine reads, narrowed once at the boundary (T5 §1.1).
 *
 * Rows arrive from SQLite weakly typed and snake_case, with decimals as strings (tech-02 §2). This
 * module is the only place in `src/battle/` that sees that shape — everything below it works in
 * numbers and manifest keys.
 *
 * ↯ Content is validated **here, at battle start**, not consulted defensively per hit. A missing
 * chart cell is a corrupt bundle, and a mid-hit fallback to ×1.0 would turn it into a fight that
 * silently computes the wrong damage. Failing at construction costs one battle and names the cause.
 */

export class BattleContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleContentError';
  }
}

/** Attacker → defender → multiplier. Complete over every known type, checked at construction. */
export type TypeChart = ReadonlyMap<string, number>;

export interface EnemyDefinition {
  readonly id: string;
  /** Null for `enemy_waystone_wisp`, which is typeless (T5 §3.2 — type multiplier is 1.0). */
  readonly typeId: string | null;
  readonly zoneId: string | null;
  readonly role: string;
  /** Ordered by move id — a stable, content-derived order is part of the AI contract (T5 §5). */
  readonly moves: readonly EnemyMove[];
  readonly scaling: readonly StatScaling[];
}

export interface EnemyMove extends Move {
  readonly aiWeight: number;
}

export interface PlayerSkill extends Move {
  readonly unlockLevel: number;
  /** Null for Basic Attack, which has no per-battle limit. */
  readonly uses: number | null;
}

export interface GearMove extends Move {
  readonly uses: number;
  readonly effect: string | null;
}

/**
 * `floor(base + rate × L)` (fixtures §6), held as **thousandths**.
 *
 * ↯ Integers, not the parsed decimals. `base + rate × L` in binary floating point lands just below
 * an exact integer often enough to matter — a rate of 1.15 at level 20 evaluates to
 * 22.999999999999996, which floors to 22 where the fixture says 23. The column scales are 2 and 3
 * decimal places (tech-01 §3), so thousandths hold both exactly and the arithmetic stays integral
 * until the single divide at the end.
 */
export interface StatScaling {
  readonly stat: keyof StatDeltas;
  readonly baseMilli: number;
  readonly rateMilli: number;
}

export interface BattleContent {
  readonly chart: TypeChart;
  readonly typeIds: readonly string[];
  readonly enemies: ReadonlyMap<string, EnemyDefinition>;
  readonly skills: readonly PlayerSkill[];
  readonly gearMoves: ReadonlyMap<string, GearMove>;
}

export function chartKey(attackerTypeId: string, defenderTypeId: string): string {
  return `${attackerTypeId}>${defenderTypeId}`;
}

function text(row: ContentRow, column: string, table: ContentTable): string {
  const value = row[column];

  if (typeof value !== 'string') {
    throw new BattleContentError(`${table}.${column} is not text`);
  }

  return value;
}

function nullableText(row: ContentRow, column: string): string | null {
  const value = row[column];

  return typeof value === 'string' ? value : null;
}

function integer(row: ContentRow, column: string, table: ContentTable): number {
  const value = row[column];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new BattleContentError(`${table}.${column} is not an integer`);
  }

  return value;
}

/** A decimal string at a known scale, as an integer count of thousandths. */
function milli(row: ContentRow, column: string, table: ContentTable): number {
  const value = row[column];

  if (typeof value !== 'string') {
    throw new BattleContentError(`${table}.${column} is not a decimal string`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new BattleContentError(`${table}.${column} is not a number: ${value}`);
  }

  return Math.round(parsed * 1000);
}

function category(row: ContentRow, table: ContentTable): MoveCategory {
  const value = text(row, 'category', table);

  if (value !== 'physical' && value !== 'divine') {
    throw new BattleContentError(`${table}.category is neither physical nor divine: ${value}`);
  }

  return value;
}

function statKey(row: ContentRow): keyof StatDeltas {
  const value = text(row, 'stat', 'enemy_stat_scaling');
  const known = ['vigor', 'might', 'resolve', 'favor', 'aegis', 'stride'] as const;
  const match = known.find((stat) => stat === value);

  if (match === undefined) {
    throw new BattleContentError(`enemy_stat_scaling.stat is not a known stat: ${value}`);
  }

  return match;
}

/**
 * Builds the engine's view from raw content rows.
 *
 * Split from {@link loadBattleContent} so tests can build straight from the embedded bundle without
 * a database — which is what keeps the whole engine suite runnable under plain Node (T4 §12).
 */
export function battleContentFrom(rows: (table: ContentTable) => readonly ContentRow[]): BattleContent {
  const typeIds = rows('game_type')
    .map((row) => text(row, 'id', 'game_type'))
    .sort();

  const chart = new Map<string, number>();

  for (const row of rows('type_effectiveness')) {
    const attacker = text(row, 'attacker_type_id', 'type_effectiveness');
    const defender = text(row, 'defender_type_id', 'type_effectiveness');

    chart.set(chartKey(attacker, defender), milli(row, 'multiplier', 'type_effectiveness') / 1000);
  }

  // Completeness, once. Every ordered pair must be present or the chart is not a closed hexagon,
  // and the missing cell would otherwise surface as a plausible-looking ×1.0 in the middle of a hit.
  for (const attacker of typeIds) {
    for (const defender of typeIds) {
      if (!chart.has(chartKey(attacker, defender))) {
        throw new BattleContentError(`the type chart is missing ${attacker} → ${defender}`);
      }
    }
  }

  const movesByEnemy = new Map<string, EnemyMove[]>();

  // ↯ Sorted by `ordinal`, **not** by the primary key (T5 §5, amended 2026-08-17). The order must be
  // content-derived and stable — never object-key iteration order, or every scripted AI test is
  // flaky about one run in ten — but the key is the wrong content: it puts Cerberus's Death Breath
  // first, and the cumulative boundaries T5 §11.6 pins (0.35, 0.80) only hold for the GDD's own
  // table order, which is what `ordinal` records.
  for (const row of [...rows('enemy_move')].sort(byOrdinal)) {
    const enemyId = text(row, 'enemy_id', 'enemy_move');
    const list = movesByEnemy.get(enemyId) ?? [];

    list.push({
      id: text(row, 'id', 'enemy_move'),
      category: category(row, 'enemy_move'),
      typeId: nullableText(row, 'type_id'),
      power: integer(row, 'power', 'enemy_move'),
      aiWeight: integer(row, 'ai_weight', 'enemy_move'),
    });

    movesByEnemy.set(enemyId, list);
  }

  const scalingByEnemy = new Map<string, StatScaling[]>();

  for (const row of rows('enemy_stat_scaling')) {
    const enemyId = text(row, 'enemy_id', 'enemy_stat_scaling');
    const list = scalingByEnemy.get(enemyId) ?? [];

    list.push({
      stat: statKey(row),
      baseMilli: milli(row, 'base', 'enemy_stat_scaling'),
      rateMilli: milli(row, 'rate', 'enemy_stat_scaling'),
    });

    scalingByEnemy.set(enemyId, list);
  }

  const enemies = new Map<string, EnemyDefinition>();

  for (const row of rows('enemy')) {
    const id = text(row, 'id', 'enemy');

    enemies.set(id, {
      id,
      typeId: nullableText(row, 'type_id'),
      zoneId: nullableText(row, 'zone_id'),
      role: text(row, 'role', 'enemy'),
      moves: movesByEnemy.get(id) ?? [],
      scaling: scalingByEnemy.get(id) ?? [],
    });
  }

  const skills = [...rows('player_skill_def')]
    .sort(byId('id'))
    .map((row) => ({
      id: text(row, 'id', 'player_skill_def'),
      category: category(row, 'player_skill_def'),
      typeId: nullableText(row, 'type_id'),
      power: integer(row, 'power', 'player_skill_def'),
      unlockLevel: integer(row, 'unlock_level', 'player_skill_def'),
      uses: typeof row.uses === 'number' ? row.uses : null,
    }));

  const gearMoves = new Map<string, GearMove>();

  for (const row of rows('gear_move')) {
    const id = text(row, 'id', 'gear_move');

    gearMoves.set(id, {
      id,
      // Every gear move is Divine — the table has no category column, because a Trinket move that
      // was Physical could never take the type multiplier that is the whole point of granting it.
      category: 'divine',
      typeId: text(row, 'type_id', 'gear_move'),
      power: integer(row, 'power', 'gear_move'),
      uses: integer(row, 'uses', 'gear_move'),
      effect: nullableText(row, 'effect'),
    });
  }

  return { chart, typeIds, enemies, skills, gearMoves };
}

function byId(column: string) {
  return (left: ContentRow, right: ContentRow): number =>
    String(left[column]).localeCompare(String(right[column]));
}

/** Ties broken by id, so the order is total even if a future seed leaves two rows at the same ordinal. */
function byOrdinal(left: ContentRow, right: ContentRow): number {
  return Number(left.ordinal ?? 0) - Number(right.ordinal ?? 0) || byId('id')(left, right);
}

/** The database-backed door. Everything below this line is pure. */
export function loadBattleContent(db: SqliteDatabase): BattleContent {
  return battleContentFrom((table) => readContentRows(db, table));
}

/**
 * `floor(base + rate × L)` for every stat (fixtures §6). Enemy level always equals player level at
 * encounter time (GDD 5–7, CLAUDE.md), so the caller passes the player's level and nothing here
 * derives one.
 */
export function enemyStatsAt(enemy: EnemyDefinition, level: number): StatDeltas {
  const stats: StatDeltas = { vigor: 0, might: 0, resolve: 0, favor: 0, aegis: 0, stride: 0 };
  const out = { ...stats };

  for (const scaling of enemy.scaling) {
    out[scaling.stat] = Math.floor((scaling.baseMilli + scaling.rateMilli * level) / 1000);
  }

  return out;
}
