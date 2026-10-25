import { useFocusEffect, useRouter } from 'expo-router';
import { type ReactElement, type ReactNode, useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getDatabase } from '@/db/open';
import { loadBattleContent } from '@/battle/content';
import { readEquippedGear, readSnapshot } from '@/battle/mirror';
import { type Loadout, readLoadout } from '@/battle/session';
import { type Labels, loadLabels } from '@/content/labels';
import { type EquippedBonus, effectiveStats } from '@/progression/stats';
import { maxVigorFor, vigorReadout } from '@/progression/vigor';
import { syncNow } from '@/runtime';
import type { ActivityDay } from '@/sync/dto';
import { dayBefore, deviceLocalDates } from '@/health/localDate';
import { type MirrorPlayer, isCredited, isRestTagged, readActivityDays, readPlayer } from '@/sync/mirror';
import { type StatDeltas, allocateStatPoints, setSkills, tagRestDay } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { ActivityLog } from '@/ui/ActivityLog';
import { VigorBar } from '@/ui/battle/VigorBar';
import { HealthBanner } from '@/ui/HealthBanner';
import { Button, Card, Heading, Screen, SegmentedControl } from '@/ui/primitives';
import { RestDay } from '@/ui/RestDay';
import { Streak } from '@/ui/Streak';
import { XpBar } from '@/ui/XpBar';
import { SkillsCard } from '@/ui/SkillsCard';
import { StatPanel } from '@/ui/StatPanel';
import { colors, radius, space, tabular, type } from '@/ui/theme';

/**
 * GDD 13 §3 — the Character tab, and M1's default landing screen.
 *
 * Avatar, Stats, Skills and Activity are sub-views, not routes (tech-04 §4.3) — one route, every
 * pane mounted (§3, amended 2026-10-25).
 */
const ACTIVITY_LOG_LIMIT = 90;

