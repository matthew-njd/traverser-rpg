/**
 * The content bundle's shape, declared once (T4 §5.1, tech-01 §3).
 *
 * One spec drives three things that would otherwise be three transcriptions of the same 17 tables:
 * wire validation, the `INSERT` column list, and the SQLite → JS conversion on the way back out. A
 * field added to the server's payload and forgotten in one of the three is the failure this exists
 * to make impossible.
 *
 * Column names are the wire's and the table's — identical by construction, because tech-02 §2 names
 * wire fields after tech-01's columns. ↯ This is the one module in the app allowed to hold wire keys
 * besides `sync/dto.ts`, for that reason.
 */

/**
 * `dec` is a decimal **string** at the column's scale, stored verbatim and parsed at the point of
 * use (tech-02 §2). `bool` crosses as a JSON boolean and stores as SQLite's 0/1.
 */
export type ColumnKind = 'text' | 'text?' | 'int' | 'int?' | 'bool' | 'dec';

export interface TableSpec {
  /** The array's field name in the bundle payload, where it differs from the table name. */
  readonly field: string;
  readonly columns: Readonly<Record<string, ColumnKind>>;
}

export const CONTENT_TABLES = {
  game_type: {
    field: 'game_types',
    columns: { id: 'text', display_name: 'text', cycle_ordinal: 'int' },
  },
  type_effectiveness: {
    field: 'type_effectiveness',
    columns: { attacker_type_id: 'text', defender_type_id: 'text', multiplier: 'dec' },
  },
  zone: {
    field: 'zones',
    columns: { id: 'text', display_name: 'text', ordinal: 'int', is_released: 'bool' },
  },
  zone_gate: {
    field: 'zone_gates',
    columns: {
      id: 'text',
      zone_id: 'text',
      enemy_id: 'text',
      gate_kind: 'text',
      league_threshold: 'int',
      unlocks_zone_id: 'text?',
      is_hard_gate: 'bool',
    },
  },
  enemy: {
    field: 'enemies',
    columns: {
      id: 'text',
      display_name: 'text',
      zone_id: 'text?',
      type_id: 'text?',
      role: 'text',
    },
  },
  enemy_stat_scaling: {
    field: 'enemy_stat_scaling',
    columns: { enemy_id: 'text', stat: 'text', base: 'dec', rate: 'dec' },
  },
  enemy_move: {
    field: 'enemy_moves',
    columns: {
      id: 'text',
      enemy_id: 'text',
      display_name: 'text',
      category: 'text',
      type_id: 'text?',
      power: 'int',
      ai_weight: 'int',
      ordinal: 'int',
    },
  },
  enemy_drop_pool: {
    field: 'enemy_drop_pool',
    columns: {
      enemy_id: 'text',
      encounter_kind: 'text',
      item_def_id: 'text',
      weight: 'int',
      ordinal: 'int',
    },
  },
  player_skill_def: {
    field: 'player_skill_defs',
    columns: {
      id: 'text',
      display_name: 'text',
      category: 'text',
      type_id: 'text?',
      power: 'int',
      uses: 'int?',
      unlock_level: 'int',
    },
  },
  gear_move: {
    field: 'gear_moves',
    columns: {
      id: 'text',
      display_name: 'text',
      type_id: 'text',
      power: 'int',
      uses: 'int',
      effect: 'text?',
    },
  },
  gear_def: {
    field: 'gear_defs',
    columns: {
      id: 'text',
      display_name: 'text',
      slot: 'text',
      tier: 'text',
      zone_id: 'text?',
      grants_move_id: 'text?',
      flavor: 'text?',
    },
  },
  gear_tier_bonus: {
    field: 'gear_tier_bonuses',
    columns: { tier: 'text', rate: 'dec', flat: 'int', trinket_split: 'dec' },
  },
  item_def: {
    field: 'item_defs',
    columns: {
      id: 'text',
      display_name: 'text',
      category: 'text',
      rarity: 'text',
      type_id: 'text?',
      heal_pct: 'int?',
      effect: 'text?',
      max_stack: 'int',
      battle_only: 'bool',
      flavor: 'text',
    },
  },
  drop_rate: {
    field: 'drop_rates',
    columns: {
      encounter_kind: 'text',
      reward_kind: 'text',
      chance: 'dec',
      qty_min: 'int',
      qty_max: 'int',
      tier: 'text?',
    },
  },
  level_milestone: {
    field: 'level_milestones',
    columns: {
      level: 'int',
      reward_kind: 'text',
      item_def_id: 'text?',
      gear_tier: 'text?',
    },
  },
  streak_milestone: {
    field: 'streak_milestones',
    columns: { day: 'int', slot: 'text', tier: 'text' },
  },
  xp_curve: {
    field: 'xp_curve',
    columns: { level: 'int', xp_to_next: 'int?', cumulative: 'int' },
  },
} as const satisfies Readonly<Record<string, TableSpec>>;

export type ContentTable = keyof typeof CONTENT_TABLES;

export const CONTENT_TABLE_NAMES = Object.keys(CONTENT_TABLES) as readonly ContentTable[];
