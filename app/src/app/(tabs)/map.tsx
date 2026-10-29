import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type BestiaryEntry, readBestiaryBook } from '@/battle/mirror';
import { type Labels, labelFor, loadLabels } from '@/content/labels';
import { type EnemyLore, readRoster } from '@/content/lore';
import { playSfx } from '@/audio/bus';
import { getDatabase } from '@/db/open';
import { deviceLocalDates } from '@/health/localDate';
import { type PendingEncounter, type RoadState, readEncounters, readRoad } from '@/progression/road';
import { syncNow } from '@/runtime';
import { requestExplore } from '@/sync/writes';
import { Bestiary } from '@/ui/Bestiary';
import { EncounterCard } from '@/ui/EncounterCard';
import { Button, Screen, SegmentedControl, Title } from '@/ui/primitives';
import { Road, waymarkerZone } from '@/ui/Road';
import { MIN_TOUCH_TARGET, colors, radius, space, tabular, type } from '@/ui/theme';

/**
 * GDD 9 §4 — the Road.
 *
 * Reads the mirror, never the network: every input to `readRoad` is already local, so the tab opens
 * with no round trip and works with the API switched off (tech-02 §1.2). `GET /players/me/map` is
 * the authority and the repair path, the same role `GET /players/me` plays for the player block.
 *
 * The Viewport scrolls freely to any segment behind the Waymarker (§4.3); "Return to the Road"
 * snaps it back. One Explore button acts on the selected unlocked segment, the Waymarker's by
 * default (GDD 13 §4.2, amended at M5/P6), and the encounters sync has already granted are
 * spendable from here whether or not the API is reachable (T2 §1.3).
 *
 * The Bestiary is the second sub-view (GDD 13 §5.3, amended at M5/P5): enemies are met on the Road
 * and grouped by its zones.
 */
export default function MapScreen() {
  const router = useRouter();
  const [road, setRoad] = useState<RoadState | null>(null);
  const [encounters, setEncounters] = useState<readonly PendingEncounter[]>([]);
  const [exploring, setExploring] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'path' | 'bestiary'>('path');
  const [roster, setRoster] = useState<readonly EnemyLore[]>([]);
  const [met, setMet] = useState<ReadonlyMap<string, BestiaryEntry>>(new Map());
  const [labels, setLabels] = useState<Labels>(new Map());

  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const roadY = useRef(0);

  const reload = useCallback(() => {
    const db = getDatabase();

    setRoad(readRoad(db));
    setEncounters(readEncounters(db));
    setRoster(readRoster(db));
    setMet(readBestiaryBook(db));
    setLabels(loadLabels(db));
  }, []);

  useFocusEffect(reload);

  /**
   * GDD 9 §4.3 — one tap, one roll from the shared daily pool.
   *
   * ↯ **The tap is durable before the sync is attempted, and the encounter is not.** The roll is
   * the server's (T2 §4 step 8), so nothing can be shown until it answers — but the queued intent
   * survives the app being killed, and the grant arrives on whichever sync gets through. Offline
   * the button simply settles and the encounter appears later, which is the honest outcome.
   */
  const explore = (zoneId: string) => {
    const waiting = readEncounters(getDatabase()).length;

    setExploring(zoneId);

    requestExplore(getDatabase(), zoneId, deviceLocalDates.dateOf(Date.now()), Date.now());

    void syncNow(Date.now(), { withNewWork: true })
      .catch(() => undefined)
      .finally(() => {
        // GDD 14 §6.4, Explore only (DECISIONS 2026-10-28): the roll found a fight.
        if (readEncounters(getDatabase()).length > waiting) {
          playSfx('sfx_encounter_start');
        }

        reload();
        setExploring(null);
      });
  };

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
    scroll.current?.scrollTo({ y: roadY.current + (y ?? 0), animated: true });
  };

  const target = road === null ? null : (selected ?? waymarkerZone(road));
  const targetName = road?.zones.find((zone) => zone.zoneId === target)?.displayName;

  return (
    <Screen tabbed>
      <Title>The Road</Title>

      <SegmentedControl
        options={[
          { value: 'path', label: 'Path' },
          { value: 'bestiary', label: 'Bestiary' },
        ]}
        value={view}
        onChange={setView}
      />

      <View style={[styles.pane, view === 'bestiary' ? null : styles.hidden]}>
        <ScrollView contentContainerStyle={styles.viewport}>
          <Bestiary roster={roster} met={met} labels={labels} />
        </ScrollView>
      </View>

      {road === null ? null : (
        <View style={[styles.pane, view === 'path' ? null : styles.hidden]}>
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
            {/*
              T2 §1.3 — sync delivers grants, not battles, so these are spendable with the API off.
              Above the Road rather than inside a segment: an encounter earned by walking belongs to
              no particular node, and burying it in the segment it names would hide it. Inside the
              scroll view, because outside it a long queue took the whole screen and froze the Road.
            */}
            <EncounterCard
              encounters={encounters}
              types={
                new Map(
                  roster
                    .filter((enemy) => met.has(enemy.id) && enemy.typeId !== null)
                    .map((enemy) => [enemy.id, labelFor(labels, enemy.typeId ?? '')]),
                )
              }
              onFace={(encounter) =>
                router.push({
                  pathname: '/battle',
                  params: { enemyId: encounter.enemyId, grantId: encounter.grantId },
                })
              }
            />

            {/* Segment offsets are relative to the Road, so its own offset is added on return. */}
            <View onLayout={(event) => (roadY.current = event.nativeEvent.layout.y)}>
              <Road
                state={road}
                selected={target}
                onSelect={setSelected}
                onFace={(gate) =>
                  router.push({
                    pathname: '/battle',
                    // A hard gate is a zone's final boss (GDD 9 §4.2); `rulesFor` makes both unfleeable.
                    params: { enemyId: gate.enemyId, kind: gate.isHardGate ? 'zone_boss' : 'mini_boss' },
                  })
                }
                onZoneLayout={(zoneId, y) => offsets.current.set(zoneId, y)}
              />
            </View>
          </ScrollView>

          {/*
            GDD 13 §4.2's two buttons in the thumb zone: Explore wide on the left, Return as an icon
            on the right. The ◆ is the Waymarker's own glyph on the track.
          */}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label={exploring !== null ? 'Searching the road…' : `Explore ${targetName ?? ''}`}
                disabled={target === null || exploring !== null}
                onPress={() => target !== null && explore(target)}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Return to the Road"
              onPress={returnToTheRoad}
              style={({ pressed }) => [styles.recentre, pressed && styles.recentrePressed]}
            >
              <Text style={styles.recentreGlyph}>◆</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { gap: space.xs, paddingBottom: space.sm },
  leagues: { ...type.display, ...tabular, color: colors.accent },
  toNext: { ...type.small, ...tabular, color: colors.textDim },
  viewport: { gap: space.md, paddingBottom: space.md },
  pane: { flex: 1, gap: space.sm },
  hidden: { display: 'none' },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
  recentre: {
    width: MIN_TOUCH_TARGET + space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentrePressed: { opacity: 0.85 },
  recentreGlyph: { fontSize: 18, color: colors.gold },
});
