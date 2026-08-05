import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDatabase } from '@/db/open';
import { apiBaseUrl } from '@/env';
import { RestoreError, restoreIdentity } from '@/onboarding/registration';
import { refreshIdentity } from '@/runtime';
import { ApiStatusError, ApiUnreachableError } from '@/sync/api';
import { Body, Button, Field, Screen, Title } from '@/ui/primitives';
import { colors, space, type } from '@/ui/theme';

/**
 * tech-06 §13.1 — restore an exported identity instead of registering.
 *
 * ↯ This screen is why the Postgres backup is worth taking. §10.1: a perfect dump restored onto new
 * hardware is a database full of history that **no client can claim**, because `player_id` and the
 * bearer token live only in app storage (tech-04 §6.5) and uninstall destroys both. Without this
 * branch the backup set restores data nobody can reach.
 *
 * ↯ Its weakness is stated plainly in §13.1 and is not fixable here: it only helps if the export was
 * taken *before* the loss. That is the argument for Settings surfacing it prominently rather than
 * burying it, and for it being the fourth member of the backup set at P9.
 */
export default function Restore() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = playerId.trim().length > 0 && token.trim().length > 0;

  const restore = async () => {
    setBusy(true);
    setError(null);

    try {
      await restoreIdentity(
        getDatabase(),
        { baseUrl: apiBaseUrl },
        { playerId: playerId.trim(), token: token.trim() },
      );

      await refreshIdentity();
      router.replace('/character');
    } catch (caught) {
      setError(messageFor(caught));
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.body}>
        <Title>Restore from a backup</Title>

        <Body dim>
          Paste the player id and token from your exported identity file. They are checked against
          the server before anything is saved.
        </Body>

        <Field
          label="Player id"
          value={playerId}
          onChangeText={setPlayerId}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="018f3a9c-…"
        />

        <Field
          label="Token"
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        {error === null ? null : <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.actions}>
        <Button label="Restore" busy={busy} disabled={!ready} onPress={() => void restore()} />
        <Button label="Back" variant="secondary" disabled={busy} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function messageFor(caught: unknown): string {
  if (caught instanceof ApiUnreachableError) {
    return 'The road is quiet — no answer from the server. A restore needs it reachable.';
  }

  if (caught instanceof RestoreError) {
    return caught.message;
  }

  if (caught instanceof ApiStatusError && caught.status === 401) {
    return 'That token was not accepted. Check it was copied whole, with no line breaks.';
  }

  return 'That identity could not be restored.';
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', gap: space.md, paddingVertical: space.lg },
  actions: { gap: space.sm },
  error: { ...type.body, color: colors.gold },
});
