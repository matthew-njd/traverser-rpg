import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/ui/theme';
import { Screen } from '@/ui/primitives';

/**
 * GDD 10 screen 3 — the story intro. Four lines, tap to advance, **not skippable on first launch**
 * (§4: it is brief enough not to warrant a skip, and the Skip link exists only for a reinstall where
 * an existing account was detected — which M1 has no way to detect, so there is no Skip here).
 *
 * The lines are §4's, verbatim and in order. This is premise, not detail; the deeper lore is
 * drip-fed later through zone transitions.
 */
const LINES = [
  'Long before memory, roads connected every realm — Olympion, Valheon, Imperion, and worlds beyond. They call it Omnivium: the realm of all roads.',
  'The roads went quiet. Overgrown. Forgotten.',
  'But every step you take in the world beyond this one echoes here — and the old roads are stirring again.',
  'You are the Traverser. Where you walk, the roads reopen.',
] as const;

export default function Story() {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const advance = () => {
    if (index + 1 < LINES.length) {
      setIndex(index + 1);

      return;
    }

    router.push('/04-name');
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={advance} style={styles.page}>
        <Text style={styles.line}>{LINES[index]}</Text>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {LINES.map((line, dot) => (
              <View key={line} style={[styles.dot, dot === index && styles.dotOn]} />
            ))}
          </View>
          <Text style={styles.hint}>Tap to continue</Text>
        </View>
      </Pressable>
    </Screen>
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
