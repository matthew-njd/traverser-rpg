import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Share, StyleSheet, Switch, Text, View } from 'react-native';

import credits from '../../art/credits.json';
import { configureAudio, playSfx } from '@/audio/bus';
import { getDatabase } from '@/db/open';
import { parked } from '@/db/outbox';
import { apiBaseUrl } from '@/env';
import { healthConnectProvider } from '@/health/healthconnect';
import { EARLIEST_HOUR, LATEST_HOUR, askForNudges, nudgePermission, reminderWindow } from '@/notifications/nudge';
import {
  RestoreError,
  handOverTo,
  isProfileReplaceable,
  parseIdentityDocument,
} from '@/onboarding/registration';
import { currentIdentity, refreshIdentity, rescheduleNudges, syncNow } from '@/runtime';
import { ApiStatusError, ApiUnreachableError } from '@/sync/api';
import { type AudioSettings, readAudioSettings, readBirthYear, readPlayer, readReminderHour } from '@/sync/mirror';
import { MIN_DAILY_STEP_GOAL, changeSettings } from '@/sync/writes';
import { useAppStore } from '@/state/appStore';
import { usePlayerStore } from '@/state/playerStore';
import { Body, Button, Card, Field, Heading, Screen } from '@/ui/primitives';
import { MIN_TOUCH_TARGET, colors, radius, space, type } from '@/ui/theme';

/**
 * GDD 13 §7 — Settings, at M1's scope.
 *
 * Here: identity export (tech-06 §13.1), step goal, birth year, audio, notifications, health status
 * and deep link.
 * Not here: wearables, sign-in (guest-only is a sanctioned trim).
 */
export default function Settings() {
  const slice = usePlayerStore();

  // GDD 14 §6.3 — Settings is the pushed screen; its back is the pop.
  useEffect(() => {
    playSfx('sfx_screen_push');

    return () => playSfx('sfx_screen_pop');
  }, []);
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

      <Audio />

      <Reminders />

      <HealthStatus
        availability={health?.availability ?? null}
        steps={health?.permissions.steps ?? false}
        heartRate={health?.permissions.heartRate ?? false}
      />

      <StuckUploads />

      <Credits />
    </Screen>
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
 * must never be able to replace a real save. Once it is closed, the card says why and how to reopen
 * it rather than vanishing (M3 note 17).
 *
 * ↯ Steps do not disqualify it, and they do not come across either. The hand-over clears the
 * watermarks, and the first read after it is a baseline that credits nothing (T3 §4.1, DECISIONS
 * 2026-10-24) — so the dialog says so rather than promising a re-read.
 */
function IdentityImport() {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read on every render rather than held in state: allocating a point on the Character screen must
  // close this door, and nothing here would otherwise know that happened.
  if (currentIdentity() === null) {
    return null;
  }

  if (!isProfileReplaceable(getDatabase())) {
    return (
      <Card>
        <Heading>Restore a different identity</Heading>
        <Body dim>
          Restoring is only possible before a new traverser finishes the tutorial, so it can never
          replace a real save. To restore a backup now, export this traverser first, then clear
          Traverser's storage in Android's app settings and choose Restore from a backup on the first
          screen.
        </Body>
        <Button label="Open app settings" variant="secondary" onPress={() => void Linking.openSettings()} />
      </Card>
    );
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
        "Steps your old phone hadn't synced won't come across, and neither will the steps already " +
        'counted for the traverser on this device.',
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

/**
 * GDD 13 §7's Audio row, mapped to GDD 14 §2.8's two buckets. It applies as it moves and saves on
 * release, apart from the step goal's Save — a volume is heard, not submitted.
 */
function Audio() {
  const [audio, setAudio] = useState<AudioSettings>(() => readAudioSettings(getDatabase()));

  const preview = (next: AudioSettings) => {
    setAudio(next);
    configureAudio(next);
  };

  const commit = (next: AudioSettings) => {
    preview(next);
    changeSettings(
      getDatabase(),
      {
        dailyStepGoal: null,
        birthYear: null,
        musicVolume: next.music.toFixed(2),
        sfxVolume: next.sfx.toFixed(2),
        audioMuted: next.muted,
      },
      Date.now(),
    );

    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  return (
    <Card>
      <Heading>Audio</Heading>

      <VolumeSlider
        label="Music"
        value={audio.music}
        onChange={(music) => preview({ ...audio, music })}
        onCommit={(music) => commit({ ...audio, music })}
      />
      <VolumeSlider
        label="Sound effects"
        value={audio.sfx}
        onChange={(sfx) => preview({ ...audio, sfx })}
        onCommit={(sfx) => {
          commit({ ...audio, sfx });
          // A sample at the new level, so the slider is judged by ear.
          playSfx('sfx_volume');
        }}
      />

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Mute all</Text>
        <Switch
          value={audio.muted}
          onValueChange={(muted) => {
            playSfx('sfx_toggle');
            commit({ ...audio, muted });
          }}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>
    </Card>
  );
}

/**
 * GDD 13 §7's Notifications row: the OS permission, a way to change it, and the hour (GDD 13 §7 and
 * GDD 11 §7.1, amended 2026-10-28). Also the only door for a player who finished onboarding before
 * Screen 10 existed.
 */
function Reminders() {
  const [state, setState] = useState<'granted' | 'ask' | 'settings' | null>(null);
  const [hour, setHour] = useState(() => readReminderHour(getDatabase()));

  const move = (next: number) => {
    setHour(next);
    changeSettings(
      getDatabase(),
      { dailyStepGoal: null, birthYear: null, dailyReminderTime: `${String(next).padStart(2, '0')}:00:00` },
      Date.now(),
    );
    rescheduleNudges();

    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);
  };

  const read = useCallback(() => {
    void nudgePermission().then(setState).catch(() => undefined);
  }, []);

  useFocusEffect(read);

  // Returning from Android's settings is a foreground, not a focus.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        read();
      }
    });

    return () => subscription.remove();
  }, [read]);

  const ask = async () => {
    if (await askForNudges().catch(() => false)) {
      rescheduleNudges();
    }

    read();
  };

  return (
    <Card>
      <Heading>Daily reminder</Heading>
      <Body dim>
        {state === 'granted'
          ? `On. One reminder ${reminderWindow(hour)}, and only on a day you haven't reached your goal or tagged for rest.`
          : `Off. Traverser can remind you ${reminderWindow(hour)} on days you haven't reached your goal.`}
      </Body>

      {state === 'granted' ? (
        <View style={styles.hours}>
          <View style={styles.hour}>
            <Button
              label="Earlier"
              variant="secondary"
              sound="sfx_toggle"
              disabled={hour <= EARLIEST_HOUR}
              onPress={() => move(hour - 1)}
            />
          </View>
          <View style={styles.hour}>
            <Button
              label="Later"
              variant="secondary"
              sound="sfx_toggle"
              disabled={hour >= LATEST_HOUR}
              onPress={() => move(hour + 1)}
            />
          </View>
        </View>
      ) : null}

      {state === 'ask' ? (
        <Button label="Allow reminders" variant="secondary" onPress={() => void ask()} />
      ) : state === null ? null : (
        <Button label="Open notification settings" variant="secondary" onPress={() => void Linking.openSettings()} />
      )}
    </Card>
  );
}

