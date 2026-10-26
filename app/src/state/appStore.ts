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
   * Populated **only** from a sync response (tech-04 §8.4). Nothing projects into this queue, and
   * a Reveal Card is shown from it exactly once.
   */
  readonly pendingLevelUps: readonly LevelUp[];
  /**
   * Bumped whenever `fresh_reward` may have changed — a finished pass, or a reward seen — so the
   * tab bar and the reveal re-read it from SQLite rather than holding a second copy.
   */
  readonly rewardsSeq: number;
  /** GDD 11 §8 — up until dismissed. A later pass never clears it: step 11 reports a session once. */
  readonly overactive: boolean;
  /** T3 §4.1 — the first date a read counted after a gap of more than 72 hours, until dismissed. */
  readonly missedBefore: string | null;

  markBooted(registered: boolean): void;
  setRegistered(registered: boolean): void;
  syncStarted(): void;
  /** Mid-pass, as soon as the platform has been read — the banner does not wait for the server. */
  healthRead(health: HealthPassResult, banner: BannerKind | null): void;
  syncFinished(result: SyncPassResult, banner: BannerKind | null): void;
  syncAborted(): void;
  consumeLevelUps(): readonly LevelUp[];
  rewardsChanged(): void;
  dismissOveractivity(): void;
  dismissMissed(): void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  booted: false,
  registered: false,
  syncing: false,
  lastServerOutcome: null,
  health: null,
  banner: null,
  pendingLevelUps: [],
  rewardsSeq: 0,
  overactive: false,
  missedBefore: null,

  markBooted(registered) {
    set({ booted: true, registered });
  },

  setRegistered(registered) {
    set({ registered });
  },

  syncStarted() {
    set({ syncing: true });
  },

  healthRead(health, banner) {
    set({ health, banner });
  },

  syncFinished(result, banner) {
    set((state) => ({
      syncing: false,
      lastServerOutcome: result.server,
      health: result.health,
      banner,
      pendingLevelUps: [...state.pendingLevelUps, ...result.levelUps],
      rewardsSeq: state.rewardsSeq + 1,
      overactive: state.overactive || result.overactive,
      missedBefore: result.missedBefore ?? state.missedBefore,
    }));
  },

  rewardsChanged() {
    set((state) => ({ rewardsSeq: state.rewardsSeq + 1 }));
  },

  dismissOveractivity() {
    set({ overactive: false });
  },

  dismissMissed() {
    set({ missedBefore: null });
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
