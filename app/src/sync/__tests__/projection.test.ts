import type { MintedDelta } from '../../health/deltas';
import { parsePlayerState } from '../dto';
import { STEPS_PER_LEAGUE, leaguesFor, projectGains, projectState } from '../projection';
import { wirePlayer } from './fixtures';

/**
 * tech-02 §5 / tech-04 §8.4 — the optimistic preview, and the two things it must never do.
 */

const steps = (n: number): MintedDelta => ({
  clientDeltaId: `s${n}`,
  activityDate: '2026-08-02',
  source: 'steps',
  stepsDelta: n,
  minutesDelta: 0,
  hrTier: null,
  recordedAt: '2026-08-03T12:00:00.000Z',
});

const tier = (t: 1 | 2 | 3, minutes: number): MintedDelta => ({
  clientDeltaId: `t${t}-${minutes}`,
  activityDate: '2026-08-02',
  source: 'hr',
  stepsDelta: 0,
  minutesDelta: minutes,
  hrTier: t,
  recordedAt: '2026-08-03T12:00:00.000Z',
});

const player = (overrides: Record<string, unknown> = {}) => parsePlayerState(wirePlayer(overrides));

describe('rates (GDD 1 §2)', () => {
  it('charges 1 XP per 20 steps, floored', () => {
    expect(projectGains([steps(8000)])).toEqual({ steps: 8000, xp: 400 });
    expect(projectGains([steps(19)]).xp).toBe(0);
    expect(projectGains([steps(39)]).xp).toBe(1);
  });

  it('charges 3, 5 and 7 XP per tier minute', () => {
    expect(projectGains([tier(1, 10)]).xp).toBe(30);
    expect(projectGains([tier(2, 45)]).xp).toBe(225);
    expect(projectGains([tier(3, 10)]).xp).toBe(70);
  });

  /** The worked example in tech-02 §4: 8,000 steps and 45 Vigorous minutes is 625 XP. */
  it('sums a mixed batch', () => {
    expect(projectGains([steps(8000), tier(2, 45)])).toEqual({ steps: 8000, xp: 625 });
  });

  /**
   * ↯ Tier 3's daily cap is deliberately **not** applied. It is evaluated server-side against the
   * day's post-merge cumulative (tech-03 §5.5), which this device cannot know. 27 Peak minutes
   * project at 189 and settle to the server's 169 — the quiet correction §8.4 designs for, rather
   * than a guessed number that looks authoritative.
   */
  it('does not apply the Tier 3 daily cap', () => {
    expect(projectGains([tier(3, 27)]).xp).toBe(189);
  });

  it('projects nothing from an empty pass', () => {
    expect(projectGains([])).toEqual({ steps: 0, xp: 0 });
  });
});

describe('Leagues (GDD 9 §2.1)', () => {
  it('is lifetime steps over 1000, floored', () => {
    expect(leaguesFor(205_000)).toBe(205);
    expect(leaguesFor(219_200)).toBe(219);
    expect(leaguesFor(STEPS_PER_LEAGUE - 1)).toBe(0);
  });
});

describe('applying gains', () => {
  it('adds steps and XP to the current mirror values', () => {
    const projected = projectState(player(), { steps: 14_200, xp: 935 });

    expect(projected.lifetimeSteps).toBe(219_200);
    // 400 + 935 = 1,335, which is past the 1,240 threshold — clamped, never levelled (below).
    expect(projected.xpCurrent).toBe(1240);
    expect(projected.xpLifetime).toBe(12_400 + 935);
  });

  /**
   * ↯ **Level-ups are never projected.** tech-04 §8.4 calls a Reveal Card celebrating a level-up that
   * then un-happens the single worst reconciliation artefact this design can produce, and the server
   * owns the curve — a projection that crossed the threshold would have to guess both the new level
   * and the carried remainder. The bar fills and stops.
   */
  it('clamps XP at the threshold instead of levelling', () => {
    const projected = projectState(player({ xp_current: 1200, xp_to_next: 1240 }), {
      steps: 0,
      xp: 500,
    });

    expect(projected.xpCurrent).toBe(1240);
  });

  it('still counts a boundary-crossing gain in full against xp_lifetime', () => {
    const projected = projectState(player({ xp_current: 1200, xp_to_next: 1240 }), {
      steps: 0,
      xp: 500,
    });

    expect(projected.xpLifetime).toBe(12_400 + 500);
  });

  it('never moves XP backwards when the bar is already full', () => {
    const projected = projectState(player({ xp_current: 1240, xp_to_next: 1240 }), {
      steps: 0,
      xp: 300,
    });

    expect(projected.xpCurrent).toBe(1240);
  });

  /**
   * ↯ **XP stops entirely at Level 60, with no banking** (GDD 1 §4, and a non-negotiable rule in
   * CLAUDE.md). `xp_to_next` is null there, and a projection that kept accruing would show the
   * player earning XP the server will never grant.
   */
  it('projects no XP at all at Level 60, while steps keep accruing', () => {
    const projected = projectState(player({ level: 60, xp_to_next: null, xp_current: 900 }), {
      steps: 5000,
      xp: 400,
    });

    expect(projected.xpCurrent).toBe(900);
    expect(projected.xpLifetime).toBe(12_400);
    expect(projected.lifetimeSteps).toBe(210_000);
  });
});
