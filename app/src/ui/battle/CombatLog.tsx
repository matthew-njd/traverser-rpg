import { useRef } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import type { LogLine } from './log';
import { colors, space, type } from '../theme';

/**
 * GDD 13 §6.1's combat log, amended at M5/P7c — the enemy's lines on the left and the player's on
 * the right, each led by who acted. Tall enough for the last four lines, and scrollable back through
 * the whole fight; a new line scrolls it to the bottom.
 */
export const LOG_WINDOW = 4;

/** One line's height plus the gap, so the window fits {@link LOG_WINDOW} single-row lines. */
const ROW = 22;

export function CombatLog({ lines, enemyName }: { lines: readonly LogLine[]; enemyName: string }) {
  const scroll = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scroll}
      accessibilityRole="summary"
      accessibilityLabel="Combat log"
      style={styles.log}
      contentContainerStyle={styles.content}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
    >
      {lines.map((line, index) => {
        const mine = line.actor === 'player';

        return (
          // Lines repeat verbatim — two identical Basic Attacks for the same damage — so the text
          // cannot be the key. A line never moves once shown, so its position identifies it.
          <Text key={index} style={[styles.line, mine ? styles.mine : styles.theirs]}>
            <Text style={mine ? styles.you : styles.enemy}>{mine ? 'You' : enemyName}: </Text>
            {line.text}
          </Text>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ↯ RN's ScrollView defaults to `flexGrow: 1` and would take the column from the action menu. A
  // fixed height is the window; `flexGrow: 0` stops it growing past that.
  log: { height: LOG_WINDOW * ROW + space.xs, flexGrow: 0 },
  content: { flexGrow: 1, justifyContent: 'flex-end', gap: space.xs, paddingHorizontal: space.xs },
  line: { ...type.small, color: colors.text, lineHeight: 16, maxWidth: '85%' },
  theirs: { alignSelf: 'flex-start' },
  mine: { alignSelf: 'flex-end', textAlign: 'right' },
  you: { color: colors.accent, fontWeight: '600' },
  enemy: { color: colors.madder, fontWeight: '600' },
});
