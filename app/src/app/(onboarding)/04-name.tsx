import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
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
import { colors, space, type } from '@/ui/theme';

/**
 * GDD 10 screen 4 — naming, **plus the birth year** (tech-03 §1.4).
 *
 * ↯ The birth-year field is a **logged deviation from GDD 10**, not an addition of convenience. GDD
 * 1 §2.2 requires `HRmax = 220 − age` and GDD 10's eleven screens never ask for it — a genuine gap
 * between two locked specs. It lands here because it is one tap on a screen the player is already
 * filling in, and because it has to happen before any HR data could be misclassified. Health Connect
 * exposes no dependable date-of-birth record, so reading it from the platform is not an option.
 *
 * ↯ This is also the one screen in the app where an unreachable server is a **wall** rather than a
 * shrug. Registration is one of only three things that genuinely require the API (tech-02 §3), so
 * the failure has to be said out loud here instead of being queued like everything else.
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
   * ↯ tech-04 §4.2 — every screen needs an explicit answer to "what does hardware back do here".
   * The answer for this one: **nothing, while a registration is in flight.** Backing out mid-request
   * would leave the server holding a profile the device is no longer trying to claim. It is not
   * unrecoverable — the `player_id` is persisted before the call and `POST /players` is idempotent
   * on it, so a retry reclaims the same profile — but interrupting is still never what the player
   * meant by a back press two seconds after tapping Continue.
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

      // ↯ Sync immediately, rather than waiting for the next foreground. Two reasons, both observed
      // at P9: the health banner is whatever the *last* pass concluded, and the last pass ran before
      // this screen existed — so a player who has just typed their birth year gets asked for it again
      // until they background the app. And this is the pass that baselines heart rate, which only
      // became readable a moment ago when the birth year landed in the mirror.
      void syncNow().catch(() => undefined);

      // `replace`, not `push` — onboarding must not be reachable by a back press once it is done.
      router.replace('/character');
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
});
