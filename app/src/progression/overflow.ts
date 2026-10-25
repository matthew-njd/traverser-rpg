import type { SqliteDatabase } from '../db/types';

/** GDD 4 §5.1 and GDD 8 §5.5. Step 10's server-side twins are `Rewards.ItemCap` and `GearCap`. */
export const ITEM_CAP = 20;
export const GEAR_CAP = 12;

const RANK: Readonly<Record<string, number>> = {
  common: 0,
  mortal: 0,
  uncommon: 1,
  heroic: 1,
  rare: 2,
  mythic: 2,
  divine: 3,
};

export interface OverflowChoice {
  readonly id: string;
  readonly defId: string;
  readonly suggested: boolean;
}

/**
 * One keep/discard decision (GDD 4 §5.2, GDD 13 §5.1). `incoming` is the newest row past a cap, or a
 * parked reward when `pendingId` is set; `others` is everything that could make room. `room` is true
 * only for a parked reward that now fits.
 */
export interface Overflow {
  readonly kind: 'item' | 'gear';
  readonly incoming: { readonly id: string | null; readonly defId: string };
  readonly pendingId: string | null;
  readonly room: boolean;
  readonly others: readonly OverflowChoice[];
}

interface Held {
  id: string;
  defId: string;
  rank: number;
  /** Gear only: the slot, and the frozen bonus (both halves on a Trinket). */
  slot: string;
  bonus: number;
}

function heldItems(db: SqliteDatabase): Held[] {
  return db
    .getAllSync<{ id: string; item_def_id: string; rarity: string }>(
      `SELECT pi.id, pi.item_def_id, d.rarity FROM player_item pi JOIN item_def d ON d.id = pi.item_def_id
        ORDER BY pi.acquired_at DESC, pi.rowid DESC`,
    )
    .map((row) => ({ id: row.id, defId: row.item_def_id, rank: RANK[row.rarity] ?? 0, slot: '', bonus: 0 }));
}

/** Worn pieces are never offered: leaving one behind would also strip a stat mid-prompt. */
function heldGear(db: SqliteDatabase): { all: number; spare: Held[] } {
  const rows = db.getAllSync<{
    id: string;
    gear_def_id: string;
    tier: string;
    slot: string;
    bonus_primary: number;
    bonus_secondary: number | null;
    equipped_slot: string | null;
  }>(
    `SELECT pg.id, pg.gear_def_id, d.tier, d.slot, pg.bonus_primary, pg.bonus_secondary, pg.equipped_slot
       FROM player_gear pg JOIN gear_def d ON d.id = pg.gear_def_id
      ORDER BY pg.acquired_at DESC, pg.rowid DESC`,
  );

  return {
    all: rows.length,
    spare: rows
      .filter((row) => row.equipped_slot === null)
      .map((row) => ({
        id: row.id,
        defId: row.gear_def_id,
        rank: RANK[row.tier] ?? 0,
        slot: row.slot,
        bonus: row.bonus_primary + (row.bonus_secondary ?? 0),
      })),
  };
}

/**
 * GDD 13 §5.1's suggestion, "the fullest/lowest-value existing item". Ties fall to the newest, the
 * order `held` arrives in.
 *
 * - **Items:** lowest rarity, then the type held in the most copies.
 * - **Gear:** the slot with the most spares, then the weakest bonus in it, then the lowest tier.
 *   ↯ Bonus before tier, because a bonus is frozen at drop (GDD 8 §3.2): a Heroic piece from Level 5
 *   can be weaker than a Mortal one from Level 40, and the tier would suggest the wrong one.
 */
function choices(held: readonly Held[], kind: 'item' | 'gear'): OverflowChoice[] {
  const count = (key: (row: Held) => string) => {
    const counts = new Map<string, number>();

    for (const row of held) {
      counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
    }

    return (row: Held) => counts.get(key(row)) ?? 0;
  };

  const copies = count((row) => row.defId);
  const spares = count((row) => row.slot);

  const best = [...held].sort((a, b) =>
    kind === 'item'
      ? a.rank - b.rank || copies(b) - copies(a)
      : spares(b) - spares(a) || a.bonus - b.bonus || a.rank - b.rank,
  )[0];

  return held.map((row) => ({ id: row.id, defId: row.defId, suggested: row === best }));
}

/** The next decision the player owes, or null. A drop past a cap comes before a parked reward. */
export function readOverflow(db: SqliteDatabase): Overflow | null {
  const items = heldItems(db);
  const gear = heldGear(db);

  if (items.length > ITEM_CAP) {
    const [newest, ...rest] = items;

    return { kind: 'item', incoming: { id: newest!.id, defId: newest!.defId }, pendingId: null, room: false, others: choices(rest, 'item') };
  }

  if (gear.all > GEAR_CAP && gear.spare.length > 0) {
    const [newest, ...rest] = gear.spare;

    return { kind: 'gear', incoming: { id: newest!.id, defId: newest!.defId }, pendingId: null, room: false, others: choices(rest, 'gear') };
  }

  const pending = db.getFirstSync<{ id: string; kind: string; def_id: string }>(
    'SELECT id, kind, def_id FROM pending_reward ORDER BY created_at, id',
  );

  if (pending === null) {
    return null;
  }

  const isItem = pending.kind === 'item';

  return {
    kind: isItem ? 'item' : 'gear',
    incoming: { id: null, defId: pending.def_id },
    pendingId: pending.id,
    room: isItem ? items.length < ITEM_CAP : gear.all < GEAR_CAP,
    others: isItem ? choices(items, 'item') : choices(gear.spare, 'gear'),
  };
}
