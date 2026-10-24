import { fireEvent, render, screen } from '@testing-library/react-native';

import type { OwnedGear } from '../../battle/mirror';
import { NO_STATS } from '../../sync/writes';
import { GearRack } from '../GearRack';

const piece = (id: string, slot: string, bonus: number, worn: boolean): OwnedGear => ({
  playerGearId: id,
  gearDefId: `gear_${slot}_${id}`,
  slot,
  equippedSlot: worn ? slot : null,
  bonusPrimary: bonus,
});

const GEAR = [piece('blade', 'weapon', 1, true), piece('sword', 'weapon', 4, false)];
const STATS = { ...NO_STATS, might: 11 };
const labels = new Map([
  ['gear_weapon_blade', 'Blade'],
  ['gear_weapon_sword', 'Sword'],
]);

describe('the gear rack', () => {
  /** P1's requirement: the stat change is visible before the tap commits it. */
  it('shows what an unworn piece would change the stat to', async () => {
    await render(<GearRack gear={GEAR} labels={labels} stats={STATS} fighting={false} onEquip={() => {}} />);

    expect(screen.getByText(/Might 11 → 14/)).toBeTruthy();
  });

  it('wears an unworn piece and takes off a worn one', async () => {
    const onEquip = jest.fn();

    await render(<GearRack gear={GEAR} labels={labels} stats={STATS} fighting={false} onEquip={onEquip} />);

    await fireEvent.press(screen.getByText('Wear'));
    await fireEvent.press(screen.getByText('Take off'));

    expect(onEquip.mock.calls).toEqual([
      ['sword', true],
      ['blade', false],
    ]);
  });

  /** Drills note 13's shape — the buttons, not only the note, must refuse. */
  it('refuses while a battle is open, and says why', async () => {
    await render(<GearRack gear={GEAR} labels={labels} stats={STATS} fighting onEquip={() => {}} />);

    for (const button of screen.getAllByRole('button')) {
      expect(button.props.accessibilityState.disabled).toBe(true);
    }

    expect(screen.getByText(/A fight is still open/)).toBeTruthy();
  });
});
