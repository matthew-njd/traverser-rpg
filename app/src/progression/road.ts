import type { SqliteDatabase } from '../db/types';

/**
 * GDD 9's Road, derived on the device from what the mirror already holds.
 *
 * Every input is local: `player.lifetime_steps`, `player_zone_progress`, `player_bestiary`, and the
 * seeded `zone` / `zone_gate` content tables. So the Map tab opens with no round trip and works
 * with the API switched off, which tech-02 §1.2 makes the ordinary case rather than the failure.
 * `GET /players/me/map` stays the authority and the repair path, exactly as `GET /players/me` is
 * for the player block — the rule it applies is the same one applied here.
 *
 * ↯ **`player_bestiary` is the one input no repair path restores.** The profile document does not
 * carry it, so after a restore onto new hardware a defeated boss reads `available` again until it
 * is beaten once more. The zone stays unlocked either way, because `player_zone_progress` *is*
 * reconciled — so the cost is a wrong badge, never a lost zone.
 */

/** GDD 9 §2.1. Also the encounter checkpoint's unit (T2 §4 step 8). */
export const STEPS_PER_LEAGUE = 1000;

/** GDD 9 §4.2's three node states, in the order a gate passes through them. */
export type GateState = 'locked' | 'available' | 'defeated';

export interface RoadZone {
  readonly zoneId: string;
  readonly displayName: string;
  readonly ordinal: number;
  /**
   * The League threshold of the gate that unlocks this zone; 0 for `olympion`, which no gate
   * unlocks. GDD 9 §4.1's per-segment progress fill is scaled against this and the next one.
   */
  readonly entryThresholdLeagues: number;
  /** Entry recorded in `player_zone_progress` — GDD 9 §3's dual gate, not distance alone. */
  readonly unlocked: boolean;
  /** False for `egypt_tbd`, GDD 9 §4.2's "coming soon" terminus. */
  readonly isReleased: boolean;
  readonly gates: readonly RoadGate[];
}

export interface RoadGate {
  readonly gateId: string;
  readonly zoneId: string;
  readonly enemyId: string;
  readonly displayName: string;
  readonly leagueThreshold: number;
  /** False for a mid-boss, which GDD 9 §4.2 lets the player walk straight past. */
  readonly isHardGate: boolean;
  readonly unlocksZoneId: string | null;
  readonly state: GateState;
}

export interface RoadState {
  /** The Waymarker. */
  readonly leagues: number;
  readonly zones: readonly RoadZone[];
  /** The nearest gate not yet defeated, for GDD 9 §4.4's "N / M Leagues to …". Null once all are. */
  readonly nextGate: RoadGate | null;
}

interface GateRow {
  id: string;
  zone_id: string;
  enemy_id: string;
  league_threshold: number;
  unlocks_zone_id: string | null;
  is_hard_gate: number;
  display_name: string | null;
  defeat_count: number | null;
}

export function readRoad(db: SqliteDatabase): RoadState {
  const leagues = Math.floor(
    (db.getFirstSync<{ lifetime_steps: number }>('SELECT lifetime_steps FROM player')
      ?.lifetime_steps ?? 0) / STEPS_PER_LEAGUE,
  );

  const zones = db.getAllSync<{
    id: string;
    display_name: string;
    ordinal: number;
    is_released: number;
    unlocked: number;
  }>(
    `SELECT z.id, z.display_name, z.ordinal, z.is_released,
            EXISTS (SELECT 1 FROM player_zone_progress p WHERE p.zone_id = z.id) AS unlocked
     FROM zone z
     ORDER BY z.ordinal`,
  );

  // The enemy's display name comes along so a gate node can be labelled without a second lookup;
  // `defeat_count` is left-joined because a boss never fought has no bestiary row at all.
  const gates = db.getAllSync<GateRow>(
    `SELECT g.id, g.zone_id, g.enemy_id, g.league_threshold, g.unlocks_zone_id, g.is_hard_gate,
            e.display_name, b.defeat_count
     FROM zone_gate g
     LEFT JOIN enemy e ON e.id = g.enemy_id
     LEFT JOIN player_bestiary b ON b.enemy_id = g.enemy_id
     ORDER BY g.league_threshold`,
  );

  const entryThreshold = new Map(
    gates
      .filter((gate) => gate.unlocks_zone_id !== null)
      .map((gate) => [gate.unlocks_zone_id as string, gate.league_threshold]),
  );

  const openZoneIds = new Set(zones.filter((zone) => zone.unlocked === 1).map((zone) => zone.id));

  const resolved = gates.map(
    (gate): RoadGate => ({
      gateId: gate.id,
      zoneId: gate.zone_id,
      enemyId: gate.enemy_id,
      displayName: gate.display_name ?? gate.enemy_id,
      leagueThreshold: gate.league_threshold,
      isHardGate: gate.is_hard_gate === 1,
      unlocksZoneId: gate.unlocks_zone_id,
      state: stateOf(
        gate.defeat_count ?? 0,
        gate.league_threshold,
        leagues,
        openZoneIds.has(gate.zone_id),
      ),
    }),
  );

  return {
    leagues,
    zones: zones.map((zone) => ({
      zoneId: zone.id,
      displayName: zone.display_name,
      ordinal: zone.ordinal,
      entryThresholdLeagues: entryThreshold.get(zone.id) ?? 0,
      unlocked: zone.unlocked === 1,
      isReleased: zone.is_released === 1,
      gates: resolved.filter((gate) => gate.zoneId === zone.id),
    })),

    // ↯ **The nearest gate still ahead by distance, which is neither the nearest unbeaten one nor
    // the nearest locked one.** GDD 9 §4.4 wants Leagues *remaining*, so a gate already reached and
    // left unfought is not it — naming one prints "121 / 90 to Cyclops", a distance the player
    // passed 31 Leagues ago. Read off the threshold rather than off `state`, because `locked` now
    // means "threshold ahead **or** zone shut" and only the first half is a distance. Gates are
    // ordered by threshold, so the first match wins; null hides the line rather than inventing one.
    nextGate:
      resolved.find((gate) => gate.leagueThreshold > leagues && gate.state !== 'defeated') ?? null,
  };
}

