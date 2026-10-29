import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { askForNudges } from '@/notifications/nudge';
import { rescheduleNudges } from '@/runtime';
import { Body, Button, Card, Screen, Title } from '@/ui/primitives';
import { space } from '@/ui/theme';

/**
 * GDD 10 Screen 10 (§3.3, §8.3) — after the tutorial, never at first launch. Screens 8 and 9 are
 * trimmed (the full Road replaced the placeholder map; guest-only has no account prompt).
 *
 * Grant, deny or dismiss, the road follows: nothing here branches on the answer except whether a
 * nudge gets scheduled.
 */
export default function NotificationPermission() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onward = () => router.replace('/map');

  const request = async () => {
    setBusy(true);

    try {
      if (await askForNudges()) {
        rescheduleNudges();
      }
    } catch {
      // A failed prompt is a reminder not set, which Settings can still fix.
    } finally {
      setBusy(false);
      onward();
    }
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Title>We&apos;ll gently remind you when the road is waiting — nothing pushy.</Title>

        <Card>
          <Body>
            One reminder at 7 PM, and only on a day you haven&apos;t reached your goal or tagged for
            rest.
          </Body>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button label="Allow reminders" busy={busy} onPress={() => void request()} />
        <Button label="Not now" variant="secondary" disabled={busy} onPress={onward} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.lg },
  actions: { gap: space.sm },
});
