import { fireEvent, render, screen } from '@testing-library/react-native';

import { NO_STATS, type StatDeltas } from '../../sync/writes';
import { StatPanel, nextDraft } from '../StatPanel';

/**
 * ↯ tech-04 §12 reserves RNTL for components with **real logic**, never for layout. This one
 * qualifies: the draft is L4 ephemeral state (§5.4), it must not be able to overspend, and what it
 * hands to Confirm is exactly what gets written to the mirror and queued for the server.
 *
 * ↯ **`render` and `fireEvent` are `await`ed.** React Native Testing Library v14 made both async;
 * every example written against v12/v13 calls them synchronously, and the failure mode is silent —
 * `render` returns a promise, the tree never mounts, and every query throws "`render` function has
 * not been called", which reads like a setup problem rather than a missing `await`.
 */
const CURRENT: StatDeltas = { vigor: 20, might: 10, resolve: 10, favor: 10, aegis: 10, stride: 10 };

const add = async (stat: string, times = 1) => {
  for (let i = 0; i < times; i += 1) {
    await fireEvent.press(screen.getByLabelText(`Add a point to ${stat}`));
  }
};

/**
 * ↯ The budget rule, tested without a renderer. The `+` button's `disabled` prop is what the player
 * meets, but it is computed from the render that dispatched the press — so two presses in one React
 * batch would both see it enabled. The rule therefore lives in the state updater, checked against
 * the draft it is updating from, and that is what these cases pin.
 */
describe('nextDraft', () => {
  it('adds a point while the budget allows', () => {
    expect(nextDraft(NO_STATS, 'might', 1, 3)).toEqual({ ...NO_STATS, might: 1 });
  });

  it('refuses to spend past the budget, however many presses arrive', () => {
    const spent = { ...NO_STATS, might: 2 };

    expect(nextDraft(spent, 'might', 1, 2)).toBe(spent);
    expect(nextDraft(spent, 'vigor', 1, 2)).toBe(spent);
  });

  it('never takes a stat below zero', () => {
    expect(nextDraft(NO_STATS, 'might', -1, 3)).toBe(NO_STATS);
  });

  it('always allows giving a point back, even at the budget', () => {
    expect(nextDraft({ ...NO_STATS, might: 2 }, 'might', -1, 2)).toEqual({ ...NO_STATS, might: 1 });
  });
});

describe('StatPanel', () => {
  it('reports the points left as the draft is built', async () => {
    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={jest.fn()} />);

    expect(screen.getByText('3 points to spend')).toBeTruthy();

    await add('Might');

    expect(screen.getByText('2 points to spend')).toBeTruthy();
  });

  /**
   * ↯ The draft cannot overspend. The server validates too, but a UI that lets the player build an
   * invalid allocation and only then rejects it has already wasted their decision.
   */
  it('will not spend more points than are unspent', async () => {
    const onConfirm = jest.fn();

    await render(<StatPanel unspent={2} current={CURRENT} onConfirm={onConfirm} />);

    await add('Might', 5);
    await fireEvent.press(screen.getByText('Confirm 2 points'));

    expect(onConfirm).toHaveBeenCalledWith({ ...NO_STATS, might: 2 });
  });

  it('hands Confirm exactly the draft, spread across stats', async () => {
    const onConfirm = jest.fn();

    await render(<StatPanel unspent={6} current={CURRENT} onConfirm={onConfirm} />);

    await add('Vigor', 2);
    await add('Stride');
    await fireEvent.press(screen.getByText('Confirm 3 points'));

    expect(onConfirm).toHaveBeenCalledWith({ ...NO_STATS, vigor: 2, stride: 1 });
  });

  it('cannot take a stat below zero in the draft', async () => {
    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={jest.fn()} />);

    expect(screen.getByLabelText('Remove a point from Might').props.accessibilityState.disabled).toBe(
      true,
    );

    await add('Might');

    expect(screen.getByLabelText('Remove a point from Might').props.accessibilityState.disabled).toBe(
      false,
    );
  });

  it('clears the draft after confirming, so a second confirm cannot double-spend', async () => {
    const onConfirm = jest.fn();

    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={onConfirm} />);

    await add('Might');
    await fireEvent.press(screen.getByText('Confirm 1 point'));

    expect(screen.queryByText('Confirm 1 point')).toBeNull();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('resets a draft without spending anything', async () => {
    const onConfirm = jest.fn();

    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={onConfirm} />);

    await add('Might', 2);
    await fireEvent.press(screen.getByText('Reset'));

    expect(screen.queryByText('Reset')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** ↯ Permanent on confirm — the locked GDD names no respec mechanic, so this is not decoration. */
  it('says allocation is permanent before it can be confirmed', async () => {
    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={jest.fn()} />);

    await add('Might');

    expect(screen.getByText('Allocation is permanent.')).toBeTruthy();
  });

  it('offers no steppers at all when there is nothing to spend', async () => {
    await render(<StatPanel unspent={0} current={CURRENT} onConfirm={jest.fn()} />);

    expect(screen.getByText('No points to spend')).toBeTruthy();
    expect(screen.queryByLabelText('Add a point to Might')).toBeNull();
  });

  it('shows the current value and the pending addition separately', async () => {
    await render(<StatPanel unspent={3} current={CURRENT} onConfirm={jest.fn()} />);

    await add('Vigor', 2);

    // The value and the pending addition are separate Text nodes inside one line, which RNTL
    // matches as the composed string.
    expect(screen.getByText('20 +2')).toBeTruthy();
  });
});
