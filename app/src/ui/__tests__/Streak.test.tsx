import { render, screen } from '@testing-library/react-native';

import { Streak } from '../Streak';

/** GDD 11 §4 — a break is one quiet line. Nothing here may scold. */
describe('the streak badge', () => {
  it('shows the run and the personal best', async () => {
    await render(<Streak current={9} longest={22} />);

    expect(screen.getByText('🔥 9')).toBeTruthy();
    expect(screen.getByText('Best 22')).toBeTruthy();
    expect(screen.queryByText(/new road/)).toBeNull();
  });

  it.each`
    current | longest
    ${0}    | ${5}
    ${1}    | ${5}
  `('says only "A new road begins today." after a break ($current of $longest)', async ({ current, longest }) => {
    await render(<Streak current={current as number} longest={longest as number} />);

    expect(screen.getByText('A new road begins today.')).toBeTruthy();
    expect(screen.queryByText(/lost|broke|missed/i)).toBeNull();
  });

  /** A new player has broken nothing, so there is nothing to begin again. */
  it('says nothing on a first day', async () => {
    await render(<Streak current={0} longest={0} />);

    expect(screen.queryByText(/new road/)).toBeNull();
  });
});
