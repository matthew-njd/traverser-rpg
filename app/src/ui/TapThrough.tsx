import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from './theme';

/** GDD 10 §4's story-intro pages, reused for GDD 12 §4's zone narratives: one line a tap. */
export function TapThrough({ lines, onDone }: { lines: readonly string[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);

  const advance = () => {
    if (index + 1 < lines.length) {
      setIndex(index + 1);

      return;
    }

    onDone();
  };

  return (
    <Pressable accessibilityRole="button" onPress={advance} style={styles.page}>
      <Text style={styles.line}>{lines[index]}</Text>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {lines.map((line, dot) => (
            <View key={line} style={[styles.dot, dot === index && styles.dotOn]} />
          ))}
        </View>
        <Text style={styles.hint}>Tap to continue</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'space-between', paddingVertical: space.xl },
  line: { ...type.title, color: colors.text, lineHeight: 32, flex: 1, textAlignVertical: 'center' },
  footer: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: space.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent },
  hint: { ...type.small, color: colors.textDim },
});
