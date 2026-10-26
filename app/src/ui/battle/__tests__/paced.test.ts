import { act, renderHook } from '@testing-library/react-native';

import { ACTOR_CHANGE_DELAY_MS, LINE_DELAY_MS, usePacedLines } from '../paced';

/**
 * The pacing rule, as timing rather than as pixels. RNTL cannot see a layout (T4 §12) but it can
 * see *when* a line becomes available, which is the whole of what this hook decides.
 */
describe('usePacedLines', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  /** A resumed fight (T5 §8) must not replay its log from the first line. */
  it('mounts already caught up', async () => {
    const { result } = await renderHook(() => usePacedLines(['a', 'b', 'c']));

    expect(result.current).toEqual(['a', 'b', 'c']);
  });

  it('reveals new lines one at a time', async () => {
    const { result, rerender } = await renderHook(({ lines }: { lines: readonly string[] }) => usePacedLines(lines), {
      initialProps: { lines: ['a'] as readonly string[] },
    });

    await rerender({ lines: ['a', 'b', 'c'] });

    expect(result.current).toEqual(['a']);

    await tick(LINE_DELAY_MS);
    expect(result.current).toEqual(['a', 'b']);

    await tick(LINE_DELAY_MS);
    expect(result.current).toEqual(['a', 'b', 'c']);
  });

  /** The defect in one assertion: two events from one turn are never readable in the same frame. */
  it('does not reveal two lines in the same frame', async () => {
    const { result, rerender } = await renderHook(({ lines }: { lines: readonly string[] }) => usePacedLines(lines), {
      initialProps: { lines: ['heal'] as readonly string[] },
    });

    await rerender({ lines: ['heal', 'counterattack'] });
    await tick(LINE_DELAY_MS - 1);

    expect(result.current).toEqual(['heal']);
  });

  /** Note 16: the counter waits longer than a line of the same turn would. */
  it('waits the per-line delay it is given', async () => {
    expect(ACTOR_CHANGE_DELAY_MS).toBeGreaterThan(LINE_DELAY_MS);

    const delayAt = (index: number) => (index === 1 ? ACTOR_CHANGE_DELAY_MS : LINE_DELAY_MS);
    const { result, rerender } = await renderHook(
      ({ lines }: { lines: readonly string[] }) => usePacedLines(lines, delayAt),
      { initialProps: { lines: [] as readonly string[] } },
    );

    await rerender({ lines: ['salve', 'counter'] });
    await tick(LINE_DELAY_MS);
    expect(result.current).toEqual(['salve']);

    await tick(ACTOR_CHANGE_DELAY_MS - 1);
    expect(result.current).toEqual(['salve']);

    await tick(1);
    expect(result.current).toEqual(['salve', 'counter']);
  });

  it('snaps to a shorter list rather than pacing backwards', async () => {
    const { result, rerender } = await renderHook(({ lines }: { lines: readonly string[] }) => usePacedLines(lines), {
      initialProps: { lines: ['a', 'b', 'c'] as readonly string[] },
    });

    await rerender({ lines: ['x'] });

    expect(result.current).toEqual(['x']);
  });

  it('stops revealing once it has caught up', async () => {
    const { result, rerender } = await renderHook(({ lines }: { lines: readonly string[] }) => usePacedLines(lines), {
      initialProps: { lines: ['a'] as readonly string[] },
    });

    await rerender({ lines: ['a', 'b'] });
    await tick(LINE_DELAY_MS * 10);

    expect(result.current).toEqual(['a', 'b']);
  });
});
