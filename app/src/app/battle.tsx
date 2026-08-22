import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { getDatabase } from '@/db/open';
import { mintUuidV7 } from '@/health/deltaId';
import { deviceLocalDates } from '@/health/localDate';
import { syncNow } from '@/runtime';
import { battleInProgress, useBattleStore } from '@/state/battleStore';
import { usePlayerStore } from '@/state/playerStore';
import type { EncounterKind } from '@/battle/types';
import { BattleScreen } from '@/ui/battle/BattleScreen';
import { revealsFor } from '@/ui/battle/reveal';
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
    // No enemy means this route was reached by boot resuming a fight, not by starting one.
    if (enemyId === undefined || battleInProgress()) {
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

  // ↯ A battle can be entered by boot's redirect (`app/index.tsx`) rather than by a push, and a
  // redirect leaves no history to pop — `back()` is a silent no-op there, stranding the player on
  // the settled panel. Every exit from this route goes through here.
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/character'));

  const finish = () => {
    const db = getDatabase();

    useBattleStore.getState().settle(db, deviceLocalDates.dateOf(Date.now()));
    usePlayerStore.getState().hydrate(db);

    // Best-effort: the battle is durable in the outbox whether or not the server is reachable.
    // `withNewWork` because a pass already running built its payload before this battle existed.
    void syncNow(Date.now(), { withNewWork: true }).catch(() => undefined);

    leave();
  };

  if (failed !== null) {
    return (
      <Screen>
        <Body>{failed}</Body>
        <Button label="Back" onPress={leave} />
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
      reveals={revealsFor(store.snapshot.state.drops, store.labels, store.revealDetails)}
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
