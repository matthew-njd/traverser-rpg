import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Share, StyleSheet, Text, View } from 'react-native';

import { readContentRows } from '@/content/bundle';
import { getDatabase } from '@/db/open';
import { parked } from '@/db/outbox';
import { apiBaseUrl } from '@/env';
import { healthConnectProvider } from '@/health/healthconnect';
import {
  RestoreError,
  handOverTo,
  isProfileReplaceable,
  parseIdentityDocument,
} from '@/onboarding/registration';
import { currentIdentity, refreshIdentity, syncNow } from '@/runtime';
import { ApiStatusError, ApiUnreachableError } from '@/sync/api';
import { readBirthYear, readPlayer } from '@/sync/mirror';
import { MIN_DAILY_STEP_GOAL, changeSettings } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { Body, Button, Card, Field, Heading, Screen } from '@/ui/primitives';
import { colors, radius, space, type } from '@/ui/theme';

/**
 * GDD 13 §7 — Settings, at M1's scope.
 *
 * Here: identity export (tech-06 §13.1), step goal, birth year, health status and deep link.
 * Not here: audio sliders and notifications (M5), wearables, sign-in (guest-only is a sanctioned trim).
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
    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  return (
    <Screen scroll>
      <IdentityExport />
      <IdentityImport />

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

      <StuckUploads />

      <DebugEncounters />
    </Screen>
  );
}

/**
 * M2 plan §3.3 — non-tutorial battles are **started from a debug control, not earned**.
 *
 * Encounter grants are T2 §4 step 8 and land at M3 with the Road. Without this the engine would only
 * ever run the scripted tutorial, which bypasses crits, variance *and* the type chart (GDD 10 §6.1)
 * and so exercises almost none of what M2 built.
 *
 * ↯ **This is the one thing M2 ships intending to remove.** `__DEV__` is compile-time in a release
 * bundle, so the whole card is dropped by the minifier rather than merely hidden — but it is deleted
 * outright at M3, when real encounters replace it.
 */
function DebugEncounters() {
  const router = useRouter();
  const level = usePlayerStore((state) => state.level);

  if (!__DEV__) {
    return null;
  }

  const enemies = readContentRows(getDatabase(), 'enemy').filter(
    (row) => row.zone_id === 'olympion',
  );

  return (
    <Card>
      <Heading>Debug encounters</Heading>
      <Body dim>
        Fights any Olympion enemy at your level ({level}). Not earned, and gone at M3 when the Road
        grants encounters.
      </Body>

      {enemies.map((row) => (
        <Button
          key={String(row.id)}
          variant="secondary"
          label={String(row.display_name)}
          onPress={() => router.push({ pathname: '/battle', params: { enemyId: String(row.id) } })}
        />
      ))}
    </Card>
  );
}

/**
 * tech-06 §13.1 — the manual export half of the restore path, and the fourth member of §10.5's set.
 *
 * `player_id` and the token live only in app storage (tech-04 §6.5), so a Postgres dump restored
 * onto new hardware holds history **no client can claim**. Known weakness, stated in §13.1: it only
 * helps if used *before* the loss — hence the prominence and the blunt copy.
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

/**
 * tech-06 §13.1's import half, amended in 2026-08-16: the restore branch used to exist only on the
 * splash screen, so a player who tapped past it once could not reach it again without reinstalling.
 *
 * Offered **only while the local profile carries nothing irreversible** (`isProfileReplaceable`).
 * That is the whole safety model — this control can strand a throwaway profile on the server, and
 * must never be able to replace a real save. Steps do not disqualify it: the hand-over clears the
 * watermarks and the next sync re-mints the last 72 hours for the restored player.
 */
function IdentityImport() {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read on every render rather than held in state: allocating a point on the Character screen must
  // close this door, and nothing here would otherwise know that happened.
  if (currentIdentity() === null || !isProfileReplaceable(getDatabase())) {
    return null;
  }

  const parsed = parseIdentityDocument(pasted);

  const confirm = () => {
    if (parsed === null) {
      return;
    }

    // ↯ `Alert.alert`, not a custom modal. This is the one destructive action in the app, and the
    // system dialog is the one surface a player already reads as "this is not an ordinary tap".
    Alert.alert(
      'Replace this profile?',
      'The traverser on this device will be replaced by the one in the file you pasted, and this ' +
        'device will stop being able to reach it. The profile you are leaving is not deleted from ' +
        'the server — it stays claimable by its own exported identity.\n\n' +
        'Steps from the last three days are re-read after the swap and are not lost.',
      [
        { text: 'Keep this profile', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => void handOver() },
      ],
    );
  };

  const handOver = async () => {
    if (parsed === null) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await handOverTo(getDatabase(), { baseUrl: apiBaseUrl }, parsed);
      await refreshIdentity();

      // The restored profile's history arrives from the server, and the re-minted steps with it.
      void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);

      setOpen(false);
      setPasted('');
    } catch (caught) {
      setError(messageForRestore(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Heading>Restore a different identity</Heading>
      <Body dim>
        This device is carrying a new traverser with no progress on it. If you meant to restore an
        exported identity, you can still do it here.
      </Body>

      {open ? (
        <>
          <Field
            label="Exported identity"
            value={pasted}
            onChangeText={(text) => {
              setPasted(text);
              setError(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            placeholder="Paste the whole file, or just the token"
            hint={
              pasted.trim() === ''
                ? 'The exported JSON, or the token on its own.'
                : parsed === null
                  ? 'That looks like an incomplete file — paste it whole, or paste just the token.'
                  : parsed.playerId === null
                    ? 'Token only — the server will say which profile it belongs to.'
                    : `Identity for ${parsed.playerId.slice(0, 8)}…`
            }
          />

          {error === null ? null : <Text style={styles.error}>{error}</Text>}

          <Button label="Restore" busy={busy} disabled={parsed === null} onPress={confirm} />
          <Button
            label="Cancel"
            variant="secondary"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setError(null);
            }}
          />
        </>
      ) : (
        <Button label="Restore from a backup" variant="secondary" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

function messageForRestore(caught: unknown): string {
  if (caught instanceof ApiUnreachableError) {
    return 'The road is quiet — no answer from the server. A restore needs it reachable.';
  }

  if (caught instanceof RestoreError) {
    return caught.message;
  }

  if (caught instanceof ApiStatusError && caught.status === 401) {
    return 'That token was not accepted. Check the file was pasted whole.';
  }

  return 'That identity could not be restored.';
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
        Deep-links to settings and never re-requests (tech-03 §3). Android suppresses repeat
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

/**
 * Entries the drain has given up on (T2 §5). Nothing here fixes one — the point is that it stops
 * being invisible, which is how the M2 poisoned drop cost two days (DECISIONS 2026-08-20).
 */
function StuckUploads() {
  const [stuck, setStuck] = useState<readonly { clientOpId: string; kind: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      setStuck(parked(getDatabase()));
    }, []),
  );

  if (stuck.length === 0) {
    return null;
  }

  return (
    <Card>
      <Heading>Stuck uploads</Heading>

      <Body dim>
        The server refused these repeatedly, so the app stopped retrying them. Nothing else is
        blocked, and nothing has been lost — they are still on the device.
      </Body>

      <View style={styles.rows}>
        {stuck.map((entry) => (
          <Row key={entry.clientOpId} label={entry.kind} value={entry.clientOpId.slice(0, 8)} />
        ))}
      </View>
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
  error: { ...type.body, color: colors.gold },
  rows: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...type.body, color: colors.textDim },
  rowValue: { ...type.body, color: colors.text },
});
