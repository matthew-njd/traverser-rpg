import type { MirrorPlayer } from '../sync/mirror';
import type { StatDeltas } from '../sync/writes';

/** GDD 1 §5 — the Level 1 baseline. fixtures §5 pins these and the tutorial battle is scripted on them. */
export const BASE_STATS: StatDeltas = {
  vigor: 20,
  might: 10,
  resolve: 10,
  favor: 10,
  aegis: 10,
  stride: 10,
};

/**
 * GDD 8 §3.1 — which stat each single-stat slot raises. The Trinket raises two, so
 * {@link gearBonuses} handles it rather than this table.
 *
 * ↯ **No slot maps to Stride, and none ever will** (GDD 1 §5, CLAUDE.md). The rule is enforced by
 * this table having no entry rather than by a check, so there is no branch anyone can "fix".
 */
export const SLOT_STAT = {
  weapon: 'might',
  armor: 'resolve',
  accessory: 'vigor',
} as const satisfies Readonly<Record<string, keyof StatDeltas>>;

export interface EquippedBonus {
  readonly equippedSlot: string | null;
  /** Frozen at drop time (GDD 8 §3.2). Read as stored; never re-derived from tier and level. */
  readonly bonusPrimary: number;
  /** Aegis on a Trinket; null on every other slot. */
  readonly bonusSecondary: number | null;
}

/** The stats a piece raises in `slot`, and by how much. Empty for a slot that raises nothing. */
export function gearBonuses(
  slot: string,
  gear: Pick<EquippedBonus, 'bonusPrimary' | 'bonusSecondary'>,
): [keyof StatDeltas, number][] {
  // GDD 8 §3.1 — Favor takes the primary and Aegis the secondary, each frozen at drop.
  if (slot === 'trinket') {
    return [
      ['favor', gear.bonusPrimary],
      ['aegis', gear.bonusSecondary ?? 0],
    ];
  }

  return slot in SLOT_STAT ? [[SLOT_STAT[slot as keyof typeof SLOT_STAT], gear.bonusPrimary]] : [];
}

/**
 * Base, plus allocation, plus **equipped** gear (tech-01 §4 — gear never touches the stored
 * allocation, so unequipping is lossless).
 *
 * Unequipped rows contribute nothing, which is why the slot is what is read rather than ownership.
 */
export function effectiveStats(
  player: MirrorPlayer,
  equipped: readonly EquippedBonus[] = [],
): StatDeltas {
  const stats: StatDeltas = {
    vigor: BASE_STATS.vigor + player.allocVigor,
    might: BASE_STATS.might + player.allocMight,
    resolve: BASE_STATS.resolve + player.allocResolve,
    favor: BASE_STATS.favor + player.allocFavor,
    aegis: BASE_STATS.aegis + player.allocAegis,
    stride: BASE_STATS.stride + player.allocStride,
  };

  const total = { ...stats };

  for (const gear of equipped) {
    if (gear.equippedSlot === null) {
      continue;
    }

    for (const [stat, bonus] of gearBonuses(gear.equippedSlot, gear)) {
      total[stat] += bonus;
    }
  }

  return total;
}
