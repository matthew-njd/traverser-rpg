import type { HealthPassResult } from '../../sync/pass';
import { BANNER_COPY, bannerFor } from '../banner';

/**
 * GDD 10 §3.2 / GDD 13 §3.1 — which banner, and whether one at all.
 *
 * ↯ The denied state is **legal**, not broken: onboarding completes, the app stays fully usable, and
 * battles still award XP. These tests exist to keep that true, because the instinct when a
 * permission is missing is to block, and blocking here risks an uninstall before the player has seen
 * any value.
 */
const health = (overrides: Partial<HealthPassResult> = {}): HealthPassResult => ({
  availability: 'available',
  permissions: { steps: true, heartRate: true },
  ageMissing: false,
  error: null,
  ...overrides,
});

describe('bannerFor', () => {
  it('shows nothing when everything is granted and usable', () => {
    expect(bannerFor(health())).toBeNull();
  });

  it('shows the denied banner when neither permission is granted', () => {
    expect(bannerFor(health({ permissions: { steps: false, heartRate: false } }))).toBe(
      'permission_denied',
    );
  });

  it('names the missing half on a partial grant', () => {
    expect(bannerFor(health({ permissions: { steps: true, heartRate: false } }))).toBe(
      'heart_rate_denied',
    );
    expect(bannerFor(health({ permissions: { steps: false, heartRate: true } }))).toBe(
      'steps_denied',
    );
  });

  /** ↯ Granted but unusable — fixable in Settings rather than in OS settings (tech-03 §1.4). */
  it('asks for a birth year when heart rate is granted without one', () => {
    expect(bannerFor(health({ ageMissing: true }))).toBe('age_missing');
    expect(BANNER_COPY.age_missing.target).toBe('app_settings');
  });

  /**
   * ↯ "Too old" and "not there" are different states with different fixes — a store deep link and
   * nothing at all. Collapsing them produces an app that is inexplicably dead on some phones.
   */
  it('separates an out-of-date platform from a missing one', () => {
    expect(bannerFor(health({ availability: 'update_required' }))).toBe('update_required');
    expect(bannerFor(health({ availability: 'unavailable' }))).toBe('unavailable');

    expect(BANNER_COPY.update_required.target).toBe('store');
    expect(BANNER_COPY.permission_denied.target).toBe('health_settings');
  });

  /** Availability outranks permissions: there is nothing to grant on a platform that is not there. */
  it('reports availability ahead of a permission that cannot matter yet', () => {
    expect(
      bannerFor(
        health({ availability: 'unavailable', permissions: { steps: false, heartRate: false } }),
      ),
    ).toBe('unavailable');
  });

  /**
   * A read error is not its own banner: a revoked permission **throws** rather than returning empty
   * (tech-03 §3), so `permission_denied` is what the player needs to see — and it is what
   * `getGrantedPermissions` reports on the very next pass anyway.
   */
  it('does not invent a banner for a read that failed while everything was granted', () => {
    expect(bannerFor(health({ error: 'unknown' }))).toBeNull();
  });

  it('keeps GDD 10 §3.2 copy verbatim', () => {
    expect(BANNER_COPY.permission_denied.message).toBe(
      'Enable activity access to start earning real XP — the road is waiting.',
    );
  });
});
