import type { HealthPassResult } from '../sync/pass';

/**
 * GDD 10 §3.2 / GDD 13 §3.1 — the health banner, and which one to show.
 *
 * Never a hard block (GDD 10 §3.2): onboarding continues and the app stays usable; the only
 * consequence is that no XP accrues. Never punitive in tone — an offer, not a warning.
 */
export type BannerKind =
  | 'permission_denied'
  | 'heart_rate_denied'
  | 'steps_denied'
  | 'age_missing'
  | 'update_required'
  | 'unavailable';

export interface BannerContent {
  readonly message: string;
  readonly action: string;
  /** Health Connect's own settings, or the store listing when the platform is too old. */
  readonly target: 'health_settings' | 'store' | 'app_settings';
}

export const BANNER_COPY: Record<BannerKind, BannerContent> = {
  // GDD 10 §3.2, verbatim.
  permission_denied: {
    message: 'Enable activity access to start earning real XP — the road is waiting.',
    action: 'Enable access',
    target: 'health_settings',
  },
  heart_rate_denied: {
    message: 'Steps are counting. Add heart-rate access to earn XP from workouts too.',
    action: 'Enable access',
    target: 'health_settings',
  },
  steps_denied: {
    message: 'Workouts are counting. Add step access to earn XP from walking too.',
    action: 'Enable access',
    target: 'health_settings',
  },
  age_missing: {
    message: 'Add your birth year to start earning XP from workouts.',
    action: 'Open settings',
    target: 'app_settings',
  },
  update_required: {
    message: 'Health Connect needs an update before the road can read your steps.',
    action: 'Update',
    target: 'store',
  },
  unavailable: {
    message: 'Health Connect is not available on this device, so steps cannot be read.',
    action: 'Learn more',
    target: 'store',
  },
};

/**
 * The single banner to render, or null. One at a time, ordered by how much the player is missing —
 * stacking them turns a nudge into a wall of complaints about a legal state.
 *
 * A read *error* is deliberately not its own banner: a revoked permission throws rather than
 * returning empty (tech-03 §3), and `permission_denied` is what the next pass reports anyway.
 */
export function bannerFor(health: HealthPassResult): BannerKind | null {
  if (health.availability === 'update_required') {
    return 'update_required';
  }

  if (health.availability === 'unavailable') {
    return 'unavailable';
  }

  if (!health.permissions.steps && !health.permissions.heartRate) {
    return 'permission_denied';
  }

  if (!health.permissions.steps) {
    return 'steps_denied';
  }

  if (!health.permissions.heartRate) {
    return 'heart_rate_denied';
  }

  // Granted but unusable — no birth year means no HRmax (tech-03 §1.4). Fixable in Settings, not
  // in OS settings, hence its own target.
  if (health.ageMissing) {
    return 'age_missing';
  }

  return null;
}
