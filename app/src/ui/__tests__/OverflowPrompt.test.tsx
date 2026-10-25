import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Overflow } from '../../progression/overflow';
import { OverflowPrompt } from '../OverflowPrompt';

const labels = new Map([
  ['item_stormveil', 'Stormveil'],
  ['item_travelers_salve', "Traveller's Salve"],
  ['item_ambrosia_shard', 'Ambrosia Shard'],
]);

const DROP: Overflow = {
  kind: 'item',
  incoming: { id: 'new', defId: 'item_stormveil' },
  pendingId: null,
  room: false,
  others: [
    { id: 'a', defId: 'item_ambrosia_shard', suggested: false },
    { id: 's', defId: 'item_travelers_salve', suggested: true },
  ],
};

describe('the overflow prompt', () => {
  it('starts on the suggestion and leaves it behind', async () => {
    const onLeave = jest.fn();

    await render(<OverflowPrompt overflow={DROP} labels={labels} onLeave={onLeave} onKeep={jest.fn()} />);
    await fireEvent.press(screen.getByText('Leave behind'));

    expect(onLeave).toHaveBeenCalledWith({ incoming: false, id: 's' });
  });

  it('can let the new item go instead', async () => {
    const onLeave = jest.fn();

    await render(<OverflowPrompt overflow={DROP} labels={labels} onLeave={onLeave} onKeep={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Stormveil'));
    await fireEvent.press(screen.getByText('Leave behind'));

    expect(onLeave).toHaveBeenCalledWith({ incoming: true });
  });

  it('offers Keep only for a parked reward that now fits', async () => {
    await render(
      <OverflowPrompt overflow={{ ...DROP, pendingId: 'r1', room: true }} labels={labels} onLeave={jest.fn()} onKeep={jest.fn()} />,
    );

    expect(screen.getByText('Keep Stormveil')).toBeTruthy();
  });
});
