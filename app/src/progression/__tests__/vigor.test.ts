import { fixedOffsetDates } from '../../health/localDate';
import { recoverVigor, restoreVigor } from '../vigor';

/**
 * GDD 2 §6. Fixtures §11's zone (UTC−4), so the day boundary is a declared value rather than the
 * test machine's.
 */
const DATES = fixedOffsetDates(-240);

/** Max 20 is the Level 1 baseline, where 1% per 10 minutes works out at one point per 50 minutes. */
const MAX = 20;

const at = (iso: string): number => Date.parse(iso);

/** 00:10 local on the 12th, so even a full 1000-minute fill lands before the next midnight. */
const ANCHOR = '2026-08-12T04:10:00.000Z';

const state = (vigorCurrent: number, vigorAnchorAt: string | null = ANCHOR) => ({
  vigorCurrent,
  vigorAnchorAt,
});

const minutes = (count: number): number => at(ANCHOR) + count * 60_000;

describe('recoverVigor', () => {
  it('grants nothing before a full point is bought', () => {
    expect(recoverVigor(state(5), MAX, minutes(0), DATES)).toEqual(state(5));
    expect(recoverVigor(state(5), MAX, minutes(49), DATES)).toEqual(state(5));
  });

  it('grants one point at 50 minutes — 1% of max per 10 minutes, at max 20', () => {
    expect(recoverVigor(state(5), MAX, minutes(50), DATES).vigorCurrent).toBe(6);
  });

  /**
   * The mutation this catches: re-anchoring to `now` rather than to the instant the granted points
   * bought. A player foregrounding every 49 minutes would then never gain a point at all.
   */
  it('leaves the unbought remainder on the anchor', () => {
    const after = recoverVigor(state(5), MAX, minutes(70), DATES);

    expect(after.vigorCurrent).toBe(6);
    expect(after.vigorAnchorAt).toBe(new Date(minutes(50)).toISOString());
  });

  it('fills the bar over a full 1000 minutes and never exceeds max', () => {
    expect(recoverVigor(state(0), MAX, minutes(1000), DATES).vigorCurrent).toBe(MAX);
    expect(recoverVigor(state(18), MAX, minutes(1000), DATES).vigorCurrent).toBe(MAX);
  });

  it('restores the whole bar once a local midnight has passed', () => {
    const after = recoverVigor(state(1), MAX, at('2026-08-13T05:00:00.000Z'), DATES);

    expect(after.vigorCurrent).toBe(MAX);
    expect(after.vigorAnchorAt).toBe('2026-08-13T05:00:00.000Z');
  });

  /**
   * 16:00 to 21:00 local on the 12th, which is 20:00 on the 12th to 01:00 on the 13th in UTC. A
   * boundary read off the instant rather than the player's zone resets the bar here.
   */
  it('reads the day boundary in the player’s own zone, not UTC', () => {
    const evening = { vigorCurrent: 1, vigorAnchorAt: '2026-08-12T20:00:00.000Z' };

    expect(recoverVigor(evening, MAX, at('2026-08-13T01:00:00.000Z'), DATES).vigorCurrent).toBe(7);
  });

  it('grants nothing when the clock has gone backwards', () => {
    expect(recoverVigor(state(5), MAX, minutes(-600), DATES)).toEqual(state(5));
    expect(recoverVigor(state(5), MAX, at('2026-08-11T04:10:00.000Z'), DATES)).toEqual(state(5));
  });

  it('grants nothing without an anchor', () => {
    expect(recoverVigor(state(5, null), MAX, minutes(1000), DATES)).toEqual(state(5, null));
  });
});

describe('restoreVigor', () => {
  it('fills the bar and re-anchors, so the restore is not topped up again on the next read', () => {
    expect(restoreVigor(MAX, minutes(0))).toEqual(state(MAX));
  });
});
