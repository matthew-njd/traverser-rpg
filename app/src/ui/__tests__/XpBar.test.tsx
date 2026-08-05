import { render, screen } from '@testing-library/react-native';

import { XpBar } from '../XpBar';

/**
 * ↯ Rendered rather than eyeballed for one reason: **`xpToNext` is null at Level 60**, and that null
 * is meaningful — it is the schema saying XP accrual has stopped with nothing banked (GDD 1 §4). The
 * plausible bug is treating it as a missing number, which renders an empty bar and reads to the
 * player as having lost everything at the moment they reached the cap.
 *
 * ↯ `render` is `await`ed — RNTL v14 made it async.
 */
describe('XpBar', () => {
  it('shows progress toward the next level', async () => {
    await render(<XpBar level={11} xpCurrent={400} xpToNext={1240} />);

    expect(screen.getByText('Level 11')).toBeTruthy();
    expect(screen.getByText('400 / 1,240 XP')).toBeTruthy();
  });

  it('reads MAX at Level 60 and fills the bar rather than emptying it', async () => {
    await render(<XpBar level={60} xpCurrent={0} xpToNext={null} />);

    expect(screen.getByText('MAX')).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      text: 'Maximum level',
    });
  });

  it('never renders past full, however optimistic the projection was', async () => {
    await render(<XpBar level={11} xpCurrent={5000} xpToNext={1240} />);

    const fill = screen.getByRole('progressbar').children[0] as unknown as {
      props: { style: unknown };
    };
    const style = ([] as unknown[]).concat(fill.props.style) as { width?: string }[];

    expect(style.some((entry) => entry?.width === '100%')).toBe(true);
  });

  it('survives a zero threshold without dividing by it', async () => {
    await render(<XpBar level={1} xpCurrent={0} xpToNext={0} />);

    expect(screen.getByText('0 / 0 XP')).toBeTruthy();
  });
});
