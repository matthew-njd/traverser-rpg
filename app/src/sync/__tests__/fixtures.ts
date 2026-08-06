import { memoryDatabase } from '../../db/__tests__/testDatabase';
import type { SqliteDatabase } from '../../db/types';
import type { HealthProvider, HealthSnapshot } from '../../health/provider';
import { READ_BOTH } from '../../health/__tests__/fixtures';

/** The wire shape the server actually sends — `snake_case`, per tech-02 §2. */
export const PLAYER_ID = '018f3a9c-0000-7000-8000-000000000001';

export function wirePlayer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player_id: PLAYER_ID,
    traverser_name: 'Traverser',
    timezone: 'America/New_York',
    created_at: '2026-07-01T12:00:00Z',
    level: 11,
    xp_current: 400,
    xp_to_next: 1240,
    xp_lifetime: 12_400,
    unspent_stat_points: 0,
    alloc_vigor: 0,
    alloc_might: 0,
    alloc_resolve: 0,
    alloc_favor: 0,
    alloc_aegis: 0,
    alloc_stride: 0,
    vigor_current: 20,
    lifetime_steps: 205_000,
    daily_step_goal: 7000,
    tutorial_completed_at: null,
    ...overrides,
  };
}

export function wireSettings(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    daily_reminder_time: null,
    music_volume: '1.00',
    sfx_volume: '1.00',
    birth_year: 1990,
    ...overrides,
  };
}

/** `GET /players/me`, and the body of a registration. */
export function wireProfile(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    player: wirePlayer(),
    leagues: 205,
    streak: { current: 8, longest: 22, last_credited_date: '2026-08-02' },
    settings: wireSettings(),
    unlocked_zone_ids: ['olympion'],
    ...overrides,
  };
}

export function wireRegistration(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { token: 'tok-from-server', profile: wireProfile(), ...overrides };
}

export function wireSyncResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    server_time: '2026-08-03T12:00:00Z',
    content_version: 0,
    player: wirePlayer(),
    leagues: 205,
    streak: { current: 8, longest: 22, last_credited_date: '2026-08-02' },
    level_ups: [],
    activity_days: [],
    accepted_delta_ids: [],
    duplicate_delta_ids: [],
    ...overrides,
  };
}

export function wireActivityDay(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    activity_date: '2026-08-02',
    steps: 8000,
    tier1_minutes: 0,
    tier2_minutes: 45,
    tier3_minutes: 0,
    xp_awarded: 625,
    step_goal_snapshot: 7000,
    goal_met: true,
    streak_credit_method: 'goal_hit',
    ...overrides,
  };
}

/** A migrated database holding a registered player, which is what every sync path assumes. */
export function registeredDatabase(overrides: Record<string, unknown> = {}): SqliteDatabase {
  const db = memoryDatabase();
  const player = wirePlayer(overrides);

  db.runSync(
    `INSERT INTO player (
       one_row, id, traverser_name, timezone, created_at, level, xp_current, xp_to_next,
       xp_lifetime, unspent_stat_points, vigor_current, lifetime_steps, daily_step_goal
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      player.player_id as string,
      player.traverser_name as string,
      player.timezone as string,
      player.created_at as string,
      player.level as number,
      player.xp_current as number,
      player.xp_to_next as number | null,
      player.xp_lifetime as number,
      player.unspent_stat_points as number,
      player.vigor_current as number,
      player.lifetime_steps as number,
      player.daily_step_goal as number,
    ],
  );

  db.runSync('INSERT INTO player_settings (player_id, birth_year) VALUES (?, ?)', [
    player.player_id as string,
    1990,
  ]);

  return db;
}

export const EMPTY_SNAPSHOT: HealthSnapshot = {
  dailySteps: new Map(),
  sessions: [],
  consumedThrough: Date.parse('2026-08-03T12:00:00Z'),
  readSources: READ_BOTH,
};

/** A provider that reports everything granted and returns whatever snapshot it is given. */
export function fakeProvider(overrides: Partial<HealthProvider> = {}): HealthProvider {
  return {
    availability: async () => 'available',
    initialize: async () => undefined,
    requestPermissions: async () => ({ steps: true, heartRate: true }),
    grantedPermissions: async () => ({ steps: true, heartRate: true }),
    read: async () => EMPTY_SNAPSHOT,
    openSettings: () => undefined,
    ...overrides,
  };
}

/** A `fetch` stand-in returning one canned JSON response. */
export function jsonFetch(body: unknown, status = 200): jest.Mock {
  return jest.fn(async () =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: async () => Promise.resolve(body),
    } as Response),
  );
}
