import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getDatabase } from '@/db/open';
import { mintUuidV7 } from '@/health/deltaId';
import { deviceLocalDates } from '@/health/localDate';
import { syncNow } from '@/runtime';
import { useBattleStore } from '@/state/battleStore';
import { usePlayerStore } from '@/state/playerStore';
import type { EncounterKind } from '@/battle/types';
import { BattleScreen } from '@/ui/battle/BattleScreen';
import { Body, Button, Screen } from '@/ui/primitives';

/**
 * The battle route. Per tech-04 §13 there is no logic here — it opens the encounter, forwards taps
 * to the store, and leaves when the fight is settled.
 *
 * ↯ Not inside `(tabs)`: a battle takes over the screen, and a tab bar underneath it would offer an
 * exit that discards a fight the outbox has not recorded.
 */
export default function Battle() {
  const params = useLocalSearchParams<{ enemyId?: string; kind?: string }>();
  const router = useRouter();
  const store = useBattleStore();
  const [failed, setFailed] = useState<string | null>(null);

  const enemyId = params.enemyId;
  const kind = (params.kind ?? 'wild') as EncounterKind;

  useEffect(() => {
    if (enemyId === undefined) {
      return;
    }

    try {
      const now = Date.now();

      useBattleStore.getState().begin(getDatabase(), {
        enemyId,
        encounterKind: kind,
        // Minted at battle start and never re-derived, so a resumed fight keeps its id (T2 §5).
        clientBattleId: mintUuidV7(getDatabase(), now),
        startedAt: new Date(now).toISOString(),
      });
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'That encounter could not be opened.');
    }
  }, [enemyId, kind]);

  const finish = () => {
    const db = getDatabase();

    useBattleStore.getState().settle(db, deviceLocalDates.dateOf(Date.now()));
    usePlayerStore.getState().hydrate(db);

    // Best-effort: the battle is durable in the outbox whether or not the server is reachable.
    void syncNow().catch(() => undefined);

    router.back();
  };

  if (failed !== null) {
    return (
      <Screen>
        <Body>{failed}</Body>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (store.snapshot === null || store.context === null || store.labels === null) {
    return (
      <Screen>
        <Body dim>Opening the encounter…</Body>
      </Screen>
    );
  }

  return (
    <BattleScreen
      state={store.snapshot.state}
      context={store.context}
      moves={store.moves}
      labels={store.labels}
      events={store.events}
      items={store.items}
      chevronsUnlocked={store.chevronsUnlocked}
      onBegin={() => store.dispatch(getDatabase(), { kind: 'begin' })}
      onMove={(moveId) => store.dispatch(getDatabase(), { kind: 'move', moveId })}
      onItem={(item) =>
        store.dispatch(getDatabase(), {
          kind: 'item',
          playerItemId: item.playerItemId,
          itemDefId: item.itemDefId,
        })
      }
      onFlee={() => store.dispatch(getDatabase(), { kind: 'flee' })}
      onDone={finish}
    />
  );
}
