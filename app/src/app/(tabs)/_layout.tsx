import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { colors } from '@/ui/theme';

/**
 * GDD 13 §2.1 — three tabs, in this order, Character first.
 *
 * ↯ Three and not more, deliberately. Stats, Equip, battle Items and Bestiary were each flagged by
 * earlier sections as wanting a home; four extra top-level tabs would push past what a phone tab bar
 * supports (five is the practical ceiling). Character and Inventory each host their sub-views
 * instead, as **state rather than routes** (tech-04 §4.3) — so both panes stay mounted, switching
 * costs nothing, and no effect re-runs.
 *
 * Battle and Settings are deliberately **not** tabs. Battle opens over whatever screen the player
 * was on and returns to it, which is a root-level route (M2). Settings is pushed from the Character
 * screen's gear icon — low-frequency enough not to warrant permanent nav real estate.
 *
 * The icons are text glyphs until the art phase (tech-04 §9.3); the tab bar's shape is what M1 is
 * building once rather than retrofitting at M3.
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
