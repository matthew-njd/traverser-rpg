import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { getDatabase } from '@/db/open';
import { apiBaseUrl } from '@/env';
import {
  DEFAULT_TRAVERSER_NAME,
  MAX_TRAVERSER_NAME_LENGTH,
  registerNewPlayer,
} from '@/onboarding/registration';
import { refreshIdentity, syncNow } from '@/runtime';
import { ApiUnreachableError } from '@/sync/api';
import { Body, Button, Field, Screen, Title } from '@/ui/primitives';
import { MIN_TOUCH_TARGET, colors, space, type } from '@/ui/theme';

/**
 * GDD 10 screen 4 — naming, **plus the birth year** (tech-03 §1.4).
 *
 * The birth-year field is a logged deviation from GDD 10: GDD 1 §2.2 needs `HRmax = 220 − age` and
 * the eleven screens never ask. Health Connect exposes no dependable date-of-birth record.
 *
 * The one screen where an unreachable server is a wall rather than a shrug — registration is one
 * of three things that genuinely require the API (tech-02 §3), so the failure is said out loud.
 */
const MIN_AGE = 10;
const MAX_AGE = 100;

export default function NameYourTraverser() {
  const router = useRouter();
  const [name, setName] = useState(DEFAULT_TRAVERSER_NAME);
  const [birthYear, setBirthYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thisYear = new Date().getFullYear();
  const year = Number(birthYear);
  const validYear =
    /^\d{4}$/.test(birthYear) && thisYear - year >= MIN_AGE && thisYear - year <= MAX_AGE;

  /**
   * tech-04 §4.2 — every screen answers "what does hardware back do here". Here: nothing while a
   * registration is in flight. Recoverable (the id is persisted and `POST /players` is idempotent),
   * but interrupting is not what a back press two seconds after Continue meant.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => busy);

      return () => subscription.remove();
    }, [busy]),
  );

  const register = async () => {
    setBusy(true);
    setError(null);

    try {
      await registerNewPlayer(
        getDatabase(),
        { baseUrl: apiBaseUrl },
        { traverserName: name, birthYear: year },
        Date.now(),
      );

      await refreshIdentity();

      // Sync now, not on the next foreground: the banner reflects the *last* pass, which ran
      // before this screen existed — so the player is asked for a birth year they just typed. This
      // is also the pass that baselines HR, readable only now that the year is in the mirror.
      void syncNow().catch(() => undefined);

      // `replace`, not `push` — onboarding must not survive a back press. Screens 5–7 follow
      // (GDD 10 §5.2, §6, §6.5); the hub is reached from Screen 7, not from here.
      router.replace('/05-loadout');
    } catch (caught) {
      setError(
        caught instanceof ApiUnreachableError
          ? 'The road is quiet — no answer from the server. Check it is running and try again.'
          : 'Something went wrong setting up your Traverser. Try again.',
      );
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.body}>
        <Title>Name your Traverser</Title>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={MAX_TRAVERSER_NAME_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
          hint={`Up to ${MAX_TRAVERSER_NAME_LENGTH} characters.`}
        />

        <Field
          label="Birth year"
          value={birthYear}
          onChangeText={(text) => setBirthYear(text.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="1990"
          hint="Used to work out your heart-rate zones. It stays on your device and in your profile."
        />

        {error === null ? null : <Text style={styles.error}>{error}</Text>}

        <Body dim>
          You can change either of these later in Settings. Changing your birth year adjusts future
          workouts only — earned XP is never taken back.
        </Body>

        {/* M3 note 17: the last screen before the tutorial, which is what closes the restore door. */}
        <Pressable
          accessibilityRole="link"
          disabled={busy}
          onPress={() => router.push('/restore')}
          style={styles.restore}
        >
          <Text style={styles.restoreText}>
            Restoring a traverser instead? Do it now — restore closes once the tutorial starts. ›
          </Text>
        </Pressable>
      </View>

      <Button
        label="Take the first step"
        busy={busy}
        disabled={!validYear}
        onPress={() => void register()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.md, paddingVertical: space.lg },
  error: { ...type.body, color: colors.gold },
  restore: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  restoreText: { ...type.small, color: colors.accent },
});
