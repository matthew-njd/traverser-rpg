import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { healthConnectProvider } from '@/health/healthconnect';
import { Body, Button, Card, Screen, Title } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * GDD 10 screen 2 — permissions before any story content (§3.1). The copy is that section's
 * verbatim, and tech-03 §1.1 is the constraint the health pipeline is built around to keep it.
 *
 * Never a hard block (§3.2): grant, deny or dismiss, Continue goes to the story. Nothing here
 * branches on the answer — which is the point, and why `requestPermission`'s result is unused.
 */
export default function HealthPermission() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const request = async () => {
    setBusy(true);

    try {
      const availability = await healthConnectProvider.availability();

      if (availability === 'available') {
        await healthConnectProvider.initialize();
        await healthConnectProvider.requestPermissions();
      }
    } catch {
      // These reject rather than resolving empty (tech-03 §3), and a failure is not a failure of
      // onboarding — the banner explains it later from re-read state, not from anything held here.
    } finally {
      setBusy(false);
      router.push('/03-story');
    }
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Title>Traverser turns your steps and workouts into real progress.</Title>

        <Card>
          <Body>
            We&apos;ll need access to your step count and heart rate to bring the road to life. Your
            health data never leaves your device — only summaries (like daily totals) sync to your
            Traverser profile.
          </Body>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button label="Continue" busy={busy} onPress={() => void request()} />
        <Button
          label="Not now"
          variant="secondary"
          disabled={busy}
          onPress={() => router.push('/03-story')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg },
  actions: { gap: space.sm },
});
