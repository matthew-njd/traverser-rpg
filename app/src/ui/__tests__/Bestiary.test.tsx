import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EnemyLore } from '../../content/lore';
import { Bestiary } from '../Bestiary';

const enemy = (id: string, role: string, text: Partial<EnemyLore> = {}): EnemyLore => ({
  id,
  zoneId: 'olympion',
  typeId: 'storm',
  role,
  flavor: null,
  intro: [],
  defeatFirst: [],
  defeatRepeat: [],
  ...text,
});

const ROSTER = [
  enemy('enemy_harpy', 'wild', { flavor: 'The gust before the clouds.' }),
  enemy('enemy_satyr', 'wild', { flavor: 'It grins.' }),
  enemy('enemy_cyclops', 'mid_boss', { intro: ['A single eye.'], defeatFirst: ['The great shape falls.'] }),
];

const LABELS = new Map([
  ['olympion', 'Olympion'],
  ['storm', 'Storm'],
  ['enemy_harpy', 'Harpy'],
  ['enemy_satyr', 'Satyr'],
  ['enemy_cyclops', 'Cyclops'],
]);

const show = (met: [string, { encounterCount: number; defeatCount: number }][]) =>
  render(<Bestiary roster={ROSTER} met={new Map(met)} labels={LABELS} />);

describe('Bestiary', () => {
  it('hides an enemy not yet met', async () => {
    await show([['enemy_harpy', { encounterCount: 1, defeatCount: 1 }]]);

    expect(screen.getByText('Harpy')).toBeTruthy();
    expect(screen.queryByText('Satyr')).toBeNull();
    expect(screen.getAllByText('???')).toHaveLength(2);
  });

  it("reads a wild enemy's flavour line on tap", async () => {
    await show([['enemy_harpy', { encounterCount: 1, defeatCount: 0 }]]);

    await fireEvent.press(screen.getByText('Harpy'));

    expect(screen.getByText('The gust before the clouds.')).toBeTruthy();
  });

  it("adds a boss's first-kill text only once it has been beaten", async () => {
    await show([['enemy_cyclops', { encounterCount: 1, defeatCount: 0 }]]);
    await fireEvent.press(screen.getByText('Cyclops'));

    expect(screen.getByText('A single eye.')).toBeTruthy();
    expect(screen.queryByText('The great shape falls.')).toBeNull();

    await show([['enemy_cyclops', { encounterCount: 2, defeatCount: 1 }]]);
    await fireEvent.press(screen.getByText('Cyclops'));

    expect(screen.getByText('The great shape falls.')).toBeTruthy();
  });
});
