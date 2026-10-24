import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from './primitives';
import { colors, space, tabular, type } from './theme';

/**
 * GDD 13 §3.1's streak badge, with GDD 11 §4's personal best beside it. A drawn flame in gold, not
 * the `🔥` emoji, which Android always draws in colour (DECISIONS 2026-10-24).
 *
 * **A break is one quiet line and nothing else** (GDD 11 §4) — no red, no broken chain, no
 * count of what was lost. The milestone popover waits for step 10's rewards (M5).
 */
export function Streak({ current, longest }: { current: number; longest: number }) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.badge} accessible accessibilityLabel={`${current} day streak`}>
          <Ionicons name="flame" size={20} color={colors.gold} />
          <Text style={styles.count}>{current}</Text>
        </View>
        <Text style={styles.best}>Best {longest}</Text>
      </View>

      {current <= 1 && longest > current ? (
        <Text style={styles.note}>A new road begins today.</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  count: { ...type.heading, ...tabular, color: colors.gold },
  best: { ...type.small, ...tabular, color: colors.textDim },
  note: { ...type.small, color: colors.textDim, marginTop: space.sm },
});
