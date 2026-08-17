import type { ContentRow } from '../content/bundle';
import type { ContentTable } from '../content/schema';
import type { Rng } from './rng';
import { weightedPick } from './select';

/**
 * The victory roll (T5 §10.1): three independent dice in the fixed order item → gear → trinket,
 * then one pool-selection draw per granted item.
 *
 * **The client rolls loot; the server records it** (T5 §1.6). Rolling server-side would mean a boss
 * drop does not exist until the next sync, which with the API off by design can be days — that is
 * unacceptable for the reward loop and for the Reveal Card that fires on the victory screen.
 */

export type DropEncounterKind = 'wild' | 'mini_boss' | 'zone_boss_first' | 'zone_boss_repeat' | 'daily_goal';

export interface DropRate {
  readonly encounterKind: string;
  readonly rewardKind: string;
  readonly chance: number;
  readonly qtyMin: number;
  readonly qtyMax: number;
  readonly tier: string | null;
}

export interface DropTables {
  readonly rates: readonly DropRate[];
  /** Every common item, the fallback pool for an enemy with no rows of its own (T1 §3). */
  readonly genericCommonItemIds: readonly string[];
}

export interface Drops {
  readonly items: readonly string[];
  readonly gear: readonly string[];
  readonly trinket: string | null;
}

export const NO_DROPS: Drops = { items: [], gear: [], trinket: null };

/** Decimal strings on the wire and in SQLite (tech-02 §2) — parsed here, at the boundary. */
function decimal(row: ContentRow, column: string): number {
  const value = row[column];

  return typeof value === 'string' ? Number(value) : Number(value ?? 0);
}

function integer(row: ContentRow, column: string): number {
  const value = row[column];

  return typeof value === 'number' ? value : 0;
}

export function dropTablesFrom(rows: (table: ContentTable) => readonly ContentRow[]): DropTables {
  const rates = rows('drop_rate').map((row) => ({
    encounterKind: String(row.encounter_kind),
    rewardKind: String(row.reward_kind),
    chance: decimal(row, 'chance'),
    qtyMin: integer(row, 'qty_min'),
    qtyMax: integer(row, 'qty_max'),
    tier: typeof row.tier === 'string' ? row.tier : null,
  }));

  const genericCommonItemIds = rows('item_def')
    .filter((row) => row.rarity === 'common')
    .map((row) => String(row.id))
    .sort();

  return { rates, genericCommonItemIds };
}

/**
 * Rolls the drops for a won battle.
 *
 * ↯ Draw discipline is the whole contract here (T5 §4.1): the dice are taken in the fixed order
 * item → gear → trinket, **a reward kind with no row for this encounter takes no draw at all**, and
 * the per-item pool draws come after all three dice rather than interleaved. `enemy_waystone_wisp`
 * has no pool rows and the tutorial has no `drop_rate` entries, so fixtures §3's "Drops: None" falls
 * out of empty content with no special case — and takes zero draws, which is what lets the tutorial
 * run under an empty ScriptedRng.
 */
export function rollDrops(input: {
  readonly encounterKind: DropEncounterKind;
  readonly tables: DropTables;
  readonly pool: readonly { itemDefId: string; weight: number; ordinal: number }[];
  readonly rng: Rng;
}): Drops {
  const { encounterKind, tables, pool, rng } = input;

  const rateFor = (rewardKind: string) =>
    tables.rates.find(
      (rate) => rate.encounterKind === encounterKind && rate.rewardKind === rewardKind,
    );

  const granted: { kind: string; rate: DropRate }[] = [];

  for (const rewardKind of ['item', 'gear', 'trinket'] as const) {
    const rate = rateFor(rewardKind);

    // No row means this reward never drops here, expressed by the row's absence rather than by a
    // 0% chance (tech-01 §3) — so there is nothing to roll and no draw is taken.
    if (rate === undefined) {
      continue;
    }

    if (rng.next() < rate.chance) {
      granted.push({ kind: rewardKind, rate });
    }
  }

  const items: string[] = [];
  const gear: string[] = [];
  let trinket: string | null = null;

  for (const { kind, rate } of granted) {
    if (kind !== 'item') {
      // Gear and trinket resolve to a tier here; which piece of that tier is granted is GDD 8's
      // loot-table job and lands with gear at M3. The tier is what the payload carries.
      if (kind === 'gear') {
        gear.push(rate.tier ?? 'mortal');
      } else {
        trinket = rate.tier ?? 'heroic';
      }

      continue;
    }

    // The enemy's own pool if it has one, else the generic common pool (T5 §10.1).
    // Ordered by `ordinal` — the GDD's listed order — for the same reason the AI's move scan is
    // (T5 §5, amended 2026-08-17). The generic fallback has no ordinal and sorts by id, which is
    // the only order it has.
    const candidates =
      pool.length > 0
        ? [...pool].sort(
            (left, right) => left.ordinal - right.ordinal || left.itemDefId.localeCompare(right.itemDefId),
          )
        : tables.genericCommonItemIds.map((itemDefId, ordinal) => ({ itemDefId, weight: 1, ordinal }));

    if (candidates.length === 0) {
      continue;
    }

    // qty_min..qty_max, one pool draw per item granted (T5 §4.1). The quantity itself is not a
    // draw — no fixture treats it as one, and §4.1's list does not include it.
    for (let index = 0; index < Math.max(1, rate.qtyMin); index += 1) {
      items.push(weightedPick(candidates, (entry) => entry.weight, rng).itemDefId);
    }
  }

  return { items, gear, trinket };
}
