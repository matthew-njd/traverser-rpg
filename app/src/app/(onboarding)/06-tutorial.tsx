import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { TUTORIAL_ENEMY_ID } from '@/battle/session';
import { getDatabase } from '@/db/open';
import { mintUuidV7 } from '@/health/deltaId';
import {
  FLEE_LOCKED_NOTE,
  ITEM_ONLY_NOTE,
  SKILL_LOCKED_NOTE,
  beatFor,
} from '@/onboarding/tutorial';
import { battleInProgress, useBattleStore } from '@/state/battleStore';
import { BattleScreen } from '@/ui/battle/BattleScreen';
import { Body, Screen } from '@/ui/primitives';

/**
 * GDD 10 Screen 6 (§6) — the tutorial battle.
 *
 * ↯ **The same screen and the same engine as every other fight** (M2 plan §3.4, T5 §7.4). What
 * makes it the tutorial is `encounterKind: 'tutorial'`, which selects `TUTORIAL_RULES` — crit off,
 * variance off, type chart off — plus the guided copy passed in as a script. There is no second
 * battle implementation, and scripting the five turns directly would produce a tutorial that proved
 * nothing about the engine it exists to introduce.
 */
export default function TutorialBattle() {
  const router = useRouter();
  const store = useBattleStore();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Boot already resumed an interrupted fight (T5 §8). Opening a second one over the top of it
    // would abandon a battle the player is mid-way through and mint a second `client_battle_id`.
    if (battleInProgress()) {
      return;
    }

    const now = Date.now();

    try {
      useBattleStore.getState().begin(getDatabase(), {
        enemyId: TUTORIAL_ENEMY_ID,
        encounterKind: 'tutorial',
        clientBattleId: mintUuidV7(getDatabase(), now),
        startedAt: new Date(now).toISOString(),
      });
    } catch {
      setFailed(true);
    }
  }, []);

  const state = store.snapshot?.state ?? null;

  // §6.5's acknowledgment is Screen 7, so the fight hands over the moment it settles rather than
  // showing the ordinary victory panel.
  useEffect(() => {
    if (state !== null && state.outcome !== null) {
      router.replace('/07-victory');
    }
  }, [state?.outcome, router, state]);

  /**
   * A tutorial that cannot open is not recoverable by retrying — it means the content bundle is
   * missing the Wisp — so the player is let through rather than trapped on a dead screen. They land
   * on the hub having missed a tutorial, which is survivable; a wall here is not.
   */
  if (failed) {
    return (
      <Screen>
        <Body>The road is quiet here. Press on.</Body>
      </Screen>
    );
  }

  if (state === null || store.context === null || store.labels === null) {
    return (
      <Screen>
        <Body dim>The air thickens…</Body>
      </Screen>
    );
  }

  return (
    <BattleScreen
      state={state}
      context={store.context}
      moves={store.moves}
      labels={store.labels}
      events={store.events}
      items={store.items}
      chevronsUnlocked={false}
      script={{
        beat: beatFor(state),
        attackLockedNote: ITEM_ONLY_NOTE,
        skillLockedNote: SKILL_LOCKED_NOTE,
        fleeLockedNote: FLEE_LOCKED_NOTE,
      }}
      onBegin={() => store.dispatch(getDatabase(), { kind: 'begin' })}
      onMove={(moveId) => store.dispatch(getDatabase(), { kind: 'move', moveId })}
      onItem={(item) =>
        store.dispatch(getDatabase(), {
          kind: 'item',
          playerItemId: item.playerItemId,
          itemDefId: item.itemDefId,
        })
      }
      onFlee={() => undefined}
      onDone={() => router.replace('/07-victory')}
    />
  );
}