export default function Character() {
  const router = useRouter();
  const [view, setView] = useState<'avatar' | 'stats' | 'skills' | 'activity'>('avatar');
  const [player, setPlayer] = useState<MirrorPlayer | null>(null);
  const [equipped, setEquipped] = useState<readonly EquippedBonus[]>([]);
  const [days, setDays] = useState<readonly ActivityDay[]>([]);
  const [allocating, setAllocating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rested, setRested] = useState(false);
  const [yesterdayOpen, setYesterdayOpen] = useState(false);
  const [fighting, setFighting] = useState(false);
  const [vigor, setVigor] = useState<{ current: number; max: number } | null>(null);
  const [loadout, setLoadout] = useState<Loadout | null>(null);
  const [pendingVigor, setPendingVigor] = useState(0);
  const [labels, setLabels] = useState<Labels>(new Map());

  const slice = usePlayerStore();
  const banner = useAppStore((state) => state.banner);

  // From SQLite, not the store — tech-04 §5.2 hydrates only the hot slice.
  const reload = useCallback(() => {
    const db = getDatabase();

    const mirror = readPlayer(db);

    setPlayer(mirror);

    // Derived on focus, never on a timer — nothing about Vigor ticks (progression/vigor.ts).
    if (mirror === null) {
      setVigor(null);
    } else {
      const max = maxVigorFor(db, mirror);

      setVigor({ current: vigorReadout(mirror, max, Date.now(), deviceLocalDates), max });
    }

    setEquipped(readEquippedGear(db));
    setDays(readActivityDays(db, ACTIVITY_LOG_LIMIT));
    const today = deviceLocalDates.dateOf(Date.now());
    const yesterday = dayBefore(today);

    setRested(isRestTagged(db, today));

    // Not before the account existed — there was no streak that day to protect.
    setYesterdayOpen(
      mirror !== null &&
        yesterday >= deviceLocalDates.dateOf(Date.parse(mirror.createdAt)) &&
        !isCredited(db, yesterday),
    );
    setFighting(readSnapshot(db) !== null);
    setLoadout(mirror === null ? null : readLoadout(db, loadBattleContent(db), mirror.level));
    setLabels(loadLabels(db));
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

  /** GDD 2 §5. Local first; the replay is best-effort, like every write here. */
  const equipSkills = (skillIds: string[]) => {
    if (setSkills(getDatabase(), skillIds, Date.now()) !== null) {
      void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
    }

    reload();
  };

  /**
   * GDD 11 §3.1 — one tap, no cap, no explanation asked for. Vigor is restored locally before the
   * server hears about it, so the confirmation is never waiting on a network the app assumes it
   * does not have.
   */
  const rest = (yesterday: boolean) => {
    const now = Date.now();
    const today = deviceLocalDates.dateOf(now);

    if (tagRestDay(getDatabase(), yesterday ? dayBefore(today) : today, now) === null) {
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
          { value: 'skills', label: 'Skills' },
          { value: 'activity', label: 'Activity' },
        ]}
        value={view}
        onChange={setView}
      />

      {/*
        Every pane stays mounted; `display: none` hides the inactive ones without unmounting them.
        This is what makes the switch free — and it is why the activity log keeps its scroll position.

        A short pane has nothing to scroll, but a `RefreshControl` needs a scrollable host —
        `alwaysBounceVertical` is what makes a short screen still pull. This is the divergence from
        web: there is no page-level scroll to attach a gesture to, so "pull to refresh" is a property
        of a specific scroll view rather than of the screen.

        ↯ The hiding `View` is not redundant. `display: 'none'` on the `ScrollView` itself leaves it
        claiming its `flex: 1` — an invisible full-height block between the tab group and whatever
        follows. A `View` hides properly, so the pane wrapper stays a `View` and the scroll view
        lives inside it.
      */}
      <Pane shown={view === 'avatar'} pull={pull}>
        <Avatar leagues={slice.leagues} lifetimeSteps={slice.lifetimeSteps} />

        <Streak current={slice.streak.current} longest={slice.streak.longest} />

        <RestDay
          name={slice.traverserName}
          tagged={rested}
          fighting={fighting}
          onTag={() => rest(false)}
          onTagYesterday={yesterdayOpen ? () => rest(true) : undefined}
        />
      </Pane>

      <Pane shown={view === 'stats'} pull={pull}>
        {vigor === null ? null : (
          <Card>
            <Heading>Vigour</Heading>
            <VigorBar side="player" vigor={vigor.current} vigorMax={vigor.max} />
            {/* Allocation raises the max only, so current stays put — say so before the confirm. */}
            {pendingVigor > 0 ? (
              <Text style={styles.pending}>
                Max {vigor.max} → {vigor.max + pendingVigor} when confirmed
              </Text>
            ) : null}
          </Card>
        )}

        {player === null ? null : (
          <StatPanel
            unspent={player.unspentStatPoints}
            current={effectiveStats(player, equipped)}
            busy={allocating}
            onConfirm={confirm}
            onDraftChange={(draft) => setPendingVigor(draft.vigor)}
          />
        )}
      </Pane>

      <Pane shown={view === 'skills'} pull={pull}>
        {loadout === null ? null : (
          <SkillsCard
            available={loadout.available}
            equipped={loadout.skills}
            labels={labels}
            fighting={fighting}
            onSet={equipSkills}
          />
        )}
      </Pane>

      {/* The log is its own scroll host — a FlatList inside a ScrollView breaks virtualisation. */}
      <View style={[styles.pane, view === 'activity' ? null : styles.hidden]}>
        <ActivityLog days={days} refreshControl={pull} />
      </View>
    </Screen>
  );
}

function Pane({
  shown,
  pull,
  children,
}: {
  shown: boolean;
  pull: ReactElement<RefreshControlProps>;
  children: ReactNode;
}) {
  return (
    <View style={[styles.pane, shown ? null : styles.hidden]}>
      <ScrollView contentContainerStyle={styles.paneContent} refreshControl={pull} alwaysBounceVertical>
        {children}
      </ScrollView>
    </View>
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


  pending: { ...type.small, ...tabular, color: colors.gold },
  stat: { ...type.display, ...tabular, color: colors.gold },
  statNote: { ...type.small, ...tabular, color: colors.textDim },
});
