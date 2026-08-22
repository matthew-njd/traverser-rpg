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

export interface GearPiece {
  readonly id: string;
  readonly slot: string;
  readonly tier: string;
  /** Null for Weapon/Armor/Accessory, which are zone-agnostic. Set on every Trinket (GDD 8 §5.2). */
  readonly zoneId: string | null;
}

export interface TierBonus {
  /** Decimal strings, as stored (tech-02 §2) — the arithmetic below never sees a float. */
  readonly rate: string;
  readonly flat: number;
  readonly trinketSplit: string;
}

export interface DropTables {
  readonly rates: readonly DropRate[];
  /** Every common item, the fallback pool for an enemy with no rows of its own (T1 §3). */
  readonly genericCommonItemIds: readonly string[];
  /** `gear_def`, which is what turns a rolled tier into a piece the server can insert (GDD 8 §5). */
  readonly gear: readonly GearPiece[];
  readonly tierBonuses: ReadonlyMap<string, TierBonus>;
}

/**
 * A resolved drop: the piece, and the bonus frozen at the level it dropped at (GDD 8 §3.2).
 *
 * ↯ The bonus is **stored as rolled and never re-derived**, on either tier. Recomputing it from the
 * tier and level would be wrong by design the moment a rebalance moves a rate (T1 §4).
 */
export interface GearDrop {
  readonly defId: string;
  readonly levelAtDrop: number;
  readonly bonusPrimary: number;
  /** Trinkets only — GDD 8 §3.1 splits their bonus across Favor and Aegis, equally. */
  readonly bonusSecondary: number | null;
}

export interface Drops {
  readonly items: readonly string[];
  readonly gear: readonly GearDrop[];
  readonly trinket: GearDrop | null;
}

export const NO_DROPS: Drops = { items: [], gear: [], trinket: null };

/** GDD 8 §5.1's equal-weight slot pick, in the GDD's own order so a scripted draw is pinnable. */
const GEAR_SLOTS = ['weapon', 'armor', 'accessory'] as const;

/**
 * `round(decimal × multiplier)`, on integers.
 *
 * ↯ **Half rounds to even, not up, and JS's `Math.round` does not.** fixtures §5 pins three cells
 * that only come out under half-to-even: Mortal at L10 (`0.05 × 10 = 0.5` → 0, bonus 1), Divine at
 * L10 (`2.5` → 2, bonus 6) and Divine at L42 (`10.5` → 10, bonus 14). `Math.round` returns 15 for
 * the last of those. Integer arithmetic because an exact half has to *be* an exact half — `0.17 × L`
 * in binary floats is not reliably one.
 */
function scaledRound(decimal: string, multiplier: number): number {
  const [whole = '0', fraction = ''] = decimal.split('.');
  const scale = 10 ** fraction.length;
  const numerator = Number(`${whole}${fraction}`) * multiplier;
  const quotient = Math.floor(numerator / scale);
  const remainder = numerator - quotient * scale;
  const half = remainder * 2;

  return half > scale || (half === scale && quotient % 2 === 1) ? quotient + 1 : quotient;
}

/** GDD 8 §3.2 — `round(rate × L) + flat`, and the Trinket's `round(split × that)` per stat. */
export function gearBonus(
  bonus: TierBonus,
  level: number,
  slot: string,
): { primary: number; secondary: number | null } {
  const tier = scaledRound(bonus.rate, level) + bonus.flat;

  if (slot !== 'trinket') {
    return { primary: tier, secondary: null };
  }

  const split = scaledRound(bonus.trinketSplit, tier);

  return { primary: split, secondary: split };
}

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

  const gear = rows('gear_def').map((row) => ({
    id: String(row.id),
    slot: String(row.slot),
    tier: String(row.tier),
    zoneId: typeof row.zone_id === 'string' ? row.zone_id : null,
  }));

  const tierBonuses = new Map(
    rows('gear_tier_bonus').map((row) => [
      String(row.tier),
      {
        rate: String(row.rate),
        flat: integer(row, 'flat'),
        trinketSplit: String(row.trinket_split),
      },
    ]),
  );

  return { rates, genericCommonItemIds, gear, tierBonuses };
}

/**
 * Tier → piece (GDD 8 §5). Weapon/Armor/Accessory is an equal-weight draw across the three slots;
 * a Trinket takes **no draw at all** — one row exists per zone and tier, so the enemy's zone and the
 * rolled tier name it outright (§5.2, "only one Trinket exists per zone").
 */
function resolveGear(
  tables: DropTables,
  rewardKind: 'gear' | 'trinket',
  tier: string,
  level: number,
  zoneId: string | null,
  rng: Rng,
): GearDrop | null {
  const slot = rewardKind === 'trinket' ? 'trinket' : null;

  const candidates = tables.gear
    .filter(
      (piece) =>
        piece.tier === tier &&
        (slot === null ? piece.slot !== 'trinket' : piece.slot === slot) &&
        (slot === null || piece.zoneId === zoneId),
    )
    .sort((left, right) => left.id.localeCompare(right.id));

  const bonus = tables.tierBonuses.get(tier);

  if (candidates.length === 0 || bonus === undefined) {
    return null;
  }

  let piece = candidates[0];

  if (slot !== 'trinket') {
    // Scanned in the GDD's slot order rather than the id order, so a scripted draw maps to the
    // table as it is written. **One draw**, taken only for a Weapon/Armor/Accessory roll.
    const slots = GEAR_SLOTS.filter((name) => candidates.some((entry) => entry.slot === name));
    const chosen = weightedPick(slots, () => 1, rng);

    piece = candidates.find((entry) => entry.slot === chosen);
  }

  if (piece === undefined) {
    return null;
  }

  const { primary, secondary } = gearBonus(bonus, level, piece.slot);

  return { defId: piece.id, levelAtDrop: level, bonusPrimary: primary, bonusSecondary: secondary };
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
  /** The player's level at encounter time, which the bonus is frozen against (GDD 8 §3.2). */
  readonly level: number;
  /** The enemy's zone, which is what names its Trinket (GDD 8 §5.2). Null for the Wisp. */
  readonly zoneId: string | null;
  readonly rng: Rng;
}): Drops {
  const { encounterKind, tables, pool, level, zoneId, rng } = input;

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
  const gear: GearDrop[] = [];
  let trinket: GearDrop | null = null;

  for (const { kind, rate } of granted) {
    if (kind !== 'item') {
      // The **piece**, not the tier (T5 §10.1, amended 2026-08-22). A tier on the wire names no
      // row the server has, and the seed's tier ladder is content this device already caches.
      const resolved = resolveGear(
        tables,
        kind === 'gear' ? 'gear' : 'trinket',
        rate.tier ?? (kind === 'gear' ? 'mortal' : 'heroic'),
        level,
        zoneId,
        rng,
      );

      if (resolved === null) {
        continue;
      }

      if (kind === 'gear') {
        gear.push(resolved);
      } else {
        trinket = resolved;
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
