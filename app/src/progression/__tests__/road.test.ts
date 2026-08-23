import { seedEmbeddedContent } from '../../content/store';
import type { SqliteDatabase } from '../../db/types';
import { PLAYER_ID, registeredDatabase } from '../../sync/__tests__/fixtures';
import { type RoadState, readEncounters, readRoad, segmentFill } from '../road';

/**
 * GDD 9's Road, derived on the device (M3/P5 decision).
 *
 * The rule under test is the same one `GET /players/me/map` applies server-side, and fixtures §8's
 * thresholds are what both are asserted against — so the two tiers agreeing is checkable rather
 * than assumed.
 */
const road = (steps: number, setup: (db: SqliteDatabase) => void = () => undefined): RoadState => {
  const db = registeredDatabase({ lifetime_steps: steps });

  // The seeded `zone`, `zone_gate` and `enemy` rows — `registeredDatabase` creates the schema but
  // no content, and every gate threshold below comes from the bundle rather than from this file.
  seedEmbeddedContent(db);

  db.runSync(
    "INSERT INTO player_zone_progress (player_id, zone_id, unlocked_at) VALUES (?, 'olympion', '2026-08-01T00:00:00Z')",
    [PLAYER_ID],
  );
  setup(db);

  return readRoad(db);
};

const beat = (enemyId: string) => (db: SqliteDatabase) =>
  db.runSync(
    'INSERT INTO player_bestiary (player_id, enemy_id, encounter_count, defeat_count) VALUES (?, ?, 1, 1)',
    [PLAYER_ID, enemyId],
  );

const stateOf = (state: RoadState, gateId: string) =>
  state.zones.flatMap((zone) => zone.gates).find((gate) => gate.gateId === gateId)?.state;

const zoneOf = (state: RoadState, zoneId: string) =>
  state.zones.find((zone) => zone.zoneId === zoneId);

describe('the Waymarker', () => {
  it('counts one League per thousand lifetime steps', () => {
    expect(road(0).leagues).toBe(0);
    expect(road(999).leagues).toBe(0);
    expect(road(219_999).leagues).toBe(219);
  });
});

describe('gate state', () => {
  it('locks every gate for a player who has not walked', () => {
    const state = road(0);

    expect(state.zones.flatMap((zone) => zone.gates).map((gate) => gate.state)).toEqual(
      Array(6).fill('locked'),
    );
  });

  /**
   * ↯ The off-by-one that would not look like a bug. A player standing exactly on a threshold has
   * walked the full distance; locking them out costs another thousand steps for a fight they
   * already earned, with nothing on screen to say why.
   */
  it('makes a gate available at exactly its threshold, not one League past it', () => {
    expect(stateOf(road(89_999), 'gate_cyclops')).toBe('locked');
    expect(stateOf(road(90_000), 'gate_cyclops')).toBe('available');
  });

  it('reads defeated once its boss has been beaten', () => {
    expect(stateOf(road(90_000, beat('enemy_cyclops')), 'gate_cyclops')).toBe('defeated');
  });

  /** Bosses are repeat-fightable (GDD 9 §5) — a gate never falls back to available. */
  it('stays defeated regardless of the Waymarker', () => {
    expect(stateOf(road(0, beat('enemy_cyclops')), 'gate_cyclops')).toBe('defeated');
  });

  it('points at the nearest gate still ahead', () => {
    expect(road(0).nextGate?.gateId).toBe('gate_cyclops');
    expect(road(0, beat('enemy_cyclops')).nextGate?.gateId).toBe('gate_cerberus');
  });
});

