import {
  type HrSample,
  bucketMinutes,
  rollUpTierMinutes,
  segmentSessions,
  sessionIdFor,
  thresholdsForAge,
  tierForBpm,
} from '../derive';
import { MINUTE_MS } from '../localDate';
import { TIER_1_BPM, TIER_3_BPM, edt, edtDates, minutes } from './fixtures';

/**
 * tech-03 §5, asserted against `docs/traverser-test-fixtures.md` §11 — the eight cases T3 §10 owed,
 * machine-verified 2026-07-26 by executing the algorithms rather than transcribing prose.
 *
 * No device, no renderer, no Expo module: everything here is a pure function over plain data, which
 * is what tech-04 §12 asks of the derivation suite.
 */

const AGE_30 = thresholdsForAge(30);

/** Far enough past every timeline below that its last session has certainly closed. */
const WINDOW_END = edt('2026-07-20T12:00');

describe('thresholds (fixtures §11.1)', () => {
  it('converts age 30 to HRmax 190 and bounds 95 / 133 / 162', () => {
    expect(thresholdsForAge(30)).toEqual({ hrMax: 190, tier1: 95, tier2: 133, tier3: 162 });
  });

  /**
   * ↯ The row that pins `ceil`. Three of age 55's bounds are non-integral before rounding — 82.5,
   * 115.5, 140.25 — and a `round` implementation puts Tier 1 at 82 BPM and Tier 3 at 140, promoting
   * minutes into tiers they are fractionally below.
   */
  it('converts age 55 to HRmax 165 and bounds 83 / 116 / 141, rounding up', () => {
    expect(thresholdsForAge(55)).toEqual({ hrMax: 165, tier1: 83, tier2: 116, tier3: 141 });
  });
});

describe('bucketing (fixtures §11.2)', () => {
  const tierOfMinute = (samples: HrSample[]) => bucketMinutes(samples, AGE_30)[0]?.tier;

  const at = (second: number, bpm: number): HrSample => ({
    at: edt('2026-07-19T10:00') + second * 1000,
    bpm,
  });

  /** ↯ Mean, not max: one of these three samples is below the Tier 2 bound and the minute is Tier 2. */
  it('scores 130/134/136 as Tier 2 on a mean of 133.33', () => {
    expect(tierOfMinute([at(0, 130), at(20, 134), at(40, 136)])).toBe(2);
  });

  it('scores 128/131 as Tier 1 on a mean of 129.5', () => {
    expect(tierOfMinute([at(0, 128), at(30, 131)])).toBe(1);
  });

  it('treats the bound as inclusive — an exact mean of 133 is Tier 2', () => {
    expect(tierOfMinute([at(0, 131), at(20, 133), at(40, 135)])).toBe(2);
  });

  it('scores 90/98 as untiered, one sample below the Tier 1 bound of 95', () => {
    expect(tierOfMinute([at(0, 90), at(30, 98)])).toBe(0);
  });

  /** ↯ Sparse sampling must never invent minutes. A minute with no samples simply is not there. */
  it('produces no minute at all where there are no samples', () => {
    const gapped = [at(0, TIER_1_BPM), { at: edt('2026-07-19T10:05'), bpm: TIER_1_BPM }];

    expect(bucketMinutes(gapped, AGE_30)).toHaveLength(2);
  });

  it('orders minutes even when the samples arrive unordered', () => {
    const shuffled = [
      { at: edt('2026-07-19T10:02'), bpm: TIER_1_BPM },
      { at: edt('2026-07-19T10:00'), bpm: TIER_1_BPM },
      { at: edt('2026-07-19T10:01'), bpm: TIER_1_BPM },
    ];

    expect(bucketMinutes(shuffled, AGE_30).map((minute) => minute.startsAt)).toEqual([
      edt('2026-07-19T10:00'),
      edt('2026-07-19T10:01'),
      edt('2026-07-19T10:02'),
    ]);
  });

  it('is inclusive at every bound', () => {
    expect(tierForBpm(95, AGE_30)).toBe(1);
    expect(tierForBpm(94, AGE_30)).toBe(0);
    expect(tierForBpm(133, AGE_30)).toBe(2);
    expect(tierForBpm(162, AGE_30)).toBe(3);
    expect(tierForBpm(161, AGE_30)).toBe(2);
  });
});