const STEP = 0.05;
const snap = (value: number) => Math.round(Math.min(1, Math.max(0, value)) / STEP) * STEP;

/** A drag-to-set track, so a volume needs no native slider and no rebuild. */
function VolumeSlider({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const width = useRef(1);
  const at = (x: number) => snap(x / width.current);

  return (
    <View style={styles.slider}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{Math.round(value * 100)}%</Text>
      </View>

      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) =>
          onCommit(snap(value + (event.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)))
        }
        onLayout={(event) => (width.current = event.nativeEvent.layout.width || 1)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        // Settings scrolls: without this the ScrollView takes the gesture back mid-drag.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(event) => onChange(at(event.nativeEvent.locationX))}
        onResponderMove={(event) => onChange(at(event.nativeEvent.locationX))}
        onResponderRelease={(event) => onCommit(at(event.nativeEvent.locationX))}
        style={styles.track}
      >
        {/*
          ↯ `pointerEvents="none"`, or a touch on the fill reports `locationX` relative to the fill
          rather than the track — and the value jumps to wherever the finger sits inside it.
        */}
        <View pointerEvents="none" style={styles.rail}>
          <View style={[styles.fill, { width: `${value * 100}%` }]} />
        </View>
      </View>
    </View>
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

/**
 * CC BY 3.0's attribution for the game-icons.net art (DECISIONS 2026-10-29): the authors, the
 * source, the licence, and that the icons were changed. Read from `art/credits.json`, which a test
 * keeps in step with every art source.
 */
function Credits() {
  const authors = [...new Set(Object.values(credits).flatMap((credit) => credit.authors))].sort();

  if (authors.length === 0) {
    return null;
  }

  return (
    <Card>
      <Heading>Credits</Heading>
      <Body dim>
        {`Icons by ${authors.join(', ')}, from game-icons.net, under CC BY 3.0. Recoloured, resized, and some combined for Traverser.`}
      </Body>
      <Button
        label="View the licence"
        variant="secondary"
        onPress={() => void Linking.openURL('https://creativecommons.org/licenses/by/3.0/')}
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
  error: { ...type.body, color: colors.gold },
  rows: { gap: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  hours: { flexDirection: 'row', gap: space.sm },
  hour: { flex: 1 },
  rowLabel: { ...type.body, color: colors.textDim },
  rowValue: { ...type.body, color: colors.text },
  slider: { gap: space.xs },
  track: { height: MIN_TOUCH_TARGET, justifyContent: 'center' },
  rail: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
});
