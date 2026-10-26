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
 * The longer beat when the turn passes to the other side (M3 note 16), so a counter reads as a
 * reply rather than as more of the same turn. Tuned on the device, not derived.
 */
export const ACTOR_CHANGE_DELAY_MS = 900;

/**
 * The prefix of `lines` revealed so far, growing by one at a time until it catches up. `delayAt`
 * gives the wait before line `index` appears.
 *
 * Mounts fully caught up: a battle resumed after a process death (T5 §8) must not replay its whole
 * log from the beginning, and neither must a re-render.
 */
export function usePacedLines(
  lines: readonly string[],
  delayAt: (index: number) => number = () => LINE_DELAY_MS,
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
    const timer = setTimeout(() => setShown((count) => count + 1), delayAt(shown));

    return () => clearTimeout(timer);
    // `delayAt` is read when each timer starts; a new function identity must not restart it.
  }, [shown, lines.length]);

  useEffect(() => {
    if (shown > lines.length) {
      setShown(lines.length);
    }
  }, [shown, lines.length]);

  return lines.slice(0, Math.min(shown, lines.length));
}
