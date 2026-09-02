import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { readEquippedGear, readSnapshot } from '@/battle/mirror';
import { type EquippedBonus, effectiveStats } from '@/progression/stats';
import { syncNow } from '@/runtime';
import type { ActivityDay } from '@/sync/dto';
import { deviceLocalDates } from '@/health/localDate';
import { type MirrorPlayer, isRestTagged, readActivityDays, readPlayer } from '@/sync/mirror';
import { type StatDeltas, allocateStatPoints, tagRestDay } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { ActivityLog } from '@/ui/ActivityLog';
import { HealthBanner } from '@/ui/HealthBanner';
import { Button, Card, Heading, Screen, SegmentedControl } from '@/ui/primitives';
import { RestDay } from '@/ui/RestDay';
import { XpBar } from '@/ui/XpBar';
import { StatPanel } from '@/ui/StatPanel';
import { colors, radius, space, tabular, type } from '@/ui/theme';

/**
 * GDD 13 §3 — the Character tab, and M1's default landing screen.
 *
 * Avatar and Stats are sub-views, not routes (tech-04 §4.3) — one route, both panes mounted.
 *
 * The streak badge is still GDD 11's and still M4. The Rest Day control landed early with Vigor
 * recovery (GDD 2 §6) — it is the same one tap, and the Vigor half of it is buildable now.
 */
const ACTIVITY_LOG_LIMIT = 90;

