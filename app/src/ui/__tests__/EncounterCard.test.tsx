import { fireEvent, render, screen } from '@testing-library/react-native';

import type { PendingEncounter } from '../../progression/road';
import { EncounterCard } from '../EncounterCard';

const waiting = (count: number): PendingEncounter[] =>
  Array.from({ length: count }, (_, index) => ({
    grantId: `g-${index}`,
    zoneId: 'olympion',
    source: 'travel',
    enemyId: index === 0 ? 'enemy_harpy' : 'enemy_satyr',
    displayName: index === 0 ? 'Harpy' : `Satyr ${index}`,
  }));

describe('EncounterCard', () => {
  /** DECISIONS 2026-10-24: nine waiting pushed every Explore button off the screen. */
  it('stays one row however many wait', async () => {
    await render(<EncounterCard encounters={waiting(9)} onFace={jest.fn()} />);

    expect(screen.getByText('1 of 9 waiting on the road')).toBeTruthy();
    expect(screen.queryByText('Satyr 1')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('names the next enemy and battles it', async () => {
    const onFace = jest.fn();

    await render(<EncounterCard encounters={waiting(3)} onFace={onFace} />);
    await fireEvent.press(screen.getByText('Harpy'));

    expect(onFace.mock.calls[0]?.[0]).toMatchObject({ grantId: 'g-0' });
  });

  it('opens the full list on request, and any one can be faced', async () => {
    const onFace = jest.fn();

    await render(<EncounterCard encounters={waiting(3)} onFace={onFace} />);
    await fireEvent.press(screen.getByText('Show all ▾'));
    await fireEvent.press(screen.getByText('Satyr 2'));

    expect(screen.getByText('Show less ▴')).toBeTruthy();
    expect(screen.getByText('3 waiting on the road')).toBeTruthy();
    // The next is the list's first row, not a second copy above it.
    expect(screen.getAllByText('Harpy')).toHaveLength(1);
    expect(onFace.mock.calls[0]?.[0]).toMatchObject({ grantId: 'g-2' });
  });

  it('offers no list for a single encounter, and nothing at all for none', async () => {
    await render(<EncounterCard encounters={waiting(1)} onFace={jest.fn()} />);

    expect(screen.getByText('Waiting on the road')).toBeTruthy();
    expect(screen.queryByText('Show all ▾')).toBeNull();

    await render(<EncounterCard encounters={[]} onFace={jest.fn()} />);

    expect(screen.queryByText(/on the road/)).toBeNull();
  });

  /** An unmet enemy keeps its type to itself, as in the Bestiary and the battle chevrons. */
  it('shows the type of an enemy already met, and New for one not yet met', async () => {
    await render(<EncounterCard encounters={waiting(2)} types={new Map([['enemy_satyr', 'Trickery']])} onFace={jest.fn()} />);

    expect(screen.queryByText('Trickery')).toBeNull();
    expect(screen.getByText('New')).toBeTruthy();

    await render(<EncounterCard encounters={waiting(2)} types={new Map([['enemy_harpy', 'Storm']])} onFace={jest.fn()} />);

    expect(screen.getByText('Storm')).toBeTruthy();
  });
});