/**
 * GDD 9 §4.2's ladder. Defeated outranks everything, and there is no path back down — bosses are
 * repeat-fightable (§5), so the tally rising again changes nothing.
 *
 * ↯ `>=`, not `>`. A player standing exactly on a threshold has walked the full distance; locking
 * them out costs another thousand steps for a fight they already earned, with nothing on screen to
 * say why.
 *
 * ↯ **Available needs the zone open as well as the distance walked.** §4.2 defines availability by
 * distance alone, because it never anticipated the state the dual gate creates: a Waymarker past a
 * threshold inside a zone that has not been entered. Found on hardware at P9 — at 400 Leagues with
 * Valheon still shut, Fenrir read `ready to face` on the same screen that drew his segment as
 * `Locked`. Two contradicting claims, and the fight is unreachable either way (GDD 9 §3).
 */
function stateOf(
  defeatCount: number,
  threshold: number,
  leagues: number,
  zoneOpen: boolean,
): GateState {
  if (defeatCount > 0) {
    return 'defeated';
  }

  return zoneOpen && leagues >= threshold ? 'available' : 'locked';
}

/**
 * How far through its own segment the Waymarker stands, 0–1 (GDD 9 §4.1).
 *
 * ↯ **Scaled to the zone's own range, never to the Road's.** Olympion spans 220 Leagues and
 * Imperion 2,000; a fill computed against the total would leave Olympion's segment permanently
 * empty-looking and Imperion's nearly full from the moment it opens.
 */
export function segmentFill(zone: RoadZone, next: RoadZone | undefined, leagues: number): number {
  const from = zone.entryThresholdLeagues;
  const to = next?.entryThresholdLeagues ?? from;

  if (leagues <= from) {
    return 0;
  }

  // The last released zone has no zone after it to bound the fill; its own final gate does.
  const end = to > from ? to : Math.max(...zone.gates.map((gate) => gate.leagueThreshold), from + 1);

  return Math.min((leagues - from) / (end - from), 1);
}

/**
 * An encounter waiting to be fought (T2 §1.3). Already resolved and already charged against the
 * day's cap server-side, so it is spendable with the API switched off.
 */
export interface PendingEncounter {
  readonly grantId: string;
  readonly zoneId: string;
  readonly enemyId: string;
  readonly displayName: string;
  readonly source: string;
}

/** Oldest first — a UUIDv7 sorts by mint time, so the encounter waiting longest is offered first. */
export function readEncounters(db: SqliteDatabase): PendingEncounter[] {
  return db
    .getAllSync<{
      grant_id: string;
      zone_id: string;
      enemy_id: string;
      display_name: string | null;
      source: string;
    }>(
      `SELECT g.grant_id, g.zone_id, g.enemy_id, g.source, e.display_name
       FROM encounter_grant g
       LEFT JOIN enemy e ON e.id = g.enemy_id
       ORDER BY g.grant_id`,
    )
    .map((row) => ({
      grantId: row.grant_id,
      zoneId: row.zone_id,
      enemyId: row.enemy_id,
      displayName: row.display_name ?? row.enemy_id,
      source: row.source,
    }));
}

/**
 * GDD 9 §5's forward-sync animation: the stretch of a segment's fill the Waymarker walks, from where
 * it was last shown to where it stands now. Null when there is nothing to walk: no new Leagues, the
 * first open after this shipped, or a segment already full at both ends.
 */
export function walkSpan(
  zone: RoadZone,
  next: RoadZone | undefined,
  seenLeagues: number | null,
  leagues: number,
): { readonly from: number; readonly to: number } | null {
  if (seenLeagues === null || leagues <= seenLeagues) {
    return null;
  }

  const from = segmentFill(zone, next, seenLeagues);
  const to = segmentFill(zone, next, leagues);

  return to > from ? { from, to } : null;
}

/** The Leagues the Waymarker was last shown at, or null before it has ever been shown. */
export function readSeenLeagues(db: SqliteDatabase): number | null {
  return db.getFirstSync<{ leagues: number }>('SELECT leagues FROM waymarker_seen')?.leagues ?? null;
}

export function markSeenLeagues(db: SqliteDatabase, leagues: number): void {
  db.runSync(
    `INSERT INTO waymarker_seen (player_id, leagues) SELECT id, ? FROM player WHERE one_row = 1
     ON CONFLICT (player_id) DO UPDATE SET leagues = excluded.leagues`,
    [leagues],
  );
}
