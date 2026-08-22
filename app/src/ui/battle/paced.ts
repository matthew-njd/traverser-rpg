import { useEffect, useRef, useState } from 'react';

/**
 * GDD 13 §6 pacing — the combat log reveals one line at a time.
 *
 * The defect this exists for: a Salve heal and the counterattack answering it landed in the same
 * frame, and a correct turn read as a failure (M2 drill note 1.11). A turn resolves as a batch of
 * events, so without this every line of it appears at once and the player is asked to reconstruct
 * an order they never saw happen.
 *
 * ↯ **Not an animation.** This is a comprehension fix, so it is timing over content rather than
 * motion — it needs no sprites, no choreography, and nothing from T5 §13, all of which are M4+.
 */
export const LINE_DELAY_MS = 450;

/**
 * The prefix of `lines` revealed so far, growing by one every `delayMs` until it catches up.
 *
 * Mounts fully caught up: a battle resumed after a process death (T5 §8) must not replay its whole
 * log from the beginning, and neither must a re-render.
 */
export function usePacedLines(
  lines: readonly string[],
  delayMs: number = LINE_DELAY_MS,
): readonly string[] {
  const [shown, setShown] = useState(lines.length);
  const previous = useRef(lines.length);

  // A shorter list is a *new* fight, not a rewind — snap rather than pace backwards.
  if (lines.length < previous.current) {
    previous.current = lines.length;
  }

  useEffect(() => {
    previous.current = lines.length;

    if (shown >= lines.length) {
      return;
    }

    // ↯ One timer per line, cleared on every change. A single interval would keep firing after the
    // screen unmounts mid-turn — which on Android is an update on a dead component, not a no-op.
    const timer = setTimeout(() => setShown((count) => count + 1), delayMs);

    return () => clearTimeout(timer);
  }, [shown, lines.length, delayMs]);

  useEffect(() => {
    if (shown > lines.length) {
      setShown(lines.length);
    }
  }, [shown, lines.length]);

  return lines.slice(0, Math.min(shown, lines.length));
}
