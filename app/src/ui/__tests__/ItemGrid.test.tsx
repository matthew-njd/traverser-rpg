import { fireEvent, render, screen } from '@testing-library/react-native';

import { ItemGrid } from '../ItemGrid';

const items = [
  { playerItemId: 'pi-1', itemDefId: 'item_travelers_salve' },
  { playerItemId: 'pi-2', itemDefId: 'item_travelers_salve' },
  { playerItemId: 'pi-3', itemDefId: 'item_warhex' },
];
const kinds = new Map([
  ['item_travelers_salve', { category: 'heal', battleOnly: false, healPct: 20 }],
  ['item_warhex', { category: 'breach', battleOnly: true, healPct: null }],
]);
const labels = new Map([
  ['item_travelers_salve', "Traveller's Salve"],
  ['item_warhex', 'Warhex'],
]);

const grid = ({ current = 10, fighting = false, onUse = jest.fn() } = {}) =>
  render(
    <ItemGrid
      items={items}
      kinds={kinds}
      labels={labels}
      vigor={{ current, max: 20 }}
      fighting={fighting}
      onUse={onUse}
    />,
  );

const useButton = () => screen.getByRole('button', { name: 'Use' });

describe('the item grid', () => {
  /** GDD 4 §5.1 — one tile per held item, never stacked, out of 20. */
  it('shows every held item as its own tile', async () => {
    await grid();

    expect(screen.getAllByLabelText("Traveller's Salve")).toHaveLength(2);
    expect(screen.getByText('3 / 20 · Vigour 10 / 20')).toBeTruthy();
  });

  /** GDD 4 §4 — Charms and Buffs lock outside a fight; healing items do not. */
  it('locks a battle-only item and says why', async () => {
    await grid();

    expect(screen.getAllByText('🔒')).toHaveLength(1);

    await fireEvent.press(screen.getByLabelText('Warhex'));

    expect(screen.getByText(/Requires an active battle/)).toBeTruthy();
  });

  /** GDD 4 §4 — a heal can be used between fights. */
  it('uses a picked healing item', async () => {
    const onUse = jest.fn();

    await grid({ onUse });
    await fireEvent.press(screen.getAllByLabelText("Traveller's Salve")[0]!);
    await fireEvent.press(useButton());

    expect(onUse).toHaveBeenCalledWith('pi-1');
  });

  it.each([
    ['Vigour is full', { current: 20 }, /Your Vigour is full/],
    ['a fight is open', { fighting: true }, /A fight is still open/],
  ])('will not heal when %s, and says why', async (_, props, reason) => {
    await grid(props);
    await fireEvent.press(screen.getAllByLabelText("Traveller's Salve")[0]!);

    expect(useButton().props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(reason)).toBeTruthy();
  });

  it('offers no Use on a battle-only item', async () => {
    await grid();
    await fireEvent.press(screen.getByLabelText('Warhex'));

    expect(screen.queryByRole('button', { name: 'Use' })).toBeNull();
  });

  /** GDD 13 §5.2 — the road find is named and its tile marked while Items stays open. */
  it('names the road finds', async () => {
    await render(
      <ItemGrid
        items={items}
        kinds={kinds}
        labels={labels}
        vigor={{ current: 10, max: 20 }}
        found={new Set(['pi-3'])}
        fighting={false}
        onUse={jest.fn()}
      />,
    );

    expect(screen.getByText(/Found along the road: Warhex/)).toBeTruthy();
  });

  it('filters by category', async () => {
    await grid();
    await fireEvent.press(screen.getByText('Charms'));

    expect(screen.queryByLabelText("Traveller's Salve")).toBeNull();
    expect(screen.getByLabelText('Warhex')).toBeTruthy();
  });
});
