import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, tabular, type } from '../theme';

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

  // Rounded for display only. `ceil` off zero so a survivor never reads 0% — "still standing" is
  // the one thing this bar must not get wrong.
  const percent = fraction === 0 ? 0 : Math.max(1, Math.round(fraction * 100));

  return (
    <View style={styles.wrapper}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={enemy ? 'Enemy Vigor' : 'Your Vigor'}
        accessibilityValue={enemy ? { text: `${percent}%` } : { min: 0, max: vigorMax, now: vigor }}
        style={styles.track}
      >
        <View
          style={[
            styles.fill,
            { width: `${fraction * 100}%` },
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