export default function Character() {
  const router = useRouter();
  const [view, setView] = useState<'avatar' | 'stats'>('avatar');
  const [player, setPlayer] = useState<MirrorPlayer | null>(null);
  const [equipped, setEquipped] = useState<readonly EquippedBonus[]>([]);
  const [days, setDays] = useState<readonly ActivityDay[]>([]);
  const [allocating, setAllocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rested, setRested] = useState(false);
  const [fighting, setFighting] = useState(false);

  const slice = usePlayerStore();
  const banner = useAppStore((state) => state.banner);

  // From SQLite, not the store — tech-04 §5.2 hydrates only the hot slice.
  const reload = useCallback(() => {
    const db = getDatabase();

    setPlayer(readPlayer(db));
    setEquipped(readEquippedGear(db));
    setDays(readActivityDays(db, ACTIVITY_LOG_LIMIT));
    setRested(isRestTagged(db, deviceLocalDates.dateOf(Date.now())));
    setFighting(readSnapshot(db) !== null);
  }, []);

  // `lastServerOutcome` is a poor change signal — two successful syncs both read `'synced'`, so
  // nothing re-renders. Every mirror-touching path calls `reload()` directly; this covers refocus.
  useFocusEffect(reload);

  /**
   * Pull to sync. `syncNow` de-duplicates, so a pull landing on the automatic pass joins it.
   *
   * A failed pass is not an error (tech-02 §1.2) — the spinner stops and the screen shows what is
   * already durable.
   */
  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await syncNow();
    } catch {
      // Offline is the ordinary outcome; the deltas are queued either way.
    } finally {
      reload();
      setRefreshing(false);
    }
  }, [reload]);

  const pull = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={() => void refresh()}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.surface}
    />
  );

  const confirm = (deltas: StatDeltas) => {
    setAllocating(true);

    try {
      allocateStatPoints(getDatabase(), deltas, Date.now());

      // SQLite first, store second, always.
      usePlayerStore.getState().hydrate(getDatabase());
      reload();

      // Best-effort — they replay on the next foreground either way.
      void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
    } finally {
      setAllocating(false);
    }
  };

  /**
   * GDD 11 §3.1 — one tap, no cap, no explanation asked for. Vigor is restored locally before the
   * server hears about it, so the confirmation is never waiting on a network the app assumes it
   * does not have.
   */
  const rest = () => {
    const now = Date.now();

    if (tagRestDay(getDatabase(), deviceLocalDates.dateOf(now), now) === null) {
      return;
    }

    usePlayerStore.getState().hydrate(getDatabase());
    reload();

    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  return (
    <Screen tabbed>
      <View style={styles.header}>
        <Text style={styles.name}>{slice.traverserName || 'Traverser'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => router.push('/settings')}
          style={styles.gear}
        >
          <Text style={styles.gearGlyph}>⚙</Text>
        </Pressable>
      </View>

      <XpBar level={slice.level} xpCurrent={slice.xpCurrent} xpToNext={slice.xpToNext} />

      {banner === null ? null : (
        <HealthBanner kind={banner} onOpenAppSettings={() => router.push('/settings')} />
      )}

      <SegmentedControl
        options={[
          { value: 'avatar', label: 'Avatar' },
          { value: 'stats', label: 'Stats' },
        ]}
        value={view}
        onChange={setView}
      />

      {/*
        Both panes stay mounted; `display: none` hides the inactive one without unmounting it. This
        is what makes the switch free — and it is why the activity log keeps its scroll position.
      */}
      {/*
        The Avatar pane has nothing to scroll, but a `RefreshControl` needs a scrollable host —
        `alwaysBounceVertical` is what makes a short screen still pull. This is the divergence from
        web: there is no page-level scroll to attach a gesture to, so "pull to refresh" is a property
        of a specific scroll view rather than of the screen.

        ↯ The hiding `View` is not redundant. `display: 'none'` on the `ScrollView` itself leaves it
        claiming its `flex: 1` — an invisible full-height block between the tab group and whatever
        follows. A `View` hides properly, so the pane wrapper stays a `View` and the scroll view
        lives inside it.
      */}
      <View style={[styles.pane, view === 'avatar' ? null : styles.hidden]}>
        <ScrollView
          contentContainerStyle={styles.paneContent}
          refreshControl={pull}
          alwaysBounceVertical
        >
          <Avatar leagues={slice.leagues} lifetimeSteps={slice.lifetimeSteps} />

          <RestDay name={slice.traverserName} tagged={rested} fighting={fighting} onTag={rest} />
        </ScrollView>
      </View>

      {/*
        ↯ One scroll host for the whole pane, with the stat panel as the list's header. Rendering the
        card beside the list instead leaves the top of the screen — where a pull actually starts — as
        a plain `View`, so the gesture never reaches the list and only the strip below the heading
        responds. Wrapping both in a `ScrollView` would fix the gesture and nest a VirtualizedList,
        which trades a dead gesture for a broken list.
      */}
      <View style={[styles.statsPane, view === 'stats' ? null : styles.hidden]}>
        <ActivityLog
          days={days}
          refreshControl={pull}
          header={
            <View style={styles.statsHeader}>
              {player === null ? null : (
                <StatPanel
                  unspent={player.unspentStatPoints}
                  current={effectiveStats(player, equipped)}
                  busy={allocating}
                  onConfirm={confirm}
                />
              )}

              <Heading>Activity</Heading>
            </View>
          }
        />
      </View>
    </Screen>
  );
}

/** Placeholder until the art phase (tech-04 §9.3). The layered-gear sprite is M3. */
function Avatar({ leagues, lifetimeSteps }: { leagues: number; lifetimeSteps: number }) {
  return (
    <View style={styles.avatarPane}>
      <View style={styles.sprite}>
        <Text style={styles.spriteGlyph}>ᛝ</Text>
      </View>

      <Card>
        <Heading>The Waymarker</Heading>
        <Text style={styles.stat}>{leagues.toLocaleString()} leagues</Text>
        <Text style={styles.statNote}>{lifetimeSteps.toLocaleString()} lifetime steps</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.title, color: colors.text },
  gear: { padding: space.sm },
  gearGlyph: { fontSize: 20, color: colors.textDim },

  pane: { flex: 1 },
  paneContent: { gap: space.md, paddingBottom: space.md },
  statsPane: { flex: 1 },
  statsHeader: { gap: space.md, paddingBottom: space.md },
  hidden: { display: 'none' },

  avatarPane: { flex: 1, gap: space.lg, alignItems: 'stretch' },
  sprite: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spriteGlyph: { fontSize: 72, color: colors.accent },


  stat: { ...type.display, ...tabular, color: colors.gold },
  statNote: { ...type.small, ...tabular, color: colors.textDim },
});
