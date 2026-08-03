import type { MintedDelta } from '../../health/deltas';
import {
  WireFormatError,
  parseContentVersion,
  parseSyncResponse,
  toWireDelta,
  toWireSyncRequest,
} from '../dto';
import { wireActivityDay, wirePlayer, wireSyncResponse } from './fixtures';

/**
 * tech-04 §8.1's single `snake_case` ↔ `camelCase` boundary. Nowhere else in the app sees a wire key,
 * so if this module is wrong the failure is a whole payload of `undefined`s.
 */

const DELTA: MintedDelta = {
  clientDeltaId: '018f3a9c-0000-7000-8000-00000000000a',
  activityDate: '2026-08-02',
  source: 'hr',
  stepsDelta: 0,
  minutesDelta: 12,
  hrTier: 3,
  recordedAt: '2026-08-03T12:00:00.000Z',
};

describe('outbound', () => {
  it('writes every field in snake_case', () => {
    expect(toWireDelta(DELTA)).toEqual({
      client_delta_id: '018f3a9c-0000-7000-8000-00000000000a',
      activity_date: '2026-08-02',
      source: 'hr',
      steps_delta: 0,
      minutes_delta: 12,
      hr_tier: 3,
      recorded_at: '2026-08-03T12:00:00.000Z',
    });
  });

  /**
   * ↯ The id is sent exactly as minted (tech-02 §5). A mapping that regenerated it would break
   * idempotency in the one place that cannot be noticed from the client: the retry would be treated
   * as new work and the day would credit twice.
   */
  it('passes the client_delta_id through untouched', () => {
    expect(toWireDelta(DELTA).client_delta_id).toBe(DELTA.clientDeltaId);
  });

  it('sends hr_tier as null on a step delta rather than omitting it', () => {
    const steps = toWireDelta({ ...DELTA, source: 'steps', hrTier: null, stepsDelta: 2000 });

    expect(steps).toHaveProperty('hr_tier', null);
  });

  it('wraps a batch with the client content version', () => {
    expect(toWireSyncRequest([DELTA], 0)).toEqual({
      deltas: [toWireDelta(DELTA)],
      content_version: 0,
    });
  });
});

describe('inbound', () => {
  it('maps the full response into camelCase', () => {
    const parsed = parseSyncResponse(
      wireSyncResponse({
        level_ups: [{ level: 12, stat_points_awarded: 3 }],
        activity_days: [wireActivityDay()],
        accepted_delta_ids: ['a'],
        duplicate_delta_ids: ['b'],
      }),
    );

    expect(parsed.player.xpCurrent).toBe(400);
    expect(parsed.player.lifetimeSteps).toBe(205_000);
    expect(parsed.leagues).toBe(205);
    expect(parsed.streak).toEqual({ current: 8, longest: 22, lastCreditedDate: '2026-08-02' });
    expect(parsed.levelUps).toEqual([{ level: 12, statPointsAwarded: 3 }]);
    expect(parsed.activityDays[0]).toMatchObject({
      activityDate: '2026-08-02',
      tier2Minutes: 45,
      xpAwarded: 625,
      goalMet: true,
      streakCreditMethod: 'goal_hit',
    });
    expect(parsed.acceptedDeltaIds).toEqual(['a']);
    expect(parsed.duplicateDeltaIds).toEqual(['b']);
  });

  /** ↯ Null at Level 60 is meaningful — accrual has stopped with nothing banked (GDD 1 §4). */
  it('keeps a null xp_to_next as null rather than coercing it to zero', () => {
    const parsed = parseSyncResponse(
      wireSyncResponse({ player: wirePlayer({ level: 60, xp_to_next: null }) }),
    );

    expect(parsed.player.xpToNext).toBeNull();
  });

  it('keeps a null streak_credit_method as null', () => {
    const parsed = parseSyncResponse(
      wireSyncResponse({ activity_days: [wireActivityDay({ streak_credit_method: null })] }),
    );

    expect(parsed.activityDays[0]?.streakCreditMethod).toBeNull();
  });

  /**
   * ↯ A wire break must fail at the boundary, not sink into the mirror. The mirror is where the
   * player's progress lives between syncs, and a missing field arriving as `undefined` would be
   * stored as null or NaN and only surface as a wrong number on screen days later.
   */
  it('names the missing field rather than storing undefined', () => {
    const broken = wireSyncResponse({ player: wirePlayer({ xp_current: undefined }) });

    expect(() => parseSyncResponse(broken)).toThrow(WireFormatError);
    expect(() => parseSyncResponse(broken)).toThrow(/player\.xp_current/);
  });

  it('rejects a renamed field even when the shape is otherwise intact', () => {
    const renamed = wirePlayer();

    delete renamed.lifetime_steps;
    renamed.lifetimeSteps = 205_000;

    expect(() => parseSyncResponse(wireSyncResponse({ player: renamed }))).toThrow(
      /player\.lifetime_steps/,
    );
  });

  it('rejects a list that is not a list', () => {
    expect(() => parseSyncResponse(wireSyncResponse({ accepted_delta_ids: 'a' }))).toThrow(
      /accepted_delta_ids/,
    );
  });

  it('names the index of a malformed element', () => {
    expect(() =>
      parseSyncResponse(wireSyncResponse({ activity_days: [wireActivityDay(), { steps: 1 }] })),
    ).toThrow(/activity_days\[1\]/);
  });

  it('rejects a non-object body', () => {
    expect(() => parseSyncResponse('nope')).toThrow(WireFormatError);
    expect(() => parseSyncResponse(null)).toThrow(WireFormatError);
  });

  it('reads the content version poll', () => {
    expect(parseContentVersion({ version: 7 })).toBe(7);
    expect(() => parseContentVersion({})).toThrow(/version/);
  });
});
