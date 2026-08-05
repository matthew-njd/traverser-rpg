import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { effectiveStats } from '@/progression/stats';
import { syncNow } from '@/runtime';
import type { ActivityDay } from '@/sync/dto';
import { type MirrorPlayer, readActivityDays, readPlayer } from '@/sync/mirror';
import { type StatDeltas, allocateStatPoints } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { ActivityLog } from '@/ui/ActivityLog';
import { HealthBanner } from '@/ui/HealthBanner';
import { Card, Heading, Screen, SegmentedControl } from '@/ui/primitives';
import { XpBar } from '@/ui/XpBar';
import { StatPanel } from '@/ui/StatPanel';
import { colors, radius, space, type } from '@/ui/theme';

/**
 * GDD 13 §3 — the Character tab, and M1's default landing screen.
 *
 * ↯ Avatar and Stats are **sub-views, not routes** (tech-04 §4.3). Both are rendered from one route
 * with a segmented control, so switching loses no state and re-runs no effect. A nested navigator
 * would also satisfy GDD 13's "no state loss", but a route change in React Native remounts and
 * re-runs effects far more visibly than a web route change with a warm DOM.
 *
 * M1 scope: no streak badge and no Rest Day control — both are GDD 11, which is M4.
 */
const ACTIVITY_LOG_LIMIT = 90;

export default function Character() {
  const router = useRouter();
  const [view, setView] = useState<'avatar' | 'stats'>('avatar');
  const [player, setPlayer] = useState<MirrorPlayer | null>(null);
  const [days, setDays] = useState<readonly ActivityDay[]>([]);
  const [allocating, setAllocating] = useState(false);

  const slice = usePlayerStore();
  const banner = useAppStore((state) => state.banner);
  const lastServerOutcome = useAppStore((state) => state.lastServerOutcome);

  // ↯ Read from SQLite rather than the store. tech-04 §5.2 keeps only the small hot slice hydrated;
  // the allocation columns and the activity log are queried on demand, because a growing table
  // cached in memory is how a store becomes the thing that has to be invalidated. Re-runs when a
  // sync lands, which is the only thing that changes them behind this screen's back.
  useFocusEffect(
    useCallback(() => {
      const db = getDatabase();

      setPlayer(readPlayer(db));
      setDays(readActivityDays(db, ACTIVITY_LOG_LIMIT));
    }, [lastServerOutcome, allocating]),
  );

  const confirm = (deltas: StatDeltas) => {
    setAllocating(true);

    try {
      allocateStatPoints(getDatabase(), deltas, Date.now());

      // SQLite first, store second, always. The allocation is already durable and queued for replay
      // by the time either of these runs.
      usePlayerStore.getState().hydrate(getDatabase());
      setPlayer(readPlayer(getDatabase()));

      // Best-effort: if the server is reachable the points land now, and if it is not they replay on
      // the next foreground. Either way the screen already shows them.
      void syncNow().catch(() => undefined);
    } finally {
      setAllocating(false);
    }
  };

  return (
    <Screen>
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
      <View style={[styles.pane, view === 'avatar' ? null : styles.hidden]}>
        <Avatar leagues={slice.leagues} lifetimeSteps={slice.lifetimeSteps} />
      </View>

      <View style={[styles.pane, view === 'stats' ? null : styles.hidden]}>
        {player === null ? null : (
          <StatPanel
            unspent={player.unspentStatPoints}
            current={effectiveStats(player)}
            busy={allocating}
            onConfirm={confirm}
          />
        )}

        <Heading>Activity</Heading>
        <ActivityLog days={days} />
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

  pane: { flex: 1, gap: space.md },
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

  stat: { ...type.display, color: colors.gold },
  statNote: { ...type.small, color: colors.textDim },
});
