import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, tabular, type } from '../theme';

/** GDD 13 §6 pacing — long enough to read as a drain, short enough not to delay the next tap. */
export const VIGOR_SWEEP_MS = 400;

/**
 * GDD 13 §6.1's two Vigor bars, which differ in what they are allowed to say.
 *
 * The **enemy** bar shows a percentage and never a raw number — enemy max Vigor is not meaningful
 * information to expose (GDD 13 §6.1, Section 2's stat design) — and is the palette's one sanctioned
 * use of `oxblood` (§11). The **player** bar shows current/max, because their own pool is precisely
 * what they are meant to be tracking.
 *
 * There is no level indicator on the enemy: enemy level always equals player level, so it would be
 * redundant noise (§6.1 closes Section 5's flagged question this way).
 */
export function VigorBar({
  side,
  vigor,
  vigorMax,
}: {
  side: 'player' | 'enemy';
  vigor: number;
  vigorMax: number;
}) {
  const fraction = vigorMax <= 0 ? 0 : Math.max(0, Math.min(1, vigor / vigorMax));
  const enemy = side === 'enemy';

  /**
   * The bar sweeps to its new value instead of jumping (GDD 13 §6, M2 drill note 1.11) — a hit and
   * the heal answering it are otherwise indistinguishable, because both are one frame.
   *
   * ↯ **`useNativeDriver` is `false` here and cannot be `true`.** The native driver only animates
   * opacity and transforms; `width` is a layout property, so it is driven from JS. A web developer
   * would reach for a CSS transition and never meet this distinction. It is two views on one
   * screen, so the JS-thread cost is not worth trading for a `scaleX` that would also need a
   * transform origin RN does not expose on this version.
   */
  const width = useRef(new Animated.Value(fraction)).current;
  const settled = useRef(fraction);

  useEffect(() => {
    // Nothing to sweep to. This is the mount case above all — the value starts where it belongs —
    // and animating to where the bar already is costs a frame loop for no visible motion.
    if (settled.current === fraction) {
      return;
    }

    settled.current = fraction;

    const sweep = Animated.timing(width, {
      toValue: fraction,
      duration: VIGOR_SWEEP_MS,
      useNativeDriver: false,
    });

    sweep.start();

    // Stopped rather than left running: a battle that ends mid-sweep unmounts this, and an
    // animation still writing to a detached node is a warning the player never sees and a leak.
    return () => sweep.stop();
  }, [fraction, width]);

  // Rounded for display only. `ceil` off zero so a survivor never reads 0% — "still standing" is
  // the one thing this bar must not get wrong.
  const percent = fraction === 0 ? 0 : Math.max(1, Math.round(fraction * 100));

  return (
    <View style={styles.wrapper}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={enemy ? 'Enemy Vigour' : 'Your Vigour'}
        accessibilityValue={enemy ? { text: `${percent}%` } : { min: 0, max: vigorMax, now: vigor }}
        style={styles.track}
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: width.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
            enemy ? styles.enemyFill : styles.playerFill,
          ]}
        />
      </View>

      <Text style={styles.readout}>{enemy ? `${percent}%` : `${vigor} / ${vigorMax}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
  enemyFill: { backgroundColor: colors.oxblood },
  playerFill: { backgroundColor: colors.accent },
  readout: { ...type.small, ...tabular, color: colors.textDim, minWidth: 64, textAlign: 'right' },
});
