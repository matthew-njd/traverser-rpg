import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import type { LogLine } from './log';

/**
 * T5 §13's choreography, left to the UI: each log line, as it appears, moves the sprite it is about.
 * Every move fits inside `LINE_DELAY_MS`, so the next line never lands on a sprite still moving.
 */
export type Motion = 'flinch' | 'stagger' | 'lunge';

/** A hit on the enemy flinches it, a crit staggers it, and an enemy hit lunges it at the player. */
export function motionFor(line: LogLine | undefined): Motion | null {
  if (line?.cue?.kind !== 'hit') {
    return null;
  }

  if (line.actor === 'enemy') {
    return 'lunge';
  }

  return line.cue.crit ? 'stagger' : 'flinch';
}

const shake = (value: Animated.Value, amplitude: number) =>
  Animated.sequence(
    [amplitude, -amplitude, amplitude * 0.6, -amplitude * 0.6, 0].map((toValue) =>
      Animated.timing(value, { toValue, duration: 50, useNativeDriver: true }),
    ),
  );

/**
 * Drives the enemy sprite and the player panel from the paced log. Reduced motion keeps the faint's
 * fade, which is not motion, and drops the rest.
 */
export function useBattleMotion({
  entries,
  shown,
  fainted,
}: {
  entries: readonly LogLine[];
  /** How many lines the log has revealed. */
  shown: number;
  /** The enemy lost, and its last line is out. */
  fainted: boolean;
}) {
  const [reduced, setReduced] = useState(false);
  const enemyX = useRef(new Animated.Value(0)).current;
  const enemyY = useRef(new Animated.Value(0)).current;
  const enemyScale = useRef(new Animated.Value(1)).current;
  const enemyOpacity = useRef(new Animated.Value(1)).current;
  const playerX = useRef(new Animated.Value(0)).current;
  const before = useRef(shown);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
  }, []);

  useEffect(() => {
    // One new line moves its sprite. A jump of several is a resumed fight, which replays nothing.
    const step = shown - before.current;

    before.current = shown;

    if (step !== 1 || reduced) {
      return;
    }

    const motion = motionFor(entries[shown - 1]);

    if (motion === 'flinch' || motion === 'stagger') {
      Animated.parallel([
        shake(enemyX, motion === 'stagger' ? 14 : 8),
        Animated.sequence([
          Animated.timing(enemyOpacity, { toValue: 0.5, duration: 60, useNativeDriver: true }),
          Animated.timing(enemyOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]),
      ]).start();
    } else if (motion === 'lunge') {
      Animated.parallel([
        Animated.sequence([
          Animated.parallel([
            Animated.timing(enemyY, { toValue: 18, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(enemyScale, { toValue: 1.08, duration: 110, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(enemyY, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.timing(enemyScale, { toValue: 1, duration: 160, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([Animated.delay(110), shake(playerX, 6)]),
      ]).start();
    }
  }, [shown, entries, reduced, enemyX, enemyY, enemyScale, enemyOpacity, playerX]);

  useEffect(() => {
    if (!fainted) {
      return;
    }

    Animated.parallel([
      Animated.timing(enemyOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
      ...(reduced ? [] : [Animated.timing(enemyY, { toValue: 40, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true })]),
    ]).start();
  }, [fainted, reduced, enemyOpacity, enemyY]);

  return {
    enemy: {
      opacity: enemyOpacity,
      transform: [{ translateX: enemyX }, { translateY: enemyY }, { scale: enemyScale }],
    },
    player: { transform: [{ translateX: playerX }] },
  };
}
