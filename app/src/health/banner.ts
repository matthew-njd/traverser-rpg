import type { HealthPassResult } from '../sync/pass';

/**
 * GDD 10 §3.2 / GDD 13 §3.1 — the health banner, and which one to show.
 *
 * ↯ **Never a hard block.** GDD 10 §3.2 is explicit: onboarding continues, the app stays fully
 * usable, and the only consequence is that no step or HR XP accrues. A fitness app that cannot be
 * opened without granting permissions is a bad first impression and risks an uninstall before the
 * player has seen any value.
 *
 * ↯ And never punitive in tone. These read as an offer, not a warning — the copy for the denied case
 * is GDD 10 §3.2's, verbatim.
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
 * The single banner to render, or null for none.
 *
 * ↯ One at a time, and the order is by how much the player is missing out on. Stacking banners on
 * the Character screen would turn a gentle nudge into a wall of complaints about a state the design
 * explicitly says is legal.
 *
 * A read *error* is deliberately not its own banner: the spike found that a revoked permission
 * throws rather than returning empty (tech-03 §3), so `permission_denied` is what the player
 * actually needs to see and act on — and it is what `getGrantedPermissions` will report on the next
 * pass anyway.
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

  // Granted but unusable: without a birth year there is no HRmax, so tier minutes are not charged
  // at all (tech-03 §1.4). Fixable in Settings rather than in OS settings, hence its own target.
  if (health.ageMissing) {
    return 'age_missing';
  }

  return null;
}
