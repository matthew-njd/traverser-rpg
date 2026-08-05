import { StyleSheet, Text, View } from 'react-native';

import { Body, Screen, Title } from '@/ui/primitives';
import { colors, space, type } from '@/ui/theme';

/**
 * GDD 13 §5 — Inventory, stubbed.
 *
 * ↯ Same reason as the Map: the tab exists so the bar's shape is settled. Its three sub-views (Gear,
 * Items, Bestiary) are **state, not routes** when they arrive (tech-04 §4.3), and the road-find
 * badge on this tab's icon has one owner for the same reason.
 */
export default function Inventory() {
  return (
    <Screen>
      <Title>Satchel</Title>

      <View style={styles.centre}>
        <Text style={styles.glyph}>▣</Text>
        <Body dim>Nothing to carry yet. Gear and items arrive with your first battles.</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  glyph: { ...type.display, color: colors.border, fontSize: 56 },
});
