import { fireEvent, render, screen } from '@testing-library/react-native';

import { Streak } from '../Streak';

/** GDD 11 §4 — a break is one quiet line. Nothing here may scold. */
describe('the streak badge', () => {
  it('shows the run and the personal best', async () => {
    await render(<Streak current={9} longest={22} next={null} />);

    expect(screen.getByLabelText('9 day streak')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('Best 22')).toBeTruthy();
    expect(screen.queryByText(/new road/)).toBeNull();
  });

  it.each`
    current | longest
    ${0}    | ${5}
    ${1}    | ${5}
  `('says only "A new road begins today." after a break ($current of $longest)', async ({ current, longest }) => {
    await render(<Streak current={current as number} longest={longest as number} next={null} />);

    expect(screen.getByText('A new road begins today.')).toBeTruthy();
    expect(screen.queryByText(/lost|broke|missed/i)).toBeNull();
  });

  /** A new player has broken nothing, so there is nothing to begin again. */
  it('says nothing on a first day', async () => {
    await render(<Streak current={0} longest={0} next={null} />);

    expect(screen.queryByText(/new road/)).toBeNull();
  });

  /** GDD 13 §3.1 — the badge opens the next rung and how far it is. */
  it('opens the next milestone on a tap', async () => {
    await render(<Streak current={9} longest={9} next={{ day: 14, slot: 'weapon', tier: 'heroic' }} />);

    expect(screen.queryByText(/Day 14/)).toBeNull();

    await fireEvent.press(screen.getByLabelText('9 day streak'));

    expect(screen.getByText('Day 14 · Heroic Weapon')).toBeTruthy();
    expect(screen.getByText('5 days to go')).toBeTruthy();
  });

  /** GDD 11 §5.4 — nothing past Day 120, and the copy does not pretend otherwise. */
  it('says the ladder is climbed when no rung is left', async () => {
    await render(<Streak current={130} longest={130} next={null} />);
    await fireEvent.press(screen.getByLabelText('130 day streak'));

    expect(screen.getByText(/Every streak reward is yours/)).toBeTruthy();
  });
});
