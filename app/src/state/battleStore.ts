import { create } from 'zustand';

import { type Labels, loadLabels } from '../content/labels';
import type { SqliteDatabase } from '../db/types';
import { transact } from '../db/transaction';
import { clearSnapshot, spendItems, writeSnapshot } from '../battle/mirror';
import { type Rng, systemRng } from '../battle/rng';
import { type Encounter, availableMoves, battleItems, startEncounter } from '../battle/session';
import { battlePayload, settleBattle } from '../battle/settle';
import type { BattleSnapshot } from '../battle/snapshot';
import {
  type BattleAction,
  type BattleContext,
  type BattleEvent,
  type BattleState,
  markSettled,
  step,
} from '../battle/state';
import type { EncounterKind, Move } from '../battle/types';
import type { ItemOption } from '../ui/battle/ActionMenu';

/**
 * T5 §9's adapter, and it is **thin by design**: it holds the current state, calls `step`, persists
 * the snapshot, and pushes events onto a queue the screen drains. All battle logic sits below it, so
 * `src/battle/` stays importable by a Node test with no Expo in the module graph.
 *
 * Nothing here decides an outcome, rolls anything, or reads content. If a rule appears in this file
 * it is in the wrong file.
 */
interface BattleStore {
  readonly snapshot: BattleSnapshot | null;
  readonly context: BattleContext | null;
  readonly labels: Labels | null;
  /** Every event this battle has emitted, oldest first. The screen renders a window of it. */
  readonly events: readonly BattleEvent[];
  readonly items: readonly ItemOption[];
  /** Basic Attack plus the player's unlocked Skills — what the action menu offers. */
  readonly moves: readonly Move[];
  readonly playerId: string | null;
  readonly chevronsUnlocked: boolean;
  /** True while a turn is resolving — the action menu is closed to input for its duration. */
  readonly resolving: boolean;

  begin(db: SqliteDatabase, input: BeginInput): void;
  dispatch(db: SqliteDatabase, action: BattleAction, now?: number): void;
  /** Writes the finished battle to the outbox and clears the fight. Idempotent. */
  settle(db: SqliteDatabase, activityDate: string, now?: number): void;
  abandon(db: SqliteDatabase): void;
}

export interface BeginInput {
  readonly enemyId: string;
  readonly encounterKind: EncounterKind;
  readonly clientBattleId: string;
  readonly startedAt: string;
  readonly grantId?: string | null;
  /** Injected in tests; production takes the system RNG. */
  readonly rng?: Rng;
}

const IDLE = {
  snapshot: null,
  context: null,
  labels: null,
  events: [],
  items: [],
  moves: [],
  playerId: null,
  chevronsUnlocked: false,
  resolving: false,
} as const;

/**
 * Held outside the store rather than in it: an `Rng` is stateful and is not something a render may
 * observe, and putting it in state would make every draw a store update.
 */
let currentRng: Rng = systemRng;

function itemOptionsFor(db: SqliteDatabase, context: BattleContext, labels: Labels): ItemOption[] {
  return battleItems(db, context).map(({ playerItemId, item }) => ({
    playerItemId,
    itemDefId: item.id,
    label: labels.get(item.id) ?? item.id,
  }));
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  ...IDLE,

  begin(db, input) {
    const encounter: Encounter = startEncounter(db, input);
    const labels = loadLabels(db);
    const { attack, skills } = availableMoves(encounter.context.content, encounter.player.level);

    currentRng = input.rng ?? systemRng;

    // The opening snapshot is written before the first action, so a process death between the
    // encounter opening and the player's first tap resumes rather than losing the grant (T5 §8).
    writeSnapshot(db, encounter.snapshot, Date.now());

    set({
      snapshot: encounter.snapshot,
      context: encounter.context,
      labels,
      events: [...encounter.events],
      items: itemOptionsFor(db, encounter.context, labels),
      moves: [attack, ...skills],
      playerId: encounter.player.playerId,
      chevronsUnlocked: encounter.chevronsUnlocked,
      resolving: false,
    });
  },

  dispatch(db, action, now = Date.now()) {
    const { snapshot, context, labels } = get();

    if (snapshot === null || context === null || labels === null) {
      return;
    }

    const result = step(snapshot.state, action, context, currentRng);
    const next: BattleSnapshot = { ...snapshot, state: result.state };

    /**
     * ↯ **One transaction, and the item leaves the satchel here rather than at settle** (T4 §5.3).
     * Deleting it at settle instead would survive a crash mid-battle as a row that is both spent in
     * the snapshot and still held in the mirror — so the resumed fight offers the same physical
     * Salve a second time. Both writes land, or the turn did not happen.
     */
    transact(db, () => {
      writeSnapshot(db, next, now);

      if (action.kind === 'item') {
        spendItems(db, [action.playerItemId]);
      }
    });

    set((state) => ({
      snapshot: next,
      events: [...state.events, ...result.events],
      // Spent items leave the satchel the moment the turn resolves; the mirror row goes with the
      // settle, so this list is re-read rather than mutated.
      items:
        action.kind === 'item'
          ? state.items.filter((item) => item.playerItemId !== action.playerItemId)
          : state.items,
    }));
  },

  settle(db, activityDate, now = Date.now()) {
    const { snapshot, playerId } = get();

    if (snapshot === null || playerId === null || snapshot.state.outcome === null) {
      return;
    }

    if (snapshot.state.phase === 'settled') {
      return;
    }

    const payload = battlePayload(snapshot.state, {
      clientBattleId: snapshot.clientBattleId,
      grantId: snapshot.grantId,
      activityDate,
      startedAt: snapshot.startedAt,
      endedAt: new Date(now).toISOString(),
    });

    settleBattle(db, payload, playerId, now);

    set({ snapshot: { ...snapshot, state: markSettled(snapshot.state) } });
  },

  /** Leaves the fight without recording it — §8.1's answer to a resume that cannot be honoured. */
  abandon(db) {
    clearSnapshot(db);
    set({ ...IDLE });
  },
}));

/** The state a screen renders, or null when no battle is open. */
export const currentBattle = (store: BattleStore): BattleState | null => store.snapshot?.state ?? null;
