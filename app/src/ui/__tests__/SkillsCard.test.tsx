import { fireEvent, render, screen } from '@testing-library/react-native';

import type { LimitedMove } from '../../battle/session';
import { SkillsCard } from '../SkillsCard';

const move = (id: string, typeId: string | null = 'war'): LimitedMove => ({
  id,
  category: typeId === null ? 'physical' : 'divine',
  typeId,
  power: 65,
  uses: 4,
});

/** Unlock order, with the Trinket move last — the order `loadoutFor` gives. */
const AVAILABLE = [move('a', null), move('b'), move('c'), move('d'), move('ruse', 'trickery')];
const EQUIPPED = AVAILABLE.slice(0, 4);
const labels = new Map([
  ['a', 'Iron Advance'],
  ['b', 'Thunderer'],
  ['c', 'Warlord'],
  ['d', 'Shadowstep'],
  ['ruse', "Gatekeeper's Ruse"],
  ['war', 'War'],
  ['trickery', 'Trickery'],
]);

const card = ({ available = AVAILABLE, fighting = false, onSet = jest.fn() } = {}) =>
  render(
    <SkillsCard
      available={available}
      equipped={available.slice(0, 4)}
      labels={labels}
      fighting={fighting}
      onSet={onSet}
    />,
  );

const row = (name: string) => screen.getByRole('checkbox', { name });
const save = () => screen.getByRole('button', { name: 'Save' });

describe('the skills card', () => {
  it('marks the equipped four, in words as well as colour', async () => {
    await card();

    expect(row('Thunderer').props.accessibilityState.checked).toBe(true);
    expect(row("Gatekeeper's Ruse").props.accessibilityState.checked).toBe(false);
    expect(screen.getAllByText('Equipped')).toHaveLength(4);
  });

  /** A fifth pick would mean a fifth slot, and GDD 3 §4.1 has no bonus slots. */
  it('refuses a fifth pick until one is deselected', async () => {
    await card();

    expect(row("Gatekeeper's Ruse").props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(row('Thunderer'));

    expect(row("Gatekeeper's Ruse").props.accessibilityState.disabled).toBe(false);
  });

  /**
   * The mutation this guards: saving in tap order. Ruse is tapped last but is last in unlock order
   * anyway, so Thunderer's slot is what moves — Warlord and Shadowstep must not shift with it.
   */
  it('saves the new four in unlock order, not tap order', async () => {
    const onSet = jest.fn();

    await card({ onSet });
    await fireEvent.press(row('Iron Advance'));
    await fireEvent.press(row("Gatekeeper's Ruse"));
    await fireEvent.press(save());

    expect(onSet).toHaveBeenCalledWith(['b', 'c', 'd', 'ruse']);
  });

  /** Saving three would let the fill take the empty slot (`loadoutFor`). */
  it('will not save until four are chosen, or with nothing changed', async () => {
    await card();

    expect(save().props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(row('Thunderer'));

    expect(save().props.accessibilityState.disabled).toBe(true);
  });

  /** Found on the device at Level 21: four moves, nothing to choose between, and taps that did nothing. */
  it('offers no choice when every move is already equipped', async () => {
    await card({ available: EQUIPPED });

    expect(row('Thunderer').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByText(/Every move you have is equipped/)).toBeTruthy();
  });

  /** The fight froze its moves when it opened (`startEncounter`). */
  it('refuses while a battle is open, and says why', async () => {
    await card({ fighting: true });

    expect(row('Thunderer').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/A fight is still open/)).toBeTruthy();
  });
});
