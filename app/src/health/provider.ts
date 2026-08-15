import type { DerivedSession, TierThresholds } from './derive';
import type { LocalDateResolver } from './localDate';

/**
 * The platform seam (tech-03 §11). Health-Connect-specific code lives behind this in
 * `healthconnect.ts`; §5 downward is platform-neutral and testable with no device.
 */

/**
 * Three states, not two. Health Connect is part of the OS on Android 14+ and a separate APK below
 * it, so `update_required` is a real state — and its fix is a store link, not the settings link.
 */
export type SdkAvailability = 'available' | 'update_required' | 'unavailable';

/** Per record type, never a boolean — the player can grant steps and deny heart rate. */
export interface HealthPermissions {
  readonly steps: boolean;
  readonly heartRate: boolean;
}

export const NO_PERMISSIONS: HealthPermissions = { steps: false, heartRate: false };

export interface ReadWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/** Already bucketed, tiered and dated (tech-03 §11). Integers and instants only — no BPM (§1.1). */
export interface HealthSnapshot {
  readonly dailySteps: ReadonlyMap<string, number>;
  readonly sessions: readonly DerivedSession[];
  readonly consumedThrough: number;
  /**
   * Which sources were read, as opposed to granted. Empty `dailySteps` means "none that window"
   * when steps were read and "did not look" when they were not; delta minting must tell them apart.
   */
  readonly readSources: HealthPermissions;
}

export type HealthErrorReason =
  | 'permission_denied'
  | 'not_initialized'
  | 'unavailable'
  | 'unknown';

/**
 * ↯ Health Connect **throws**; it does not return empty (tech-03 §3, tech-04 §8.3). A failed `fetch`
 * resolves and you check `res.ok` — these reject. Every platform call is wrapped.
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
   * ↯ Called on every pass, not once at onboarding. Changing permissions restarts the app process,
   * after which every call fails with "client not initialized" (tech-03 §3).
   */
  initialize(): Promise<void>;

  requestPermissions(): Promise<HealthPermissions>;

  /** The authority on what is granted — never `requestPermissions`' return value (tech-03 §3). */
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
   * suppresses repeat prompts, so the button would just appear broken.
   */
  openSettings(): void;
}

/** tech-03 §4.1. */
export const READ_WINDOW_HOURS = 72;

/**
 * `[max(watermark, now − 72h), now]`, snapped back to local midnight (tech-03 §4.1).
 *
 * The snap is load-bearing. §8.1 mints `observed_total − mark`, which needs the day's *whole*
 * total; a watermark at 18:00 would make the first bucket cover 18:00→midnight, land below the
 * existing mark, and drop the evening silently and permanently.
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