describe('zone segments', () => {
  /**
   * GDD 9 §3's dual gate, seen from the map: distance opens the *gate*, and `player_zone_progress`
   * — written by sync's step 7 — is what opens the *zone*. Walking past Cerberus's threshold
   * without beating him leaves Valheon shut.
   */
  it('opens a zone from recorded entry and never from distance alone', () => {
    const state = road(300_000);

    expect(stateOf(state, 'gate_cerberus')).toBe('available');
    expect(zoneOf(state, 'valheon')?.unlocked).toBe(false);
  });

  it('carries the threshold its segment is filled against', () => {
    const state = road(0);

    // Olympion is unlocked by no gate, so its segment starts at the origin (fixtures §8).
    expect(zoneOf(state, 'olympion')?.entryThresholdLeagues).toBe(0);
    expect(zoneOf(state, 'valheon')?.entryThresholdLeagues).toBe(220);
    expect(zoneOf(state, 'imperion')?.entryThresholdLeagues).toBe(900);
  });

  it('reports the Egyptian terminus unreleased and every other zone released', () => {
    const state = road(0);

    expect(zoneOf(state, 'egypt_tbd')?.isReleased).toBe(false);
    expect(state.zones.filter((zone) => zone.isReleased).map((zone) => zone.zoneId)).toEqual([
      'olympion',
      'valheon',
      'imperion',
    ]);
  });

  it('groups each gate under the zone it stands in', () => {
    expect(zoneOf(road(0), 'olympion')?.gates.map((gate) => gate.gateId)).toEqual([
      'gate_cyclops',
      'gate_cerberus',
    ]);
  });
});

/**
 * T2 §1.3 — sync delivers grants, already resolved and already charged against the day's cap, so
 * the device can spend them with the API switched off.
 */
describe('readEncounters', () => {
  const offer = (db: SqliteDatabase, grantId: string, enemyId: string, source = 'travel') =>
    db.runSync(
      'INSERT INTO encounter_grant (grant_id, player_id, zone_id, enemy_id, source, activity_date)' +
        " VALUES (?, ?, 'olympion', ?, ?, '2026-08-22')",
      [grantId, PLAYER_ID, enemyId, source],
    );

  const withGrants = (setup: (db: SqliteDatabase) => void) => {
    const db = registeredDatabase();

    seedEmbeddedContent(db);
    setup(db);

    return readEncounters(db);
  };

  it('joins each grant to the enemy it named', () => {
    const [encounter] = withGrants((db) => offer(db, 'g1', 'enemy_harpy', 'explore'));

    expect(encounter).toMatchObject({
      grantId: 'g1',
      zoneId: 'olympion',
      enemyId: 'enemy_harpy',
      displayName: 'Harpy',
      source: 'explore',
    });
  });

  /** UUIDv7 sorts by mint time, so the encounter that has waited longest is offered first. */
  it('offers the oldest grant first', () => {
    const encounters = withGrants((db) => {
      offer(db, '019fd954-0745-7748-9892-000000000002', 'enemy_satyr');
      offer(db, '019fd954-0745-7748-9892-000000000001', 'enemy_harpy');
    });

    expect(encounters.map((encounter) => encounter.enemyId)).toEqual([
      'enemy_harpy',
      'enemy_satyr',
    ]);
  });

  it('is empty when nothing is waiting', () => {
    expect(withGrants(() => undefined)).toEqual([]);
  });
});

/**
 * GDD 9 §4.1 — segments are **not drawn to scale**. Each fill is scaled to its own zone's
 * threshold range, or Olympion's 220 Leagues would look like nothing beside Imperion's 2,000 and
 * the first month of play would show no progress at all.
 */
describe('segmentFill', () => {
  const olympion = { entryThresholdLeagues: 0, gates: [{ leagueThreshold: 220 }] } as never;
  const valheon = { entryThresholdLeagues: 220, gates: [{ leagueThreshold: 900 }] } as never;
  const imperion = { entryThresholdLeagues: 900, gates: [{ leagueThreshold: 2900 }] } as never;

  it('fills a segment against its own range rather than the whole Road', () => {
    expect(segmentFill(olympion, valheon, 110)).toBeCloseTo(0.5);

    // The same 110 Leagues is nothing at all in Imperion's range — which is the point.
    expect(segmentFill(imperion, undefined, 110)).toBe(0);
  });

  it('is empty before the segment is reached and full once it is passed', () => {
    expect(segmentFill(valheon, imperion, 220)).toBe(0);
    expect(segmentFill(valheon, imperion, 560)).toBeCloseTo(0.5);
    expect(segmentFill(valheon, imperion, 5_000)).toBe(1);
  });

  /** The last released zone has no zone after it to bound the fill; its own final gate does. */
  it('bounds the final segment with its own last gate', () => {
    expect(segmentFill(imperion, undefined, 1_900)).toBeCloseTo(0.5);
  });
});
