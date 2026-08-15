import type { ReactElement } from 'react';
import { FlatList, type RefreshControlProps, StyleSheet, Text, View } from 'react-native';

import type { ActivityDay } from '../sync/dto';
import { colors, radius, space, tabular, type } from './theme';

/**
 * GDD 13 §3.2's reverse-chronological activity log.
 *
 * ↯ A `FlatList`, not `.map()` in a `ScrollView`. Mapping mounts every row up front, and each row
 * is a real native view — 700 of them is a multi-second hitch, not a slow paint.
 *
 * ↯ `keyExtractor` is not React's `key`: it also identifies the row for **recycling**, so an index
 * would make rows swap content as the list scrolls.
 */
export function ActivityLog({
  days,
  refreshControl,
  header,
}: {
  days: readonly ActivityDay[];
  /** Pull-to-sync, supplied by the screen so both sub-views share one refresh handler. */
  refreshControl?: ReactElement<RefreshControlProps>;
  /**
   * Anything above the log goes here, not beside the list, so the sub-view is one scroll host. A
   * card beside the list leaves the top of the screen a plain `View` and the pull never reaches it.
   */
  header?: ReactElement;
}) {
  return (
    <FlatList
      data={days}
      ListHeaderComponent={header}
      keyExtractor={(day) => day.activityDate}
      refreshControl={refreshControl}
      // ↯ Without `flex: 1` the list sizes to content, so a near-empty log is a thin strip and the
      // empty space below belongs to the parent view rather than the scroll view.
      style={styles.fill}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.empty}>
          Nothing recorded yet. Your first walk will appear here after a sync.
        </Text>
      }
      renderItem={({ item }) => <Row day={item} />}
    />
  );
}

function Row({ day }: { day: ActivityDay }) {
  const minutes = [
    day.tier1Minutes > 0 ? `${day.tier1Minutes}m moderate` : null,
    day.tier2Minutes > 0 ? `${day.tier2Minutes}m vigorous` : null,
    day.tier3Minutes > 0 ? `${day.tier3Minutes}m peak` : null,
  ].filter((part): part is string => part !== null);

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.date}>{day.activityDate}</Text>
        <Text style={styles.xp}>{day.xpAwarded.toLocaleString()} XP</Text>
      </View>

      <Text style={styles.detail}>
        {day.steps.toLocaleString()} steps
        {day.goalMet ? ` · goal met` : ''}
      </Text>

      {minutes.length > 0 ? <Text style={styles.detail}>{minutes.join(' · ')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { gap: space.sm, paddingBottom: space.xl },
  empty: { ...type.body, color: colors.textDim, paddingVertical: space.lg, textAlign: 'center' },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.xs,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  date: { ...type.heading, color: colors.text },
  xp: { ...type.body, ...tabular, color: colors.gold },
  detail: { ...type.small, ...tabular, color: colors.textDim },
});
