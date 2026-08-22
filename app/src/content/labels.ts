import { readContentRows } from './bundle';
import type { ContentTable } from './schema';
import type { SqliteDatabase } from '../db/types';

/**
 * Display names, read from the bundle by manifest key.
 *
 * Deliberately **not** part of the engine's content view: T5 §2 keeps `src/battle/` to manifest keys
 * with no display strings, so this lives on the content side and the screens join the two. It is
 * also the reason no component hardcodes "Harpy" — the seed owns the wording, and a content edit
 * changes the UI without touching a component.
 */
export type Labels = ReadonlyMap<string, string>;

const NAMED_TABLES = [
  'game_type',
  'zone',
  'enemy',
  'enemy_move',
  'player_skill_def',
  'gear_move',
  'gear_def',
  'item_def',
] as const satisfies readonly ContentTable[];

/**
 * One flat map across every named table. The manifest guarantees ids are unique app-wide, so a
 * per-table lookup would only make every call site pick the table its id already implies.
 */
export function loadLabels(db: SqliteDatabase): Labels {
  const labels = new Map<string, string>();

  for (const table of NAMED_TABLES) {
    for (const row of readContentRows(db, table)) {
      if (typeof row.id === 'string' && typeof row.display_name === 'string') {
        labels.set(row.id, row.display_name);
      }
    }
  }

  return labels;
}

/** The key itself when the bundle has no name for it — visible, and never a crash mid-battle. */
export function labelFor(labels: Labels, id: string): string {
  return labels.get(id) ?? id;
}

/** What GDD 13 §6.3's Reveal Card shows beside a name: the tier or rarity, and the flavour line. */
export interface RevealDetail {
  readonly grade: string;
  readonly flavor: string | null;
}

/**
 * `item_def.rarity` / `gear_def.tier` and the flavour text, by manifest key.
 *
 * Separate from {@link loadLabels} rather than folded into it: every screen needs a name, and only
 * the Reveal Card needs these two.
 */
export function loadRevealDetails(db: SqliteDatabase): ReadonlyMap<string, RevealDetail> {
  const details = new Map<string, RevealDetail>();

  for (const [table, gradeColumn] of [
    ['item_def', 'rarity'],
    ['gear_def', 'tier'],
  ] as const) {
    for (const row of readContentRows(db, table)) {
      if (typeof row.id === 'string' && typeof row[gradeColumn] === 'string') {
        details.set(row.id, {
          grade: row[gradeColumn],
          flavor: typeof row.flavor === 'string' ? row.flavor : null,
        });
      }
    }
  }

  return details;
}
