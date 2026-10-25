import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from './primitives';
import { colors, space, tabular, type } from './theme';

/** GDD 11 §5.2's next rung. Null once the ladder is climbed (§5.4: nothing past Day 120). */
export interface NextStreakMilestone {
  readonly day: number;
  readonly slot: string;
  readonly tier: string;
}

/** Not derived from the IDs: the IDs are American (`armor`) and the copy is Canadian. */
const NAMES: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Armour',
  accessory: 'Accessory',
  mortal: 'Mortal',
  heroic: 'Heroic',
  mythic: 'Mythic',
};

/**
 * GDD 13 §3.1's streak badge, with GDD 11 §4's personal best beside it. A drawn flame in gold, not
 * the `🔥` emoji, which Android always draws in colour (DECISIONS 2026-10-24).
 *
 * **A break is one quiet line and nothing else** (GDD 11 §4) — no red, no broken chain, no
 * count of what was lost. Tapping the badge opens §3.1's milestone popover.
 */
export function Streak({
  current,
  longest,
  next,
}: {
  current: number;
  longest: number;
  next: NextStreakMilestone | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${current} day streak`}
        onPress={() => setOpen(!open)}
        style={styles.row}
      >
        <View style={styles.badge}>
          <Ionicons name="flame" size={20} color={colors.gold} />
          <Text style={styles.count}>{current}</Text>
        </View>
        <Text style={styles.best}>Best {longest}</Text>
      </Pressable>

      {current <= 1 && longest > current ? (
        <Text style={styles.note}>A new road begins today.</Text>
      ) : null}

      {open ? (
        <View style={styles.popover}>
          {next === null ? (
            <Text style={styles.note}>Every streak reward is yours. The count goes on.</Text>
          ) : (
            <>
              <Text style={styles.next}>
                Day {next.day} · {NAMES[next.tier] ?? next.tier} {NAMES[next.slot] ?? next.slot}
              </Text>
              <Text style={styles.note}>
                {next.day - current} {next.day - current === 1 ? 'day' : 'days'} to go
              </Text>
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  count: { ...type.heading, ...tabular, color: colors.gold },
  best: { ...type.small, ...tabular, color: colors.textDim },
  note: { ...type.small, ...tabular, color: colors.textDim, marginTop: space.sm },
  popover: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  next: { ...type.body, color: colors.text },
});