describe('segmentation (fixtures §11.3, §11.4)', () => {
  const segment = (samples: HrSample[], windowEnd = WINDOW_END) =>
    segmentSessions(bucketMinutes(samples, AGE_30), windowEnd);

  it('does not close on a 9-minute gap', () => {
    // 10:00–10:14 tiered · 10:15–10:23 silent (9) · 10:24–10:33 tiered.
    const sessions = segment([
      ...minutes('2026-07-19T10:00', 15, TIER_1_BPM),
      ...minutes('2026-07-19T10:24', 10, TIER_1_BPM),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startedAt).toBe(edt('2026-07-19T10:00'));
    expect(sessions[0]?.endedAt).toBe(edt('2026-07-19T10:33'));
    // The 9 gap minutes are inside the session but contribute to no tier.
    expect(sessions[0]?.tier1Minutes).toBe(25);
  });

  /**
   * ↯ The boundary row. GDD 11 §8.1 closes a session only after **more than** 10 consecutive
   * sub-Tier-1 minutes, so exactly 10 does not close and 11 does. This is the single assertion in the
   * file that a plausible `>= 10` implementation fails.
   *
   * Note on the fixture: §11.3's boundary row states "26 min span, 25 tier-1 minutes", and those two
   * numbers cannot both describe the same timeline — 25 tiered minutes either side of a 10-minute
   * interior gap span 35. The property the row exists to pin, and states explicitly, is the strict
   * inequality; that is what is asserted here, with the minute counts read off the stated timeline.
   */
  it('does not close on a gap of exactly 10 minutes', () => {
    // 10:00–10:14 tiered · 10:15–10:24 silent (10) · 10:25–10:34 tiered.
    const sessions = segment([
      ...minutes('2026-07-19T10:00', 15, TIER_1_BPM),
      ...minutes('2026-07-19T10:25', 10, TIER_1_BPM),
    ]);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tier1Minutes).toBe(25);
    expect(sessions[0]?.endedAt).toBe(edt('2026-07-19T10:34'));
  });

  it('closes on an 11-minute gap, into two sessions with two ids', () => {
    // 10:00–10:14 tiered · 10:15–10:25 silent (11) · 10:26–10:35 tiered.
    const sessions = segment([
      ...minutes('2026-07-19T10:00', 15, TIER_1_BPM),
      ...minutes('2026-07-19T10:26', 10, TIER_1_BPM),
    ]);

    expect(sessions).toHaveLength(2);

    expect(sessions[0]?.startedAt).toBe(edt('2026-07-19T10:00'));
    // ↯ The first session ends at its last Tier 1+ minute, not at the end of the gap that closed it.
    expect(sessions[0]?.endedAt).toBe(edt('2026-07-19T10:14'));
    expect(sessions[0]?.tier1Minutes).toBe(15);
    expect(sessionIdFor(sessions[0]?.startedAt ?? 0)).toBe('hr:1784469600');

    expect(sessions[1]?.startedAt).toBe(edt('2026-07-19T10:26'));
    expect(sessions[1]?.tier1Minutes).toBe(10);
    expect(sessionIdFor(sessions[1]?.startedAt ?? 0)).toBe('hr:1784471160');
  });

  it('leaves a session open when the window ends inside the close threshold', () => {
    const samples = minutes('2026-07-19T10:00', 15, TIER_1_BPM);
    const lastMinute = edt('2026-07-19T10:14');

    expect(segment(samples, lastMinute + 5 * MINUTE_MS)[0]?.open).toBe(true);
    expect(segment(samples, lastMinute + 11 * MINUTE_MS)[0]?.open).toBe(true);
    expect(segment(samples, lastMinute + 12 * MINUTE_MS)[0]?.open).toBe(false);
  });

  it('finds nothing in a timeline that never reaches Tier 1', () => {
    expect(segment(minutes('2026-07-19T10:00', 30, 80))).toEqual([]);
  });
});

describe('day rollups (fixtures §11.5, §11.6)', () => {
  /**
   * ↯ A session crossing local midnight is **one** session whose minutes split across two dates. The
   * session is bounded by instants, not by a date — the overactivity rule reads the session while the
   * XP rules read the days, and cutting the session in half would reset a 90-minute count at
   * midnight.
   */
  it('keeps a midnight-crossing session whole and splits only the day totals', () => {
    // 23:50 on the 19th through 00:15 on the 20th, contiguous: 26 minutes.
    const sessions = segmentSessions(
      bucketMinutes(minutes('2026-07-19T23:50', 26, TIER_1_BPM), AGE_30),
      WINDOW_END,
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tier1Minutes).toBe(26);
    expect(sessionIdFor(sessions[0]?.startedAt ?? 0)).toBe('hr:1784519400');

    expect(rollUpTierMinutes(sessions[0]?.minutes ?? [], edtDates)).toEqual([
      { activityDate: '2026-07-19', tier1Minutes: 10, tier2Minutes: 0, tier3Minutes: 0 },
      { activityDate: '2026-07-20', tier1Minutes: 16, tier2Minutes: 0, tier3Minutes: 0 },
    ]);
  });

  /**
   * ↯ **Uncapped.** GDD 1 §2.2's 20-minute daily Peak cap is the server's, evaluated against the
   * day's post-merge cumulative total (fixtures §11.6). A client that pre-capped here would store 20
   * where the day really held 27, and the under-report is permanent.
   */
  it('reports raw Tier 3 minutes past the 20-minute daily cap', () => {
    const day = rollUpTierMinutes(bucketMinutes(minutes('2026-07-19T10:00', 27, TIER_3_BPM), AGE_30), edtDates);

    expect(day).toEqual([
      { activityDate: '2026-07-19', tier1Minutes: 0, tier2Minutes: 0, tier3Minutes: 27 },
    ]);
  });

  it('ignores untiered minutes', () => {
    const mixed = bucketMinutes(
      [...minutes('2026-07-19T10:00', 5, TIER_1_BPM), ...minutes('2026-07-19T10:10', 5, 80)],
      AGE_30,
    );

    expect(rollUpTierMinutes(mixed, edtDates)).toEqual([
      { activityDate: '2026-07-19', tier1Minutes: 5, tier2Minutes: 0, tier3Minutes: 0 },
    ]);
  });
});
