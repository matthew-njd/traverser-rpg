import { render, screen } from '@testing-library/react-native';

import type { OwnedGear } from '../../battle/mirror';
import { TraverserSprite, availableFigures, figureKey } from '../TraverserSprite';

// Pinned, so these tests outlive the female figure's art landing.
jest.mock('../../assets/registry.generated', () => ({
  ...jest.requireActual('../../assets/registry.generated'),
  PLACEHOLDER_SPRITES: new Set(['avatar_traverser_female']),
}));

const worn = (gearDefId: string, slot: string, tier: string): OwnedGear => ({
  playerGearId: gearDefId,
  gearDefId,
  slot,
  tier,
  zoneId: null,
  equippedSlot: slot,
  bonusPrimary: 1,
  bonusSecondary: null,
});

const labels = new Map([
  ['gear_weapon_mortal', "Traveller's Blade"],
  ['gear_gatekeepers_ruse', "Gatekeeper's Ruse"],
]);

describe('the Avatar plate', () => {
  /** GDD 13 §3.1, amended 2026-10-29 — a worn piece fills its corner; an empty one names itself. */
  it('names the empty slots and says what is worn', async () => {
    await render(
      <TraverserSprite
        figure="male"
        worn={[worn('gear_weapon_mortal', 'weapon', 'mortal'), worn('gear_gatekeepers_ruse', 'trinket', 'mythic')]}
        labels={labels}
      />,
    );

    expect(screen.getByText('Armour')).toBeTruthy();
    expect(screen.getByText('Accessory')).toBeTruthy();
    expect(screen.queryByText('Weapon')).toBeNull();
    expect(screen.queryByText('Trinket')).toBeNull();
    expect(screen.getByLabelText("Your Traverser, wearing Traveller's Blade, Gatekeeper's Ruse")).toBeTruthy();
  });

  it('says so when nothing is worn', async () => {
    await render(<TraverserSprite figure="male" worn={[]} labels={labels} />);

    expect(screen.getByLabelText('Your Traverser, wearing nothing yet')).toBeTruthy();
  });
});

describe('the figure choice', () => {
  /** A choice saved before its art landed must still draw a figure, never a placeholder. */
  it('falls back to the male figure while a figure has no art', () => {
    expect(figureKey('female')).toBe('avatar_traverser_male');
    expect(figureKey('male')).toBe('avatar_traverser_male');
  });

  it('offers only the figures whose art has landed', () => {
    expect(availableFigures()).toEqual(['male']);
  });
});
