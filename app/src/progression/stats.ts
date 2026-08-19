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
 * GDD 8 §2 — which stat each equipped slot raises. A Trinket splits its bonus across Favor and
 * Aegis and is M3's, so it is absent here rather than mapped to one of them.
 *
 * ↯ **No slot maps to Stride, and none ever will** (GDD 1 §5, CLAUDE.md). The rule is enforced by
 * this table having no entry rather than by a check, so there is no branch anyone can "fix".
 */
const SLOT_STAT = {
  weapon: 'might',
  armor: 'resolve',
  accessory: 'vigor',
} as const satisfies Readonly<Record<string, keyof StatDeltas>>;

export interface EquippedBonus {
  readonly equippedSlot: string | null;
  /** Frozen at drop time (GDD 8 §3.2). Read as stored; never re-derived from tier and level. */
  readonly bonusPrimary: number;
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
    const slot = gear.equippedSlot;

    if (slot === null || !(slot in SLOT_STAT)) {
      continue;
    }

    const stat = SLOT_STAT[slot as keyof typeof SLOT_STAT];

    total[stat] += gear.bonusPrimary;
  }

  return total;
}
