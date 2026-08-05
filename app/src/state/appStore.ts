import { create } from 'zustand';

import type { BannerKind } from '../health/banner';
import type { LevelUp } from '../sync/dto';
import type { HealthPassResult, ServerOutcome, SyncPassResult } from '../sync/pass';

/**
 * L3 session state (tech-04 §5.3) — what the current run of the app knows that SQLite does not.
 *
 * Everything here is rebuilt from scratch on a cold start, which is the test for whether something
 * belongs: the banner is a fact about the last sync, the level-up queue is a fact about what has not
 * been shown yet, and neither survives the process dying because neither should.
 */
interface AppStore {
  /** False until SQLite is open and migrated. Nothing may read the mirror before this. */
  readonly booted: boolean;
  /** Whether this device has a usable credential. Drives the boot router, not the UI. */
  readonly registered: boolean;
  readonly syncing: boolean;
  readonly lastServerOutcome: ServerOutcome | null;
  /** What the last pass found at the platform. Settings reports it; the banner is derived from it. */
  readonly health: HealthPassResult | null;
  readonly banner: BannerKind | null;
  /**
   * ↯ Populated **only** from a sync response (tech-04 §8.4). Nothing projects into this queue, and
   * a Reveal Card is shown from it exactly once.
   */
  readonly pendingLevelUps: readonly LevelUp[];

  markBooted(registered: boolean): void;
  setRegistered(registered: boolean): void;
  syncStarted(): void;
  syncFinished(result: SyncPassResult, banner: BannerKind | null): void;
  syncAborted(): void;
  consumeLevelUps(): readonly LevelUp[];
}

export const useAppStore = create<AppStore>((set, get) => ({
  booted: false,
  registered: false,
  syncing: false,
  lastServerOutcome: null,
  health: null,
  banner: null,
  pendingLevelUps: [],

  markBooted(registered) {
    set({ booted: true, registered });
  },

  setRegistered(registered) {
    set({ registered });
  },

  syncStarted() {
    set({ syncing: true });
  },

  syncFinished(result, banner) {
    set((state) => ({
      syncing: false,
      lastServerOutcome: result.server,
      health: result.health,
      banner,
      pendingLevelUps: [...state.pendingLevelUps, ...result.levelUps],
    }));
  },

  syncAborted() {
    set({ syncing: false });
  },

  consumeLevelUps() {
    const queued = get().pendingLevelUps;

    set({ pendingLevelUps: [] });

    return queued;
  },
}));
