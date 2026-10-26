import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PendingEncounter } from '../progression/road';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from './theme';

/**
 * The encounters sync granted (T2 §1.3), one row high however many wait (DECISIONS 2026-10-24).
 * The next enemy is the headline and Battle starts it; the count sits beneath. The full list opens
 * on request.
 */
export function EncounterCard({
  encounters,
  types = new Map(),
  onFace,
}: {
  encounters: readonly PendingEncounter[];
  /** Type labels for enemies already met only. An unmet one is tagged New, its type kept back as in the Bestiary. */
  types?: ReadonlyMap<string, string>;
  onFace: (encounter: PendingEncounter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [next] = encounters;

  if (next === undefined) {
    return null;
  }

  const shown = open ? encounters : [next];

  return (
    <View style={styles.card}>
      {/* One list, collapsed to its first row: opening it adds rows under the next, never repeats it. */}
      {shown.map((encounter, index) => (
        <Pressable
          key={encounter.grantId}
          accessibilityRole="button"
          accessibilityLabel={`Battle ${encounter.displayName}`}
          onPress={() => onFace(encounter)}
          style={[styles.row, styles.link, index > 0 && styles.divided]}
        >
          <View style={styles.lead}>
            <Text style={styles.next}>{encounter.displayName}</Text>
            <Text style={styles.typeTag}>{types.get(encounter.enemyId) ?? 'New'}</Text>
          </View>
          <Text style={styles.battle}>Battle ›</Text>
        </Pressable>
      ))}

      <View style={[styles.row, styles.divided]}>
        <Text style={[styles.count, styles.grow]}>
          {encounters.length === 1
            ? 'Waiting on the road'
            : open
              ? `${encounters.length} waiting on the road`
              : `1 of ${encounters.length} waiting on the road`}
        </Text>

        {encounters.length > 1 ? (
          <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.link}>
            <Text style={styles.linkText}>{open ? 'Show less ▴' : 'Show all ▾'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  lead: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  grow: { flex: 1 },
  next: { ...type.heading, color: colors.text },
  typeTag: {
    ...type.small,
    color: colors.textDim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.xs,
  },
  battle: { ...type.body, color: colors.accent, fontWeight: '600' },
  count: { ...type.small, ...tabular, color: colors.textDim },
  link: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  linkText: { ...type.small, color: colors.accent, fontWeight: '600' },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
