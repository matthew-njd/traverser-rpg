import type { Drops } from '../../../battle/loot';
import type { RevealDetail } from '../../../content/labels';
import { revealsFor } from '../reveal';

/** GDD 13 §6.3 — what a won battle announces, joined to content before anything renders. */
const LABELS = new Map([
  ['item_stormveil', 'Stormveil'],
  ['gear_weapon_mortal', "Traveller's Blade"],
  ['gear_skyroad_sigil', 'Skyroad Sigil'],
]);

const DETAILS = new Map<string, RevealDetail>([
  ['item_stormveil', { grade: 'uncommon', flavor: 'Bottled weather.' }],
  ['gear_weapon_mortal', { grade: 'mortal', flavor: null }],
  ['gear_skyroad_sigil', { grade: 'heroic', flavor: 'A fragment of the road.' }],
]);

const gear = (defId: string) => ({
  defId,
  levelAtDrop: 15,
  bonusPrimary: 2,
  bonusSecondary: null,
});

const drops = (overrides: Partial<Drops> = {}): Drops => ({
  items: [],
  gear: [],
  trinket: null,
  ...overrides,
});

describe('revealsFor', () => {
  it('announces items, gear and the Trinket, in that order', () => {
    const reveals = revealsFor(
      drops({
        items: ['item_stormveil'],
        gear: [gear('gear_weapon_mortal')],
        trinket: { ...gear('gear_skyroad_sigil'), bonusSecondary: 2 },
      }),
      LABELS,
      DETAILS,
    );

    expect(reveals.map((reveal) => reveal.defId)).toEqual([
      'item_stormveil',
      'gear_weapon_mortal',
      'gear_skyroad_sigil',
    ]);
    expect(reveals[0]).toEqual({
      defId: 'item_stormveil',
      name: 'Stormveil',
      grade: 'uncommon',
      flavor: 'Bottled weather.',
    });
  });

  /**
   * The M2 lesson, applied to the screen: a reveal announcing something the player cannot be shown
   * is worse than announcing nothing. A key with no content row produces no card at all.
   */
  it('shows no card for a drop the content cannot describe', () => {
    expect(revealsFor(drops({ items: ['item_does_not_exist'] }), LABELS, DETAILS)).toEqual([]);
  });

  it('carries a null flavour rather than inventing one', () => {
    expect(revealsFor(drops({ gear: [gear('gear_weapon_mortal')] }), LABELS, DETAILS)[0]?.flavor)
      .toBeNull();
  });

  it('announces nothing for a battle that dropped nothing', () => {
    expect(revealsFor(null, LABELS, DETAILS)).toEqual([]);
    expect(revealsFor(drops(), LABELS, DETAILS)).toEqual([]);
  });
});
