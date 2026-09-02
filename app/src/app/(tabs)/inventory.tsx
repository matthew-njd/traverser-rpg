import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { readSatchel } from '@/battle/mirror';
import { getDatabase } from '@/db/open';
import { Body, Screen, Title } from '@/ui/primitives';
import { colors, space, type } from '@/ui/theme';

/**
 * GDD 13 §5 — Inventory, stubbed.
 *
 * Stubbed so the bar's shape is settled once. Its three sub-views (Gear, Items, Bestiary) arrive as
 * state rather than routes (tech-04 §4.3).
 *
 * **The empty line is gated on a real count.** It used to print unconditionally, so a player
 * holding a satchel and an equipped weapon was told they carried nothing — an unbuilt screen
 * saying nothing is fine, but this one made a false claim about the save, and it was read as lost
 * data during the M3 drills (note 7). A stub may be silent; it may not lie.
 */
export default function Inventory() {
  const [held, setHeld] = useState(0);

  const reload = useCallback(() => {
    setHeld(readSatchel(getDatabase()).length);
  }, []);

  useFocusEffect(reload);

  return (
    <Screen tabbed>
      <Title>Satchel</Title>

      <View style={styles.centre}>
        <Text style={styles.glyph}>▣</Text>

        {held === 0 ? (
          <Body dim>Nothing to carry yet. Gear and items arrive with your first battles.</Body>
        ) : (
          <Body dim>
            Carrying {held} {held === 1 ? 'item' : 'items'}. This screen is not built yet — until it
            is, your satchel is under Items in a fight.
          </Body>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  glyph: { ...type.display, color: colors.border, fontSize: 56 },
});
