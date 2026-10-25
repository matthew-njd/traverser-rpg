import { fireEvent, render, screen } from '@testing-library/react-native';

import { RewardReveal } from '../RewardReveal';

const labels = new Map([['gear_weapon_heroic', 'Heroic Blade']]);
const details = new Map([['gear_weapon_heroic', { grade: 'heroic', flavor: null }]]);
const REWARD = { id: 'g1', kind: 'gear' as const, defId: 'gear_weapon_heroic', source: 'level_milestone' };

describe('the reward reveal', () => {
  it('shows each reward with why it arrived, and closes on Continue', async () => {
    const onDone = jest.fn();

    await render(<RewardReveal rewards={[REWARD]} labels={labels} details={details} onDone={onDone} />);

    expect(screen.getByText('Heroic Blade')).toBeTruthy();
    expect(screen.getByText('Level milestone')).toBeTruthy();

    await fireEvent.press(screen.getByText('Continue'));

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  /** GDD 13 §6.3 — a level-up and the milestone it paid arrive together, so they show together. */
  it('shows a level-up above the rewards', async () => {
    await render(
      <RewardReveal
        levelUps={[{ level: 15, statPointsAwarded: 3 }]}
        rewards={[REWARD]}
        labels={labels}
        details={details}
        onDone={jest.fn()}
      />,
    );

    expect(screen.getByText('Level 15')).toBeTruthy();
    expect(screen.getByText('3 stat points to spend')).toBeTruthy();
    expect(screen.getByText('Heroic Blade')).toBeTruthy();
  });

  it('shows nothing when there is nothing to reveal', async () => {
    await render(<RewardReveal rewards={[]} labels={labels} details={details} onDone={jest.fn()} />);

    expect(screen.queryByText('Continue')).toBeNull();
  });
});
