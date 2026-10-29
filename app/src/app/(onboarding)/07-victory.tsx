import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { deviceLocalDates } from '@/health/localDate';
import { VICTORY_LINE } from '@/onboarding/tutorial';
import { syncNow } from '@/runtime';
import { useBattleStore } from '@/state/battleStore';
import { usePlayerStore } from '@/state/playerStore';
import { Body, Button, Screen, Title } from '@/ui/primitives';
import { colors, radius, space, tabular, type } from '@/ui/theme';

/**
 * GDD 10 Screen 7 (§6.5) — a brief acknowledgment, then the road.
 *
 * ↯ **The XP is not awarded here and is not previewed as a level-up.** `15 + (1 × 2) = 17` is
 * derived server-side from the battle payload this screen queues (T2 §4 step 4); the client shows
 * the arithmetic because it is fixed and visible, but the number that lands in the mirror is the
 * server's. tech-04 §14: a level-up is never projected.
 */
const TUTORIAL_XP = 17;

export default function Victory() {
  const router = useRouter();
  const [settled, setSettled] = useState(false);

  // Settle once, on mount. The store is idempotent, but an effect that re-ran would still re-hydrate
  // and re-sync for nothing.
  useEffect(() => {
    const db = getDatabase();

    useBattleStore.getState().settle(db, deviceLocalDates.dateOf(Date.now()));
    usePlayerStore.getState().hydrate(db);
    setSettled(true);

    // Best-effort. The battle is durable in the outbox, so an unreachable server (the ordinary case,
    // tech-02 §1.2) costs nothing but the XP arriving on the next foreground.
    void syncNow().catch(() => undefined);
  }, []);

  return (
    <Screen>
      <View style={styles.body}>
        <Title>{VICTORY_LINE}</Title>

        <View style={styles.plate}>
          <Text style={styles.plateGlyph}>✦</Text>
        </View>

        <Body dim>
          The Wisp scatters back into the road it came from. Nothing to carry off — but the walking
          counts from here.
        </Body>

        <Text style={styles.xp}>+{TUTORIAL_XP} XP</Text>
      </View>

      <Button
        label="Begin your journey"
        disabled={!settled}
        onPress={() => router.replace('/10-notifications')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.md },
  plate: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.marble,
    borderRadius: radius.md,
  },
  plateGlyph: { fontSize: 72, color: colors.background },
  xp: { ...type.display, ...tabular, color: colors.gold, textAlign: 'center' },
});
