import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { type RoadState, readRoad } from '@/progression/road';
import { syncNow } from '@/runtime';
import { Button, Screen, Title } from '@/ui/primitives';
import { Road, waymarkerZone } from '@/ui/Road';
import { colors, space, tabular, type } from '@/ui/theme';

/**
 * GDD 9 §4 — the Road.
 *
 * Reads the mirror, never the network: every input to `readRoad` is already local, so the tab opens
 * with no round trip and works with the API switched off (tech-02 §1.2). `GET /players/me/map` is
 * the authority and the repair path, the same role `GET /players/me` plays for the player block.
 *
 * The Viewport scrolls freely to any segment behind the Waymarker (§4.3); "Return to the Road"
 * snaps it back. Explore lands at M3/P8 with the rosters it needs.
 */
export default function MapScreen() {
  const [road, setRoad] = useState<RoadState | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());

  const reload = useCallback(() => setRoad(readRoad(getDatabase())), []);

  useFocusEffect(reload);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await syncNow();
    } catch {
      // Offline is the ordinary outcome, and the Road is derived from what is already durable.
    } finally {
      reload();
      setRefreshing(false);
    }
  }, [reload]);

  const returnToTheRoad = () => {
    const zoneId = road === null ? null : waymarkerZone(road);
    const y = zoneId === null ? undefined : offsets.current.get(zoneId);

    // ↯ Not `scrollTo(0)`. The Waymarker is usually *not* at the top — by Imperion the player's
    // frontier is two segments down, and snapping to the origin is the opposite of returning.
    scroll.current?.scrollTo({ y: y ?? 0, animated: true });
  };

  return (
    <Screen tabbed>
      <Title>The Road</Title>

      {road === null ? null : (
        <>
          <View style={styles.counter}>
            <Text style={styles.leagues}>{road.leagues.toLocaleString()} Leagues</Text>

            {/* §4.4's "653 / 900 Leagues to Jörmungandr's Gate", once there is a gate ahead. */}
            {road.nextGate === null ? null : (
              <Text style={styles.toNext}>
                {road.leagues.toLocaleString()} / {road.nextGate.leagueThreshold.toLocaleString()} to{' '}
                {road.nextGate.displayName}
              </Text>
            )}
          </View>

          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.viewport}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void refresh()}
                tintColor={colors.accent}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
              />
            }
          >
            <Road
              state={road}
              onZoneLayout={(zoneId, y) => offsets.current.set(zoneId, y)}
            />
          </ScrollView>

          <Button label="Return to the Road" onPress={returnToTheRoad} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { gap: space.xs, paddingBottom: space.sm },
  leagues: { ...type.display, ...tabular, color: colors.accent },
  toNext: { ...type.small, ...tabular, color: colors.textDim },
  viewport: { gap: space.md, paddingBottom: space.md },
});
