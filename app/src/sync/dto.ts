import type { MintedDelta } from '../health/deltas';

/**
 * **The one place in the app that sees a wire key** (tech-04 §8.1).
 *
 * Above this module everything is camelCase domain shapes; below it everything is JSON. Let a
 * `steps_delta` leak upward and the boundary becomes wherever someone last touched it.
 *
 * Explicit parsing, never a cast: a cast lets a renamed field arrive `undefined`, land in the
 * mirror as `NaN`, and surface as a wrong number days later. Fail loudly, naming the field.
 */

export class WireFormatError extends Error {
  constructor(field: string) {
    super(`The server response is missing or malformed at "${field}".`);
    this.name = 'WireFormatError';
  }
}

type Json = Record<string, unknown>;

function object(value: unknown, field: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WireFormatError(field);
  }

  return value as Json;
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new WireFormatError(field);
  }

  return value;
}

function int(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new WireFormatError(field);
  }

  return value;
}

function nullableInt(value: unknown, field: string): number | null {
  return value === null || value === undefined ? null : int(value, field);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new WireFormatError(field);
  }

  return value;
}

function nullableText(value: unknown, field: string): string | null {
  return value === null || value === undefined ? null : text(value, field);
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new WireFormatError(field);
  }

  return value;
}

// ---- Outbound ---------------------------------------------------------------------------------

/** `client_delta_id` is sent exactly as minted (tech-02 §5) — never regenerated here. */
export function toWireDelta(delta: MintedDelta): Json {
  return {
    client_delta_id: delta.clientDeltaId,
    activity_date: delta.activityDate,
    source: delta.source,
    steps_delta: delta.stepsDelta,
    minutes_delta: delta.minutesDelta,
    hr_tier: delta.hrTier,
    recorded_at: delta.recordedAt,
  };
}

export function toWireSyncRequest(
  deltas: readonly MintedDelta[],
  contentVersion: number,
  battles: readonly Json[] = [],
): Json {
  return { deltas: deltas.map(toWireDelta), content_version: contentVersion, battles };
}

// ---- Inbound ----------------------------------------------------------------------------------

export interface PlayerState {
  readonly playerId: string;
  readonly traverserName: string;
  readonly timezone: string;
  readonly createdAt: string;
  readonly level: number;
  readonly xpCurrent: number;
  /** Null at Level 60 — the schema's way of saying accrual stops with nothing banked (GDD 1 §4). */
  readonly xpToNext: number | null;
  readonly xpLifetime: number;
  readonly unspentStatPoints: number;
  readonly allocVigor: number;
  readonly allocMight: number;
  readonly allocResolve: number;
  readonly allocFavor: number;
  readonly allocAegis: number;
  readonly allocStride: number;
  readonly vigorCurrent: number;
  readonly lifetimeSteps: number;
  readonly dailyStepGoal: number;
  readonly tutorialCompletedAt: string | null;
}

export interface ActivityDay {
  readonly activityDate: string;
  readonly steps: number;
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
  readonly xpAwarded: number;
  readonly stepGoalSnapshot: number;
  readonly goalMet: boolean;
  readonly streakCreditMethod: string | null;
}

export interface Streak {
  readonly current: number;
  readonly longest: number;
  readonly lastCreditedDate: string | null;
}

/** @param level The level *reached*, not the one left behind. */
export interface LevelUp {
  readonly level: number;
  readonly statPointsAwarded: number;
}

export interface SyncResponse {
  readonly serverTime: string;
  readonly contentVersion: number;
  readonly player: PlayerState;
  readonly leagues: number;
  readonly streak: Streak;
  readonly levelUps: readonly LevelUp[];
  readonly activityDays: readonly ActivityDay[];
  /**
   * Both lists mean "stop resending" to the queue; an entry the server did not name must survive
   * (tech-02 §4, §5). The split exists only to make a duplicate-heavy sync visible in logs.
   */
  readonly acceptedDeltaIds: readonly string[];
  readonly duplicateDeltaIds: readonly string[];
}

