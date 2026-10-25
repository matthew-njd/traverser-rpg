import contentVersion from './recorded/content-version.json';
import playersMe from './recorded/players-me.json';
import sync from './recorded/sync.json';
import syncAccepted from './recorded/sync-accepted.json';
import syncReward from './recorded/sync-reward.json';

import { parseContentVersion, parseProfile, parseSyncResponse } from '../dto';
import { wireActivityDay, wireProfile, wireSyncResponse } from './fixtures';

/**
 * The parsers, run against **responses recorded from the real API** rather than against fixtures
 * written by the same person who wrote the parser.
 *
 * Exists because of a bug the rest of the suite could not catch: `parseContentVersion` read
 * `version` where the server sends `content_version`. The hand-written fixture agreed with the
 * parser, both disagreed with the server, and every test passed.
 *
 * Recorded at P9 from a throwaway player, token redacted. **Re-record whenever a contract changes**
 * — the API is the authority, and these files are how it reaches the client suite.
 */

describe('parsing recorded responses', () => {
  /** Step 10's first real response: an 8,000-step day past the 7,000 goal pays one common item. */
  it('reads a daily-goal reward', () => {
    const [reward] = parseSyncResponse(syncReward).rewardsGranted;

    expect(reward).toMatchObject({ kind: 'item', defId: 'item_brinestone', source: 'daily_goal', bonusPrimary: null });
  });

  it('reads the content version poll', () => {
    expect(parseContentVersion(contentVersion)).toBe(1);
  });

  it('reads the profile / repair document', () => {
    const profile = parseProfile(playersMe, 'response');

    expect(profile.player.traverserName).toBe('WireProbe');
    expect(profile.player.level).toBe(4);
    expect(profile.player.lifetimeSteps).toBe(8000);
    expect(profile.leagues).toBe(8);
    expect(profile.unlockedZoneIds).toEqual(['olympion']);
    expect(profile.settings.musicVolume).toBe('1.00');
    expect(profile.settings.birthYear).toBeNull();
  });

  /**
   * A real replay of an already-consumed delta.
   *
   * `activity_days` comes back **empty**, and that is the protocol working rather than a gap in
   * the recording. tech-02 §4 step 3 rolls up only the rows step 1's `RETURNING` produced, so a
   * replay has nothing to roll up — the same property the whole idempotency design rests on, seen
   * from the client side for the first time.
   */
  it('reads a replayed sync response', () => {
    const response = parseSyncResponse(sync);

    expect(response.acceptedDeltaIds).toEqual([]);
    expect(response.duplicateDeltaIds).toHaveLength(1);
    expect(response.levelUps).toEqual([]);
    expect(response.activityDays).toEqual([]);
    // The player block still carries the totals from when the delta was first accepted: 8,000 steps
    // at 1 XP per 20, plus 45 vigorous minutes at 5 — tech-02 §4's worked example.
    expect(response.player.xpLifetime).toBe(625);
  });

  it('reads a sync response that accepted a delta', () => {
    const response = parseSyncResponse(syncAccepted);

    expect(response.acceptedDeltaIds).toHaveLength(1);
    expect(response.duplicateDeltaIds).toEqual([]);
    // 12 Peak minutes, all inside the 20-minute daily cap, at 7 XP each.
    expect(response.activityDays[0]).toMatchObject({
      activityDate: '2026-08-06',
      tier3Minutes: 12,
      xpAwarded: 84,
      goalMet: false,
      streakCreditMethod: null,
    });
  });

  /**
   * The same response carried an Explore tap, so step 8's grant shape is recorded rather than
   * imagined. The enemy is drawn at random from the zone's wild roster and is deliberately not
   * asserted — everything around it is fixed.
   */
  it('reads an encounter grant off a real sync', () => {
    const grant = parseSyncResponse(syncAccepted).encounterGrants[0];

    expect(grant).toMatchObject({
      zoneId: 'olympion',
      source: 'explore',
      activityDate: '2026-08-06',
    });
    expect(grant?.enemyId).toMatch(/^enemy_/);
  });
});

/**
 * The guard that would have caught the original bug on its own: the synthetic fixtures the rest of
 * the suite builds on must carry **exactly** the key set the server sends. A field the server has
 * and the fixture lacks is a parser that was never exercised; a field the fixture has and the server
 * does not is a parser asserting something untrue.
 */
describe('synthetic fixtures match the real shape', () => {
  const keysOf = (value: unknown): string[] =>
    Object.keys(value as Record<string, unknown>).sort();

  it('matches the profile document', () => {
    expect(keysOf(wireProfile())).toEqual(keysOf(playersMe));
    expect(keysOf(wireProfile().player)).toEqual(keysOf(playersMe.player));
    expect(keysOf(wireProfile().settings)).toEqual(keysOf(playersMe.settings));
    expect(keysOf(wireProfile().streak)).toEqual(keysOf(playersMe.streak));
  });

  it('matches the sync response', () => {
    expect(keysOf(wireSyncResponse())).toEqual(keysOf(sync));
    expect(keysOf(wireSyncResponse().player)).toEqual(keysOf(sync.player));
  });

  it('matches an activity day', () => {
    expect(keysOf(wireActivityDay())).toEqual(keysOf(syncAccepted.activity_days[0]));
  });
});
