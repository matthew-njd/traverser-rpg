import type { DerivedSession, TierThresholds } from './derive';
import type { LocalDateResolver } from './localDate';

/**
 * The platform seam (tech-03 §11).
 *
 * Everything Health-Connect-specific — availability, permissions, the read calls, pagination — lives
 * behind this interface in `healthconnect.ts`. Everything from tech-03 §5 down is platform-neutral
 * and knows nothing about it.
 *
 * ↯ **Nothing is being built for iOS here** (CLAUDE.md is Android-only). The seam exists because
 * tech-03 §11 asks that §5–§9 never reach for a Health Connect type, which is good hygiene whether
 * or not an iOS port ever happens — and it is what makes the derivation testable with no device.
 */

/**
 * ↯ Three states, not two. Health Connect is part of the OS on Android 14+ and a separately
 * installable APK below it, so `update_required` is a state real devices are in — the platform
 * exists but is too old, and the fix is a store deep link rather than the Health Connect settings
 * deep link. Collapsing it into `unavailable` produces an app that is inexplicably dead on some
 * phones (tech-03 §2).
 */
export type SdkAvailability = 'available' | 'update_required' | 'unavailable';

/**
 * ↯ Per record type, never a boolean. The player can grant steps and deny heart rate — Health
 * Connect's dialog is per-record-type — and tech-03 §3's table gives each combination its own
 * first-class behaviour, including the degenerate HR-only case.
 */
export interface HealthPermissions {
  readonly steps: boolean;
  readonly heartRate: boolean;
}

export const NO_PERMISSIONS: HealthPermissions = { steps: false, heartRate: false };

export interface ReadWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * What the provider hands back, already bucketed, tiered and assigned to local dates (tech-03 §11).
 * Integers and instants only — no BPM crosses this boundary (§1.1).
 */
export interface HealthSnapshot {
  /** `activity_date` → the day's observed step total. Health Connect de-duplicates across origins. */
  readonly dailySteps: ReadonlyMap<string, number>;
  readonly sessions: readonly DerivedSession[];
  /** The end of the window this snapshot consumed. */
  readonly consumedThrough: number;
}

export type HealthErrorReason =
  | 'permission_denied'
  | 'not_initialized'
  | 'unavailable'
  | 'unknown';

/**
 * ↯ Health Connect **throws**; it does not return empty (tech-03 §3 as corrected by the spike, and
 * tech-04 §8.3). A read without permission raises `SecurityException`, and a read before
 * `initialize()` raises "client not initialized". This is a place the web instinct actively misleads
 * — a failed `fetch` resolves and you check `res.ok`, whereas these reject — so every call into the
 * platform is wrapped and the reason is mapped to banner state rather than to a crash.
 */
export class HealthError extends Error {
  constructor(
    readonly reason: HealthErrorReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'HealthError';
  }
}

export interface HealthProvider {
  availability(): Promise<SdkAvailability>;

  /**
   * ↯ Called on **every** pass, not once at onboarding. Changing permissions in Health Connect
   * settings restarts the app process, after which every call fails with "client not initialized"
   * (tech-03 §3, spike-amended). It is per-process, not per-install.
   */
  initialize(): Promise<void>;

  requestPermissions(): Promise<HealthPermissions>;

  /**
   * ↯ The authority on what is granted — never `requestPermission`'s return value, and re-checked on
   * every foreground because revocation from OS settings is silent from the app's point of view.
   */
  grantedPermissions(): Promise<HealthPermissions>;

  read(
    window: ReadWindow,
    thresholds: TierThresholds,
    dates: LocalDateResolver,
    granted: HealthPermissions,
  ): Promise<HealthSnapshot>;

  /**
   * The banner's tap target (tech-03 §3).
   *
   * ↯ Deep-link to settings; do **not** re-trigger `requestPermissions` after a denial. Android
   * suppresses repeat prompts, so the button would simply appear broken.
   */
  openSettings(): void;
}

/** tech-03 §4.1. */
export const READ_WINDOW_HOURS = 72;

/**
 * The read window: `[max(watermark, now − 72h), now]`, **snapped back to local midnight**.
 *
 * 72 hours is the smallest span that satisfies the design — GDD 11 §3.2's Auto Sync Grace looks back
 * 48 hours and needs synced totals to evaluate against, and provider backfill (a watch that syncs
 * hours after a workout) can land data behind the wall clock; the extra 24 hours is that slack.
 *
 * ↯ **The snap to local midnight is not in tech-03 §4.1, and without it the high-water scheme loses
 * activity.** §8.1 mints `observed_total(date) − reported_high_water(date)`, which requires the
 * observed value to be the day's *whole* total. A watermark at 18:00 yesterday would make the first
 * daily bucket cover 18:00→midnight only; that partial total sits below the mark already recorded
 * for the day, the delta is zero, and the evening's steps are dropped — silently, and permanently,
 * because §8.1 also forbids lowering the mark. Widening the start is free: re-reading days already
 * reported is normal and expected, and §8 is what makes it safe.
 */
export function readWindowFor(
  watermark: string | null,
  now: number,
  dates: LocalDateResolver,
): ReadWindow {
  const floor = now - READ_WINDOW_HOURS * 60 * 60 * 1000;
  const watermarkMs = watermark === null ? 0 : Date.parse(watermark);
  const start = Number.isNaN(watermarkMs) ? floor : Math.max(watermarkMs, floor);

  return { startMs: dates.startOfDay(start), endMs: now };
}
