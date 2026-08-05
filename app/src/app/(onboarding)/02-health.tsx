import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { healthConnectProvider } from '@/health/healthconnect';
import { Body, Button, Card, Screen, Title } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * GDD 10 screen 2 — health permissions, requested **before any story content**, per the locked
 * ordering in §3.1. The copy below is that section's, verbatim; it is a promise made to the player
 * on screen 2 of 11, before they have agreed to anything, and tech-03 §1.1 is the constraint the
 * entire health pipeline is built around to keep it.
 *
 * ↯ **Never a hard block** (§3.2). Whatever the player chooses — grant, deny, or dismiss — Continue
 * goes to the story. A fitness app that cannot be opened without granting permissions is a bad first
 * impression and risks an uninstall before the player has seen any value. The denied state gets a
 * persistent low-key banner on the Character screen and nothing else.
 *
 * ↯ The result of `requestPermission` is never trusted; `getGrantedPermissions` is the authority
 * (tech-03 §3), and the provider does that internally. Nothing here branches on the answer anyway —
 * which is the point.
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
      // ↯ These reject rather than resolving empty (tech-03 §3). A failure here is not a failure of
      // onboarding — the banner will explain it later, from a state the app re-reads every
      // foreground rather than from anything remembered on this screen.
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
