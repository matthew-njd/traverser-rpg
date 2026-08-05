import { StyleSheet, Text, View } from 'react-native';

import { Body, Screen, Title } from '@/ui/primitives';
import { colors, space, type } from '@/ui/theme';

/**
 * GDD 13 §4 — the Map, stubbed.
 *
 * ↯ It ships as a stub rather than not at all so the 3-tab bar (GDD 13 §2.1) is built once here
 * instead of being retrofitted at M3, when the road, the Waymarker and the gate nodes arrive. The
 * Boss Gate Detail push (§4.3) and the Zone Entry overlay (§4.4) land with it.
 */
export default function Map() {
  return (
    <Screen>
      <Title>The Road</Title>

      <View style={styles.centre}>
        <Text style={styles.glyph}>⋮</Text>
        <Body dim>The road is being drawn. Walk on — your leagues are counting.</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  glyph: { ...type.display, color: colors.border, fontSize: 56 },
});
