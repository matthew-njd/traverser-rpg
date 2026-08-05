import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { healthConnectProvider } from '@/health/healthconnect';
import { currentIdentity, syncNow } from '@/runtime';
import { readBirthYear, readPlayer } from '@/sync/mirror';
import { MIN_DAILY_STEP_GOAL, changeSettings } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { Body, Button, Card, Field, Heading, Screen } from '@/ui/primitives';
import { colors, radius, space, type } from '@/ui/theme';

/**
 * GDD 13 §7 — Settings, at M1's scope.
 *
 * Here: identity export (tech-06 §13.1), daily step goal, birth year, health permission status and
 * deep link. **Not** here: audio sliders (M5 owns the bus, and a slider that controls nothing is a
 * promise the app does not keep), notifications (M5), wearable connections, and sign-in (guest-only
 * is a sanctioned trim).
 */
export default function Settings() {
  const slice = usePlayerStore();
  const health = useAppStore((state) => state.health);

  const [goal, setGoal] = useState(String(slice.dailyStepGoal));
  const [birthYear, setBirthYear] = useState(
    String(readBirthYear(getDatabase()) ?? ''),
  );
  const [saved, setSaved] = useState(false);

  const goalValue = Number(goal);
  const yearValue = Number(birthYear);
  const goalValid = /^\d+$/.test(goal) && goalValue >= MIN_DAILY_STEP_GOAL;
  const yearValid = birthYear === '' || /^\d{4}$/.test(birthYear);

  const save = () => {
    changeSettings(
      getDatabase(),
      {
        dailyStepGoal: goalValid ? goalValue : null,
        birthYear: yearValid && birthYear !== '' ? yearValue : null,
      },
      Date.now(),
    );

    usePlayerStore.getState().hydrate(getDatabase());
    setSaved(true);

    // Replays with the next pass whether or not this one reaches the server.
    void syncNow().catch(() => undefined);
  };

  return (
    <Screen scroll>
      <IdentityExport />

      <Card>
        <Heading>Daily step goal</Heading>
        <Field
          label="Steps"
          value={goal}
          onChangeText={(text) => {
            setGoal(text.replace(/\D/g, ''));
            setSaved(false);
          }}
          keyboardType="number-pad"
          hint={
            goalValid && goalValue === MIN_DAILY_STEP_GOAL
              ? 'Every road starts somewhere. This one counts.'
              : `At least ${MIN_DAILY_STEP_GOAL.toLocaleString()} steps.`
          }
        />
      </Card>

      <Card>
        <Heading>Birth year</Heading>
        <Field
          label="Year"
          value={birthYear}
          onChangeText={(text) => {
            setBirthYear(text.replace(/\D/g, '').slice(0, 4));
            setSaved(false);
          }}
          keyboardType="number-pad"
          placeholder="1990"
          hint="Sets your heart-rate zones. Changing it affects future workouts only — earned XP is never taken back."
        />
      </Card>

      <Button label={saved ? 'Saved' : 'Save'} disabled={!goalValid || !yearValid} onPress={save} />

      <HealthStatus
        availability={health?.availability ?? null}
        steps={health?.permissions.steps ?? false}
        heartRate={health?.permissions.heartRate ?? false}
      />
    </Screen>
  );
}

/**
 * tech-06 §13.1 — the manual export half of the restore path, and the fourth member of §10.5's
 * backup set.
 *
 * ↯ §10.1 is the reason this screen exists at all: `player_id` and the bearer token live only in app
 * storage (tech-04 §6.5), so a perfect Postgres dump restored onto new hardware is a database full
 * of history that **no client can claim**. A backup plan covering only Postgres restores data nobody
 * can reach.
 *
 * ↯ Its known weakness, stated in §13.1 and not solvable here: it only helps if it was used *before*
 * the loss. Hence the prominence, and hence the copy saying so plainly rather than burying it.
 *
 * `Share` is React Native's own module — no dependency, no rebuild — and the values are also
 * `selectable` so they can be copied by hand if no share target is convenient.
 */
function IdentityExport() {
  const identity = currentIdentity();
  const [revealed, setRevealed] = useState(false);

  if (identity === null) {
    return null;
  }

  const document = JSON.stringify(
    {
      player_id: identity.playerId,
      token: identity.token,
      exported_at: new Date().toISOString(),
      note: 'Traverser identity. Restore with this on first launch after a reinstall.',
    },
    null,
    2,
  );

  return (
    <Card>
      <Heading>Identity export</Heading>
      <Body dim>
        Uninstalling the app destroys the only copy of your identity on this device, and without it
        your history on the server cannot be claimed back. Save this somewhere safe now — it is no
        help after the fact.
      </Body>

      <Button
        label="Export identity"
        onPress={() => {
          void Share.share({ message: document }).catch(() => undefined);
        }}
      />
      <Button
        label={revealed ? 'Hide' : 'Show it instead'}
        variant="secondary"
        onPress={() => setRevealed(!revealed)}
      />

      {revealed ? (
        <Text selectable style={styles.export}>
          {document}
        </Text>
      ) : null}
    </Card>
  );
}

function HealthStatus({
  availability,
  steps,
  heartRate,
}: {
  availability: string | null;
  steps: boolean;
  heartRate: boolean;
}) {
  return (
    <Card>
      <Heading>Health &amp; activity</Heading>

      {availability === null ? (
        <Body dim>Not checked yet — this updates on the next sync.</Body>
      ) : (
        <View style={styles.rows}>
          <Row label="Health Connect" value={availability.replace('_', ' ')} />
          <Row label="Steps" value={steps ? 'granted' : 'not granted'} />
          <Row label="Heart rate" value={heartRate ? 'granted' : 'not granted'} />
        </View>
      )}

      {/*
        ↯ Deep-links to settings and never re-requests (tech-03 §3). Android suppresses repeat
        prompts after a denial, so a button that called `requestPermission` again would look broken.
      */}
      <Button
        label="Open Health Connect settings"
        variant="secondary"
        onPress={() => healthConnectProvider.openSettings()}
      />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  export: {
    ...type.mono,
    color: colors.textDim,
    backgroundColor: colors.background,
    padding: space.sm,
    borderRadius: radius.sm,
  },
  rows: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...type.body, color: colors.textDim },
  rowValue: { ...type.body, color: colors.text },
});
