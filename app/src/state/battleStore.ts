import { create } from 'zustand';

import { readContentVersion } from '../content/bundle';
import { type Labels, type RevealDetail, loadLabels, loadRevealDetails } from '../content/labels';
import { readPlayer } from '../sync/mirror';
import type { SqliteDatabase } from '../db/types';
import { transact } from '../db/transaction';
import { clearSnapshot, readBestiary, readSnapshot, spendItems, writeSnapshot } from '../battle/mirror';
import { type Rng, systemRng } from '../battle/rng';
import {
  type Encounter,
  availableMoves,
  battleItems,
  buildContext,
  dropKindFor,
  startEncounter,
} from '../battle/session';
import { battlePayload, settleBattle } from '../battle/settle';
import { type BattleSnapshot, type ResumeFailure, resumeSnapshot } from '../battle/snapshot';
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
  /** GDD 13 §6.3’s per-key tier and flavour, loaded beside the labels and read only on victory. */
  readonly revealDetails: ReadonlyMap<string, RevealDetail>;
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
  /** Null when there was nothing to resume; a {@link ResumeFailure} when it had to be abandoned. */
  resume(db: SqliteDatabase): ResumeOutcome;
}

export type ResumeOutcome = 'resumed' | ResumeFailure | null;

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
  revealDetails: new Map<string, RevealDetail>(),
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
    const revealDetails = loadRevealDetails(db);
    const { attack, skills } = availableMoves(encounter.context.content, encounter.player.level);

    currentRng = input.rng ?? systemRng;

    // The opening snapshot is written before the first action, so a process death between the
    // encounter opening and the player's first tap resumes rather than losing the grant (T5 §8).
    writeSnapshot(db, encounter.snapshot, Date.now());

    set({
      snapshot: encounter.snapshot,
      context: encounter.context,
      labels,
      revealDetails,
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

  /**
   * Re-enters a fight the process died in the middle of (T5 §8).
   *
   * ↯ Two of §8.1's three hazards **abandon** the battle, and that is the kinder outcome rather than
   * the harsher one: a sync between backgrounding and resuming can change a move's Power underneath
   * a fight in progress, and resuming a battle whose numbers moved is worse than losing it. The
   * player keeps the encounter either way, because grants are held client-side until spent.
   *
   * The third hazard needs no code — the player was mid-`await_player`, which holds no partial
   * input, so re-entering redraws the screen.
   */
  resume(db) {
    const snapshot = readSnapshot(db);

    if (snapshot === null) {
      return null;
    }

    const held = readContentVersion(db) ?? 0;
    const result = resumeSnapshot(snapshot, { contentVersion: held });

    if (!result.ok) {
      clearSnapshot(db);
      set({ ...IDLE });

      return result.reason;
    }

    const player = readPlayer(db);

    // A snapshot without a player is a hand-over that took the profile with it. Nothing to resume
    // into, and the fight belonged to whoever left.
    if (player === null) {
      clearSnapshot(db);
      set({ ...IDLE });

      return 'schema_moved';
    }

    const labels = loadLabels(db);
    const revealDetails = loadRevealDetails(db);
    const context = buildContext(
      db,
      snapshot.state.enemyId,
      dropKindFor(snapshot.state.encounterKind, snapshot.state.firstKill ? 0 : 1),
    );

    // ↯ The system RNG, not whatever the interrupted run used. A seed is only ever set to reproduce
    // a recorded battle, and a resumed production fight has no reproducibility to preserve — the
    // draws already taken are baked into the state.
    currentRng = systemRng;

    set({
      snapshot,
      context,
      labels,
      revealDetails,
      // The event log does not survive the process — it is L3 session state (T4 §5.2) and the
      // combat log is a record of this session, not of the battle.
      events: [],
      items: itemOptionsFor(db, context, labels),
      moves: (({ attack, skills }) => [attack, ...skills])(
        availableMoves(context.content, player.level),
      ),
      playerId: player.playerId,
      chevronsUnlocked: readBestiary(db, snapshot.state.enemyId).encounterCount > 0,
      resolving: false,
    });

    return 'resumed';
  },
}));

/**
 * Whether a fight is still **unresolved**, which is the only state a new battle must not overwrite.
 *
 * ↯ Not `snapshot !== null`. `settle` leaves the settled battle in the store so the outcome panel
 * can keep rendering, so a null check treats a finished fight as an in-progress one — which is how
 * P8 found every battle after the first showing the previous battle's outcome screen instead of
 * starting.
 */
export function battleInProgress(): boolean {
  const snapshot = useBattleStore.getState().snapshot;

  return snapshot !== null && snapshot.state.outcome === null;
}
/** The state a screen renders, or null when no battle is open. */
export const currentBattle = (store: BattleStore): BattleState | null => store.snapshot?.state ?? null;
