import type { ReactElement } from 'react';
import { FlatList, type RefreshControlProps, StyleSheet, Text, View } from 'react-native';

import type { ActivityDay } from '../sync/dto';
import { colors, radius, space, type } from './theme';

/**
 * GDD 13 §3.2's reverse-chronological activity log.
 *
 * ↯ A `FlatList`, not a `.map()` inside a `ScrollView`. This is the divergence that bites hardest
 * coming from web: mapping an array to elements renders and mounts **every** row up front, and a
 * player two years in has 700 of them. On web that is a slow paint; here it is a visible multi-second
 * hitch and a memory spike, because each row is a real native view. `FlatList` virtualises, so only
 * what is near the viewport exists.
 *
 * ↯ `keyExtractor` is not React's `key` by another name — it also identifies the row for recycling,
 * so returning an index would make rows swap content as the list scrolls. `activity_date` is a
 * natural stable key here: one row per local date, by primary key.
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
   * ↯ Anything the screen wants *above* the log goes here rather than beside the list, so the whole
   * sub-view is one scroll host. Put a card next to the list instead and the top of the screen —
   * where a pull naturally starts — belongs to a plain `View` and the gesture never reaches the
   * list. It also removes the nested-VirtualizedList problem a wrapping `ScrollView` would create.
   */
  header?: ReactElement;
}) {
  return (
    <FlatList
      data={days}
      ListHeaderComponent={header}
      keyExtractor={(day) => day.activityDate}
      refreshControl={refreshControl}
      // ↯ Without `flex: 1` the list sizes to its content, so on a near-empty log it is a thin strip
      // and the pull gesture has almost nothing to grab — the empty space below it belongs to the
      // parent view, not the scroll view. Owning the remaining space is also what lets it scroll
      // once there are ninety days in here.
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
  xp: { ...type.body, color: colors.gold },
  detail: { ...type.small, color: colors.textDim },
});