export function parsePlayerState(value: unknown, at = 'player'): PlayerState {
  const player = object(value, at);

  return {
    playerId: text(player.player_id, `${at}.player_id`),
    traverserName: text(player.traverser_name, `${at}.traverser_name`),
    timezone: text(player.timezone, `${at}.timezone`),
    createdAt: text(player.created_at, `${at}.created_at`),
    level: int(player.level, `${at}.level`),
    xpCurrent: int(player.xp_current, `${at}.xp_current`),
    xpToNext: nullableInt(player.xp_to_next, `${at}.xp_to_next`),
    xpLifetime: int(player.xp_lifetime, `${at}.xp_lifetime`),
    unspentStatPoints: int(player.unspent_stat_points, `${at}.unspent_stat_points`),
    allocVigor: int(player.alloc_vigor, `${at}.alloc_vigor`),
    allocMight: int(player.alloc_might, `${at}.alloc_might`),
    allocResolve: int(player.alloc_resolve, `${at}.alloc_resolve`),
    allocFavor: int(player.alloc_favor, `${at}.alloc_favor`),
    allocAegis: int(player.alloc_aegis, `${at}.alloc_aegis`),
    allocStride: int(player.alloc_stride, `${at}.alloc_stride`),
    vigorCurrent: int(player.vigor_current, `${at}.vigor_current`),
    lifetimeSteps: int(player.lifetime_steps, `${at}.lifetime_steps`),
    dailyStepGoal: int(player.daily_step_goal, `${at}.daily_step_goal`),
    tutorialCompletedAt: nullableText(player.tutorial_completed_at, `${at}.tutorial_completed_at`),
  };
}

function parseActivityDay(value: unknown, index: number): ActivityDay {
  const at = `activity_days[${index}]`;
  const day = object(value, at);

  return {
    activityDate: text(day.activity_date, `${at}.activity_date`),
    steps: int(day.steps, `${at}.steps`),
    tier1Minutes: int(day.tier1_minutes, `${at}.tier1_minutes`),
    tier2Minutes: int(day.tier2_minutes, `${at}.tier2_minutes`),
    tier3Minutes: int(day.tier3_minutes, `${at}.tier3_minutes`),
    xpAwarded: int(day.xp_awarded, `${at}.xp_awarded`),
    stepGoalSnapshot: int(day.step_goal_snapshot, `${at}.step_goal_snapshot`),
    goalMet: flag(day.goal_met, `${at}.goal_met`),
    streakCreditMethod: nullableText(day.streak_credit_method, `${at}.streak_credit_method`),
  };
}

/**
 * `GET /players/me/activity`, which answers with a bare array rather than a wrapped object — the
 * one read on this surface that does (tech-02 §3).
 */
export function parseActivityDays(value: unknown): readonly ActivityDay[] {
  return array(value, 'activity_days').map(parseActivityDay);
}

export function parseSyncResponse(value: unknown): SyncResponse {
  const body = object(value, 'response');
  const streak = object(body.streak, 'streak');

  return {
    serverTime: text(body.server_time, 'server_time'),
    contentVersion: int(body.content_version, 'content_version'),
    player: parsePlayerState(body.player),
    leagues: int(body.leagues, 'leagues'),
    streak: {
      current: int(streak.current, 'streak.current'),
      longest: int(streak.longest, 'streak.longest'),
      lastCreditedDate: nullableText(streak.last_credited_date, 'streak.last_credited_date'),
    },
    levelUps: array(body.level_ups, 'level_ups').map((entry, index) => {
      const at = `level_ups[${index}]`;
      const levelUp = object(entry, at);

      return {
        level: int(levelUp.level, `${at}.level`),
        statPointsAwarded: int(levelUp.stat_points_awarded, `${at}.stat_points_awarded`),
      };
    }),
    activityDays: array(body.activity_days, 'activity_days').map(parseActivityDay),
    acceptedDeltaIds: array(body.accepted_delta_ids, 'accepted_delta_ids').map((id, index) =>
      text(id, `accepted_delta_ids[${index}]`),
    ),
    duplicateDeltaIds: array(body.duplicate_delta_ids, 'duplicate_delta_ids').map((id, index) =>
      text(id, `duplicate_delta_ids[${index}]`),
    ),
  };
}

