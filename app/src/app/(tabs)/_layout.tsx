import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { colors } from '@/ui/theme';

/**
 * GDD 13 §2.1 — three tabs, in this order, Character first.
 *
 * Three and not more: Character and Inventory host their sub-views as state rather than routes
 * (tech-04 §4.3), which is what keeps the bar under a phone's practical ceiling of five.
 *
 * Battle and Settings are deliberately not tabs — Battle opens over the current screen and returns
 * to it (a root route, M2); Settings is pushed from the gear icon.
 *
 * Icons are text glyphs until the art phase (tech-04 §9.3).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="character"
        options={{
          title: 'Character',
          tabBarIcon: ({ color }) => <Glyph color={color}>◆</Glyph>,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarIcon: ({ color }) => <Glyph color={color}>◇</Glyph> }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: 'Inventory',
          tabBarIcon: ({ color }) => <Glyph color={color}>▣</Glyph>,
        }}
      />
    </Tabs>
  );
}

function Glyph({ color, children }: { color: ColorValue; children: string }) {
  return <Text style={{ color, fontSize: 18 }}>{children}</Text>;
}
