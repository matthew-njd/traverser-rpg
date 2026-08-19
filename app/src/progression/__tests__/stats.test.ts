import type { MirrorPlayer } from '../../sync/mirror';
import { BASE_STATS, type EquippedBonus, effectiveStats } from '../stats';

/**
 * GDD 1 §5's baseline, plus allocation, plus equipped gear (GDD 8 §2).
 *
 * The stat block is what every damage number in the game reads from, so the cases that matter are
 * the ones where a term could be silently dropped or applied to the wrong stat.
 */
const PLAYER = {
  allocVigor: 0,
  allocMight: 0,
  allocResolve: 0,
  allocFavor: 0,
  allocAegis: 0,
  allocStride: 0,
} as unknown as MirrorPlayer;

const gear = (equippedSlot: string | null, bonusPrimary: number): EquippedBonus => ({
  equippedSlot,
  bonusPrimary,
});

describe('effectiveStats', () => {
  it('is the Level 1 baseline with nothing spent and nothing worn', () => {
    expect(effectiveStats(PLAYER)).toEqual(BASE_STATS);
  });

  it('adds allocation to the baseline', () => {
    const spent = { ...PLAYER, allocMight: 5, allocFavor: 3 } as MirrorPlayer;

    expect(effectiveStats(spent)).toMatchObject({ might: 15, favor: 13, resolve: 10 });
  });

  /** GDD 8 §2: Weapon → Might, Armor → Resolve, Accessory → Vigor. */
  it('routes each equipped slot to the stat it raises', () => {
    expect(effectiveStats(PLAYER, [gear('weapon', 2)]).might).toBe(12);
    expect(effectiveStats(PLAYER, [gear('armor', 2)]).resolve).toBe(12);
    expect(effectiveStats(PLAYER, [gear('accessory', 2)]).vigor).toBe(22);
  });

  /**
   * ↯ **Stride never receives a gear bonus** (GDD 1 §5, CLAUDE.md). Enforced by the slot table
   * having no entry rather than by a check, so this asserts the absence: a piece claiming the
   * `stride` slot contributes nothing rather than raising it.
   */
  it('gives Stride nothing, whatever a piece claims', () => {
    expect(effectiveStats(PLAYER, [gear('stride', 9)]).stride).toBe(BASE_STATS.stride);
    expect(effectiveStats(PLAYER, [gear('trinket', 9)]).stride).toBe(BASE_STATS.stride);
  });

  /** Owning is not wearing. Only the equipped slot is read, so an unequipped row is inert. */
  it('ignores gear that is owned but not equipped', () => {
    expect(effectiveStats(PLAYER, [gear(null, 9)])).toEqual(BASE_STATS);
  });

  /**
   * GDD 10 §5.2 → §6.3: the Traveler's Blade takes a Level 1 Traverser to **Might 11**, which is the
   * attacker stat every damage value in the tutorial table is computed from.
   */
  it('puts the starting Traverser at Might 11 with the Blade equipped', () => {
    expect(effectiveStats(PLAYER, [gear('weapon', 1)]).might).toBe(11);
  });

  it('stacks allocation and gear rather than choosing between them', () => {
    const spent = { ...PLAYER, allocMight: 4 } as MirrorPlayer;

    expect(effectiveStats(spent, [gear('weapon', 3)]).might).toBe(17);
  });

  /**
   * The Trinket splits its bonus across Favor and Aegis and is M3's. Until then it contributes
   * nothing rather than being mapped to one of the two, which would be wrong by half.
   */
  it('contributes nothing for a Trinket, which M2 does not implement', () => {
    expect(effectiveStats(PLAYER, [gear('trinket', 5)])).toEqual(BASE_STATS);
  });
});
