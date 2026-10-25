import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from './theme';

/**
 * GDD 13 §6.3's shared "here's what you got" card — loot now, level-up and streak milestones when
 * those land. Structural: a plate for the sprite, a name, a grade, and a flavour line.
 */

/**
 * §6.3's rarity-tier border, off GDD 13 §11's rank ladder.
 *
 * ↯ **One ladder for both**, because the colour names a rank rather than a table — a rare item and
 * a Mythic piece are the same step. Gear has a fourth the items have no equivalent for.
 *
 * An unknown grade falls back to the ordinary card edge rather than to a colour that would claim a
 * rank the content did not give it.
 */
export const GRADE_BORDER: Readonly<Record<string, string>> = {
  common: colors.pewter,
  mortal: colors.pewter,
  uncommon: colors.moss,
  heroic: colors.moss,
  rare: colors.lapis,
  mythic: colors.lapis,
  divine: colors.orchid,
};

export function RevealCard({
  name,
  grade,
  flavor,
}: {
  name: string;
  grade: string;
  flavor?: string | null;
}) {
  const accentColor = GRADE_BORDER[grade] ?? colors.border;

  return (
    <View testID="reveal-card" style={[styles.card, { borderColor: accentColor }]}>
      {/* The placeholder plate, per GDD 13 §11's inked-silhouette-on-cream rule (tech-04 §9.3). */}
      <View style={styles.plate}>
        <Text style={styles.plateGlyph}>◆</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{name}</Text>

        {/*
          Named, not coloured. The four steps differ by hue rather than brightness, so this text is
          what carries the rank for a player who cannot separate them (WCAG 1.4.1) — and two of the
          four miss 4.5:1 on this surface as small text (`pewter` 4.40, `lapis` 4.27), which is a
          bar the border does not have to clear and body text does.
        */}
        <Text style={styles.grade}>{grade}</Text>
        {flavor === null || flavor === undefined ? null : (
          <Text style={styles.flavor} numberOfLines={2}>
            {flavor}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    // Overridden per grade above. Not `transparent`: RN paints an unset border black.
    borderColor: colors.border,
  },
  plate: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.sm,
  },
  plateGlyph: { fontSize: 24, color: colors.background },

  body: { flex: 1, gap: space.xs },
  name: { ...type.heading, color: colors.text },
  grade: { ...type.small, color: colors.textDim, textTransform: 'capitalize' },
  flavor: { ...type.small, color: colors.textDim, fontStyle: 'italic' },
});
