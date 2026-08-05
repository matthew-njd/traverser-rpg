import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from './theme';

/**
 * GDD 13 §3.1 — level and progress toward the next, *"a thin progress bar rather than a raw number
 * to keep the read glanceable"*.
 *
 * ↯ `xpToNext` is **null at Level 60** and that is not a missing value — it is the schema saying
 * accrual has stopped with nothing banked (GDD 1 §4). The bar reads MAX and fills completely; it
 * must never render as 0 or as an empty bar, which would look like a loss.
 *
 * ↯ There is no annotation for a provisional value (tech-04 §8.4). A projection that corrects
 * downward animates on this same component with the same transition as any other change, and the
 * player never learns it was optimistic — so `provisional` deliberately does not reach this file.
 */
export function XpBar({
  level,
  xpCurrent,
  xpToNext,
}: {
  level: number;
  xpCurrent: number;
  xpToNext: number | null;
}) {
  const maxed = xpToNext === null;
  const fraction = maxed ? 1 : Math.max(0, Math.min(1, xpCurrent / Math.max(1, xpToNext)));

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.progress}>
          {maxed ? 'MAX' : `${xpCurrent.toLocaleString()} / ${xpToNext.toLocaleString()} XP`}
        </Text>
      </View>

      <View
        // ↯ `accessible` is not implied by a role. A `View` defaults to `accessible={false}`, so
        // TalkBack skips it entirely and the role is decorative — the bar would be invisible to a
        // screen reader, and to any query that looks for it.
        accessible
        accessibilityRole="progressbar"
        accessibilityValue={
          maxed ? { text: 'Maximum level' } : { min: 0, max: xpToNext, now: xpCurrent }
        }
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  level: { ...type.title, color: colors.text },
  progress: { ...type.small, color: colors.textDim },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.gold },
});
