import { render, screen } from '@testing-library/react-native';

import { RestDay } from '../RestDay';

/**
 * Drills note 13 — the Rest Day tag is refused while a battle is open.
 *
 * A running fight holds its own copy of Vigor and writes it back on settle, so a tag landing
 * mid-fight is silently overwritten: the player loses their one daily restore and, with no Vigor
 * readout on this screen, never sees it happen. Found on hardware, reachable in ordinary play.
 *
 * What a mutation would slip past: dropping `fighting` from the `disabled` expression still renders
 * the explanatory note, so the screen would look correct while the tap went through again.
 */
const enabled = () => screen.getByRole('button').props.accessibilityState.disabled === false;

describe('the Rest Day control', () => {
  it('offers the tag when no battle is open', async () => {
    await render(<RestDay name="Emdir" tagged={false} fighting={false} onTag={() => {}} />);

    expect(screen.getByText('Tag today as a Rest Day')).toBeTruthy();
    expect(enabled()).toBe(true);
  });

  it('refuses the tag while a battle is open, and says why', async () => {
    await render(<RestDay name="Emdir" tagged={false} fighting onTag={() => {}} />);

    expect(enabled()).toBe(false);
    expect(screen.getByText(/A fight is still open/)).toBeTruthy();
  });

  /** The refusal is temporary and must not read as the day being spent. */
  it('keeps the untagged label while refusing, rather than showing the tagged state', async () => {
    await render(<RestDay name="Emdir" tagged={false} fighting onTag={() => {}} />);

    expect(screen.getByText('Tag today as a Rest Day')).toBeTruthy();
    expect(screen.queryByText(/strength returns/)).toBeNull();
  });

  it('shows the confirmation once tagged, with no fight note', async () => {
    await render(<RestDay name="Emdir" tagged fighting={false} onTag={() => {}} />);

    expect(enabled()).toBe(false);
    expect(screen.getByText(/strength returns/)).toBeTruthy();
    expect(screen.queryByText(/A fight is still open/)).toBeNull();
  });
});
