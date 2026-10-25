import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BestiaryEntry } from '../battle/mirror';
import { type Labels, labelFor } from '../content/labels';
import type { EnemyLore } from '../content/lore';
import { MIN_TOUCH_TARGET, colors, radius, space, type } from './theme';

/**
 * GDD 13 §5.3 — every wild enemy and boss, by zone. One met is named, typed and readable; one not
 * yet met is "???". A boss's entry is its intro, plus its first-kill text once beaten.
 */
export function Bestiary({
  roster,
  met,
  labels,
}: {
  roster: readonly EnemyLore[];
  met: ReadonlyMap<string, BestiaryEntry>;
  labels: Labels;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const zones = [...new Set(roster.map((enemy) => enemy.zoneId))];
  const pick = roster.find((enemy) => enemy.id === picked);
  const text =
    pick === undefined
      ? []
      : pick.role === 'wild'
        ? [pick.flavor ?? '']
        : [...pick.intro, ...((met.get(pick.id)?.defeatCount ?? 0) > 0 ? pick.defeatFirst : [])];

  return (
    <View style={styles.wrap}>
      {zones.map((zoneId) => (
        <View key={zoneId} style={styles.zone}>
          <Text style={styles.zoneName}>{labelFor(labels, zoneId ?? '')}</Text>

          <View style={styles.grid}>
            {roster
              .filter((enemy) => enemy.zoneId === zoneId)
              .map((enemy) => {
                const seen = met.has(enemy.id);

                return (
                  <Pressable
                    key={enemy.id}
                    accessibilityRole="button"
                    accessibilityLabel={seen ? labelFor(labels, enemy.id) : 'Not yet met'}
                    disabled={!seen}
                    onPress={() => setPicked(enemy.id)}
                    style={[styles.tile, !seen && styles.unseen, enemy.id === picked && styles.picked]}
                  >
                    <Text style={styles.tileName} numberOfLines={2}>
                      {seen ? labelFor(labels, enemy.id) : '???'}
                    </Text>
                    {seen && enemy.typeId !== null ? (
                      <Text style={styles.typeTag}>{labelFor(labels, enemy.typeId)}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
          </View>
        </View>
      ))}

      {pick === undefined ? null : (
        <View style={styles.detail}>
          <Text style={styles.detailName}>{labelFor(labels, pick.id)}</Text>
          {text.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  zone: { gap: space.sm },
  zoneName: { ...type.heading, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '23%',
    aspectRatio: 1,
    minHeight: MIN_TOUCH_TARGET,
    padding: space.xs,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unseen: { backgroundColor: colors.background },
  picked: { borderColor: colors.accent },
  tileName: { ...type.small, color: colors.text },
  typeTag: { ...type.small, color: colors.textDim },
  detail: {
    gap: space.sm,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailName: { ...type.heading, color: colors.text },
  line: { ...type.body, color: colors.text, fontStyle: 'italic', lineHeight: 22 },
});
