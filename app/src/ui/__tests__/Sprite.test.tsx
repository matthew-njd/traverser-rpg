import { render, screen } from '@testing-library/react-native';

import { Sprite } from '../Sprite';

// Every manifest sprite has art now, so the placeholder path needs one pinned for it.
jest.mock('../../assets/registry.generated', () => ({
  ...jest.requireActual('../../assets/registry.generated'),
  PLACEHOLDER_SPRITES: new Set(['enemy_satyr']),
}));

/** A placeholder PNG must never reach a plate; the glyph stands in until the art is delivered. */
describe('the sprite plate', () => {
  it('shows the art once a key is delivered', async () => {
    await render(<Sprite subject="enemy_harpy" size={48} glyph="◈" />);

    expect(screen.queryByText('◈')).toBeNull();
  });

  it('keeps the glyph for a key still on its placeholder', async () => {
    await render(<Sprite subject="enemy_satyr" size={48} glyph="◈" />);

    expect(screen.getByText('◈')).toBeTruthy();
  });

  it('keeps the glyph for a subject with no art key at all', async () => {
    await render(<Sprite subject="skill_basic_attack" size={48} glyph="✳" />);

    expect(screen.getByText('✳')).toBeTruthy();
  });
});
