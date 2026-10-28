import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, type ColorValue } from 'react-native';

import { type FreshReward, clearFreshRewards, isRoadFind, readFreshRewards } from '@/battle/mirror';
import { type Labels, type RevealDetail, loadLabels, loadRevealDetails } from '@/content/labels';
import { getDatabase } from '@/db/open';
import { type Overflow, readOverflow } from '@/progression/overflow';
import { syncNow } from '@/runtime';
import { discardGear, discardItem, resolvePendingReward } from '@/sync/writes';
import { type OverflowPick, OverflowPrompt } from '@/ui/OverflowPrompt';
import { useAppStore } from '@/state/appStore';
import { fightOpen, useBattleStore } from '@/state/battleStore';
import { RewardReveal } from '@/ui/RewardReveal';
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
 *
 * Step 10's rewards surface here because the bar is on screen whichever tab the sync lands on: road
 * finds as the Satchel's badge (GDD 13 §5.2), everything else as a reveal (§6.3).
 */
export default function TabsLayout() {
  const rewardsSeq = useAppStore((state) => state.rewardsSeq);
  // ↯ A Modal is drawn over every route, the battle included, so the reveal waits out the fight.
  const fighting = useBattleStore(fightOpen);
  const levelUps = useAppStore((state) => state.pendingLevelUps);
  const [fresh, setFresh] = useState<readonly FreshReward[]>([]);
  const [labels, setLabels] = useState<Labels>(new Map());
  const [details, setDetails] = useState<ReadonlyMap<string, RevealDetail>>(new Map());
  const [overflow, setOverflow] = useState<Overflow | null>(null);

  // Re-read when a fight ends too: a battle drop is what most often passes a cap.
  useEffect(() => {
    const db = getDatabase();
    const rewards = readFreshRewards(db);
    const owed = readOverflow(db);

    setFresh(rewards);
    setOverflow(owed);

    if (rewards.length > 0 || owed !== null) {
      setLabels(loadLabels(db));
      setDetails(loadRevealDetails(db));
    }
  }, [rewardsSeq, fighting]);

  /** GDD 4 §5.2 — local first; the replays are best-effort, like every write. */
  const settleOverflow = (keep: boolean, pick: OverflowPick | null) => {
    if (overflow === null) {
      return;
    }

    const db = getDatabase();
    const now = Date.now();
    const discard = overflow.kind === 'item' ? discardItem : discardGear;

    if (pick !== null && !pick.incoming) {
      discard(db, pick.id, now);
    }

    if (overflow.pendingId !== null) {
      resolvePendingReward(db, overflow.pendingId, keep || (pick !== null && !pick.incoming), now);
    } else if (pick?.incoming && overflow.incoming.id !== null) {
      discard(db, overflow.incoming.id, now);
    }

    useAppStore.getState().rewardsChanged();
    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  const roadFinds = fresh.filter(isRoadFind).length;
  const reveal = fighting ? [] : fresh.filter((reward) => !isRoadFind(reward));

  return (
    <>
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
          options={{ title: 'Road', tabBarIcon: ({ color }) => <Glyph color={color}>◇</Glyph> }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: 'Satchel',
            tabBarIcon: ({ color }) => <Glyph color={color}>▣</Glyph>,
            tabBarBadge: roadFinds > 0 ? roadFinds : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.accentText },
          }}
        />
      </Tabs>

      <RewardReveal
        levelUps={fighting ? [] : levelUps}
        rewards={reveal}
        labels={labels}
        details={details}
        onDone={() => {
          clearFreshRewards(getDatabase(), reveal.map((reward) => reward.id));
          useAppStore.getState().consumeLevelUps();
          useAppStore.getState().rewardsChanged();
        }}
      />

      <OverflowPrompt
        overflow={fighting || reveal.length > 0 || levelUps.length > 0 ? null : overflow}
        labels={labels}
        onLeave={(pick) => settleOverflow(false, pick)}
        onKeep={() => settleOverflow(true, null)}
      />
    </>
  );
}

function Glyph({ color, children }: { color: ColorValue; children: string }) {
  return <Text style={{ color, fontSize: 18 }}>{children}</Text>;
}
