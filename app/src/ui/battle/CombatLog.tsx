import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '../theme';

/**
 * GDD 13 §6.1's compact combat log — 2–3 lines above the action menu, most recent last.
 *
 * A window rather than a scroll view: the full record of a fight is not something the player is
 * meant to page back through mid-turn, and a scrollable region here would compete with the action
 * menu for the same gesture.
 */
export const LOG_WINDOW = 3;

export function CombatLog({ lines }: { lines: readonly string[] }) {
  const shown = lines.slice(-LOG_WINDOW);

  return (
    <View accessibilityRole="summary" accessibilityLabel="Combat log" style={styles.log}>
      {shown.map((line, index) => (
        <Text
          // Lines repeat verbatim — two identical Basic Attacks for the same damage — so the text
          // cannot be the key. Position within the window is what actually identifies a row here.
          key={`${index}:${line}`}
          numberOfLines={1}
          style={[styles.line, index === shown.length - 1 && styles.latest]}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  log: {
    // Fixed to the window's height so the panels above do not shift as the log fills.
    minHeight: LOG_WINDOW * 20,
    justifyContent: 'flex-end',
    gap: space.xs,
    paddingHorizontal: space.xs,
  },
  line: { ...type.small, color: colors.textMuted, lineHeight: 16 },
  latest: { color: colors.text },
});
