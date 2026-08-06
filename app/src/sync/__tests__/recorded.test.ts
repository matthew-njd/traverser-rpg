import contentVersion from './recorded/content-version.json';
import playersMe from './recorded/players-me.json';
import sync from './recorded/sync.json';
import syncAccepted from './recorded/sync-accepted.json';

import { parseContentVersion, parseProfile, parseSyncResponse } from '../dto';
import { wireActivityDay, wireProfile, wireSyncResponse } from './fixtures';

/**
 * The parsers, run against **responses recorded from the real API** rather than against fixtures
 * written by the same person who wrote the parser.
 *
 * ↯ This file exists because of a bug the rest of the suite could not catch. `parseContentVersion`
 * read `version`; the server sends `content_version` (`ContentVersionResponse(int ContentVersion)`).
 * The hand-written fixture agreed with the parser, both disagreed with the server, and every test
 * passed. On the device it would have thrown `WireFormatError` at step 10 of every sync pass and
 * reported the server as `rejected` — with the deltas still safely queued, so the symptom would have
 * been "sync silently never works" and nothing would have pointed here.
 *
 * The recordings were taken at P9 from a throwaway `WireProbe` player, which was deleted afterwards;
 * the token is redacted. They are checked in deliberately — a recorded response is evidence, and
 * evidence that lives only in a terminal scrollback is not evidence. Re-record them whenever a
 * contract changes: the API is the authority, and these files are how that authority reaches the
 * client suite.
 */

describe('parsing recorded responses', () => {
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
   * ↯ `activity_days` comes back **empty**, and that is the protocol working rather than a gap in
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
});

/**
 * ↯ The guard that would have caught the original bug on its own: the synthetic fixtures the rest of
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
