import { parseBundle } from '../../content/bundle';
import { EMBEDDED_BUNDLE } from '../../content/embedded.generated';
import { type DropEncounterKind, dropTablesFrom, gearBonus, rollDrops } from '../loot';
import { scriptedRng } from '../rng';

/**
 * The victory roll, resolved to a piece (T5 §10.1, amended 2026-08-22) and priced at the level it
 * dropped at (GDD 8 §3.2).
 *
 * Built from the **embedded bundle**, not from a hand-written table: the M2 defect this packet
 * closes was a fixture and a parser agreeing with each other while both disagreed with the seed
 * (DECISIONS 2026-08-20). A tier the seed cannot resolve has to fail here.
 */
const TABLES = parseBundle(EMBEDDED_BUNDLE).tables;
const DROPS = dropTablesFrom((table) => TABLES[table]);

const roll = (encounterKind: DropEncounterKind, draws: readonly number[], level = 15) =>
  rollDrops({
    encounterKind,
    tables: DROPS,
    pool: [],
    level,
    zoneId: 'olympion',
    rng: scriptedRng(draws),
  });

describe('gear bonus values (fixtures §5)', () => {
  const bonusAt = (tier: string, level: number, slot = 'weapon') => {
    const tierBonus = DROPS.tierBonuses.get(tier);

    if (tierBonus === undefined) {
      throw new Error(`the bundle has no gear_tier_bonus row for ${tier}`);
    }

    return gearBonus(tierBonus, level, slot);
  };

  /**
   * ↯ Three of these cells only come out under **round-half-to-even**, and `Math.round` gets each
   * of them wrong by one: Mortal L10 (`0.5`), Divine L10 (`2.5`) and Divine L42 (`10.5`). This
   * table is the reason the arithmetic is integer.
   */
  it.each`
    level | mortal | heroic | mythic | divine
    ${1}  | ${1}   | ${2}   | ${3}   | ${4}
    ${10} | ${1}   | ${3}   | ${5}   | ${6}
    ${15} | ${2}   | ${4}   | ${6}   | ${8}
    ${22} | ${2}   | ${4}   | ${7}   | ${10}
    ${30} | ${3}   | ${5}   | ${8}   | ${12}
    ${42} | ${3}   | ${6}   | ${10}  | ${14}
    ${52} | ${4}   | ${7}   | ${12}  | ${17}
    ${60} | ${4}   | ${8}   | ${13}  | ${19}
  `(
    'prices every tier at L$level',
    ({ level, mortal, heroic, mythic, divine }: Record<string, number>) => {
      expect(bonusAt('mortal', level as number).primary).toBe(mortal);
      expect(bonusAt('heroic', level as number).primary).toBe(heroic);
      expect(bonusAt('mythic', level as number).primary).toBe(mythic);
      expect(bonusAt('divine', level as number).primary).toBe(divine);
    },
  );

  /** fixtures §5's audited case: Divine at L60 → 19 → 11 Favor **and** 11 Aegis, not 19 split. */
  it('splits a Trinket across Favor and Aegis, each at 0.6 of the tier value', () => {
    expect(bonusAt('divine', 60, 'trinket')).toEqual({ primary: 11, secondary: 11 });
    expect(bonusAt('heroic', 10, 'trinket')).toEqual({ primary: 2, secondary: 2 });
    expect(bonusAt('mythic', 52, 'trinket')).toEqual({ primary: 7, secondary: 7 });
  });

  it('gives a Weapon, Armor or Accessory no second stat at all', () => {
    expect(bonusAt('divine', 60).secondary).toBeNull();
  });
});

/**
 * The property the M2 defect violated. Any tier any `drop_rate` row can name must resolve to a
 * piece the seed actually has — for gear in no zone, and for a Trinket in every zone that has one.
 */
describe('every tier the roller can produce resolves to a seeded piece', () => {
  const zoneIds = [...new Set(DROPS.gear.map((piece) => piece.zoneId))].filter(
    (zoneId): zoneId is string => zoneId !== null,
  );

  it.each(DROPS.rates.filter((rate) => rate.tier !== null))(
    '$encounterKind/$rewardKind at tier $tier',
    ({ rewardKind, tier }) => {
      expect(DROPS.tierBonuses.has(tier as string)).toBe(true);

      if (rewardKind === 'gear') {
        const slots = DROPS.gear
          .filter((piece) => piece.tier === tier && piece.slot !== 'trinket')
          .map((piece) => piece.slot)
          .sort();

        // GDD 8 §5.1 draws across all three, so all three must exist at every droppable tier.
        expect(slots).toEqual(['accessory', 'armor', 'weapon']);

        return;
      }

      for (const zoneId of zoneIds) {
        expect(
          DROPS.gear.filter(
            (piece) => piece.slot === 'trinket' && piece.tier === tier && piece.zoneId === zoneId,
          ),
        ).toHaveLength(1);
      }
    },
  );
});

describe('resolving a rolled drop', () => {
  /** Draws: item die (misses), gear die (hits), slot draw. GDD 8 §5.1 — wild drops Mortal. */
  it('sends a piece and its frozen bonus, never the tier', () => {
    const drops = roll('wild', [0.99, 0.1, 0.0]);

    expect(drops.gear).toEqual([
      { defId: 'gear_weapon_mortal', levelAtDrop: 15, bonusPrimary: 2, bonusSecondary: null },
    ]);
  });

  /** Equal weight across three slots, scanned in the GDD's order. One draw, three thirds. */
  it.each`
    draw    | defId
    ${0.0}  | ${'gear_weapon_mortal'}
    ${0.34} | ${'gear_armor_mortal'}
    ${0.67} | ${'gear_accessory_mortal'}
  `('maps a slot draw of $draw to $defId', ({ draw, defId }) => {
    expect(roll('wild', [0.99, 0.1, draw as number]).gear[0]?.defId).toBe(defId);
  });

  /**
   * A Trinket takes **no draw**: one row exists per zone and tier, so the zone and the tier name it
   * (GDD 8 §5.2). The scripted queue is asserted drained, which is what proves the draw count.
   */
  it('resolves a Trinket from the zone with no draw of its own', () => {
    const rng = scriptedRng([0.99, 0.99, 0.5]);

    const drops = rollDrops({
      encounterKind: 'mini_boss',
      tables: DROPS,
      pool: [],
      level: 10,
      zoneId: 'olympion',
      rng,
    });

    expect(drops.trinket).toEqual({
      defId: 'gear_skyroad_sigil',
      levelAtDrop: 10,
      bonusPrimary: 2,
      bonusSecondary: 2,
    });
    expect(drops.gear).toEqual([]);

    rng.assertDrained();
  });

  /** The Wisp belongs to no zone, so a Trinket has nothing to resolve against and none is sent. */
  it('grants no Trinket when the enemy has no zone', () => {
    const drops = rollDrops({
      encounterKind: 'mini_boss',
      tables: DROPS,
      pool: [],
      level: 10,
      zoneId: null,
      rng: scriptedRng([0.99, 0.99, 0.5]),
    });

    expect(drops.trinket).toBeNull();
  });
});
