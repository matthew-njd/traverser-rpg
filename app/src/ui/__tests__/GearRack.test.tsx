import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OwnedGear } from '../../battle/mirror';
import { NO_STATS } from '../../sync/writes';
import { GearRack } from '../GearRack';

const piece = (id: string, slot: string, bonus: number, worn: boolean, extra: Partial<OwnedGear> = {}): OwnedGear => ({
  playerGearId: id,
  gearDefId: `gear_${slot}_${id}`,
  slot,
  tier: 'mortal',
  zoneId: null,
  equippedSlot: worn ? slot : null,
  bonusPrimary: bonus,
  bonusSecondary: null,
  ...extra,
});

const GEAR = [
  piece('blade', 'weapon', 1, true),
  piece('sword', 'weapon', 4, false),
  piece('sigil', 'trinket', 3, true, { tier: 'heroic', zoneId: 'olympion', bonusSecondary: 2 }),
  piece('ruse', 'trinket', 5, false, { tier: 'mythic', zoneId: 'olympion', bonusSecondary: 4 }),
];
const STATS = { ...NO_STATS, might: 11, favor: 13, aegis: 12 };
const labels = new Map([
  ['gear_weapon_blade', 'Blade'],
  ['gear_weapon_sword', 'Sword'],
  ['gear_trinket_sigil', 'Sigil'],
  ['gear_trinket_ruse', 'Ruse'],
  ['olympion', 'Olympion'],
]);

const rack = (fighting = false, onEquip = jest.fn()) =>
  render(<GearRack gear={GEAR} labels={labels} stats={STATS} fighting={fighting} onEquip={onEquip} />);

describe('the gear rack', () => {
  /** GDD 13 §5.1's fixed row, Trinket included, with the zone badge on a worn Trinket. */
  it('shows all four slots and what each wears', async () => {
    await rack();

    for (const slot of ['Weapon', 'Armour', 'Accessory', 'Trinket']) {
      expect(screen.getByText(slot)).toBeTruthy();
    }

    expect(screen.getAllByText('Empty')).toHaveLength(2);
    expect(screen.getByText('Olympion')).toBeTruthy();
  });

  /** P1's requirement: the stat change is visible before the tap commits it. */
  it('shows what a held piece would change the stat to', async () => {
    await rack();

    expect(screen.getByText('Might 11 → 14 (+3)')).toBeTruthy();
  });

  it('compares a Trinket on both of its stats', async () => {
    await rack();
    await fireEvent.press(screen.getByText('Trinket'));

    expect(screen.getByText('Favour 13 → 15 (+2)')).toBeTruthy();
    expect(screen.getByText('Aegis 12 → 14 (+2)')).toBeTruthy();
  });

  it('wears a held piece and takes off a worn one', async () => {
    const onEquip = jest.fn();

    await rack(false, onEquip);
    await fireEvent.press(screen.getByText('Wear'));
    await fireEvent.press(screen.getByText('Take off'));

    expect(onEquip.mock.calls).toEqual([
      ['sword', true],
      ['blade', false],
    ]);
  });

  /** Drills note 13's shape — the buttons, not only the note, must refuse. Viewing stays open. */
  it('refuses while a battle is open, and says why', async () => {
    await rack(true);

    for (const button of screen.getAllByRole('button')) {
      expect(button.props.accessibilityState.disabled).toBe(true);
    }

    expect(screen.getByText(/A fight is still open/)).toBeTruthy();
  });
});