/**
 * The field is `content_version`, **not** `version`. Wrong until P9: the fixture was written from
 * the C# record's shape rather than a real response, so fixture and parser agreed and both
 * disagreed with the server. Recorded responses now guard this — see `__tests__/recorded/`.
 */
export function parseContentVersion(value: unknown): number {
  return int(object(value, 'response').content_version, 'content_version');
}

// ---- Registration and the repair path ---------------------------------------------------------

export interface PlayerSettings {
  readonly dailyReminderTime: string | null;
  /** Decimal *strings*, not numbers — tech-02 §2. M5 owns the sliders; the mirror carries them. */
  readonly musicVolume: string;
  readonly sfxVolume: string;
  /** Null means *not yet collected*, not "unknown age" (tech-03 §1.4). */
  readonly birthYear: number | null;
}

/**
 * `GET /players/me` and a registration body — tech-02 §3's one-shot repair path. Drift is fixed by
 * refetching the whole document, so anything the mirror persists must appear here.
 */
export interface PlayerProfile {
  readonly player: PlayerState;
  readonly leagues: number;
  readonly streak: Streak;
  readonly settings: PlayerSettings;
  readonly unlockedZoneIds: readonly string[];
}

export interface Registration {
  /** Returned exactly once — only its SHA-256 is stored. Must reach secure storage first. */
  readonly token: string;
  readonly profile: PlayerProfile;
}

export function parseProfile(value: unknown, at = 'profile'): PlayerProfile {
  const body = object(value, at);
  const streak = object(body.streak, `${at}.streak`);
  const settings = object(body.settings, `${at}.settings`);

  return {
    player: parsePlayerState(body.player, `${at}.player`),
    leagues: int(body.leagues, `${at}.leagues`),
    streak: {
      current: int(streak.current, `${at}.streak.current`),
      longest: int(streak.longest, `${at}.streak.longest`),
      lastCreditedDate: nullableText(streak.last_credited_date, `${at}.streak.last_credited_date`),
    },
    settings: {
      dailyReminderTime: nullableText(
        settings.daily_reminder_time,
        `${at}.settings.daily_reminder_time`,
      ),
      musicVolume: text(settings.music_volume, `${at}.settings.music_volume`),
      sfxVolume: text(settings.sfx_volume, `${at}.settings.sfx_volume`),
      birthYear: nullableInt(settings.birth_year, `${at}.settings.birth_year`),
    },
    unlockedZoneIds: array(body.unlocked_zone_ids, `${at}.unlocked_zone_ids`).map((id, index) =>
      text(id, `${at}.unlocked_zone_ids[${index}]`),
    ),
  };
}

export function parseRegistration(value: unknown): Registration {
  const body = object(value, 'response');

  return { token: text(body.token, 'token'), profile: parseProfile(body.profile) };
}

export function toWireRegistration(request: {
  playerId: string;
  traverserName: string;
  timezone: string;
}): Json {
  return {
    player_id: request.playerId,
    traverser_name: request.traverserName,
    timezone: request.timezone,
  };
}

// ---- Progression writes (tech-02 §3) ----------------------------------------------------------

/** The six stats are locked by GDD 1 §5; a delta map would buy an open key space to validate down. */
export interface AllocationPayload {
  readonly operationId: string;
  readonly vigor: number;
  readonly might: number;
  readonly resolve: number;
  readonly favor: number;
  readonly aegis: number;
  readonly stride: number;
}

export function toWireAllocation(payload: AllocationPayload): Json {
  return {
    operation_id: payload.operationId,
    vigor: payload.vigor,
    might: payload.might,
    resolve: payload.resolve,
    favor: payload.favor,
    aegis: payload.aegis,
    stride: payload.stride,
  };
}

/** Null means *leave alone*. Last-write-wins is correct for point-in-time preferences (§6.3). */
export interface SettingsPayload {
  readonly dailyStepGoal: number | null;
  readonly birthYear: number | null;
}

export function toWireSettings(payload: SettingsPayload): Json {
  return { daily_step_goal: payload.dailyStepGoal, birth_year: payload.birthYear };
}
