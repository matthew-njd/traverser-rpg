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

/**
 * An HR session as the server stores it (T3 §6). `sessionId` is the frozen `hr:{epoch}` key, and
 * `activityDate` is the local date its encounter bonus is charged against — the client's to decide,
 * like every other date on this surface (T2 §2).
 */
export interface SyncSession {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly activityDate: string;
  readonly tier1Minutes: number;
  readonly tier2Minutes: number;
  readonly tier3Minutes: number;
}

/** Minutes are sent as totals, not increments — the server sets rather than adds (T2 §6.3). */
export function toWireSession(session: SyncSession): Json {
  return {
    external_session_id: session.sessionId,
    started_at: session.startedAt,
    ended_at: session.endedAt,
    activity_date: session.activityDate,
    tier1_minutes: session.tier1Minutes,
    tier2_minutes: session.tier2Minutes,
    tier3_minutes: session.tier3Minutes,
  };
}

/**
 * GDD 9 §4.3's Explore tap, queued while offline (T2 §1.3).
 *
 * ↯ The operation id is minted once and never regenerated. A tap **spends a roll** from the daily
 * pool, so a resend with a fresh id would spend a second one — the server's operation ledger is
 * what stops that, and it can only stop it if the id stays the same.
 */
export interface ExplorePayload {
  readonly operationId: string;
  readonly zoneId: string;
  /** The player's own local calendar date, whose cap the roll is charged against (T2 §2). */
  readonly activityDate: string;
}

export function toWireExplore(payload: ExplorePayload): Json {
  return {
    operation_id: payload.operationId,
    zone_id: payload.zoneId,
    activity_date: payload.activityDate,
  };
}

export function toWireSyncRequest(
  deltas: readonly MintedDelta[],
  contentVersion: number,
  battles: readonly Json[] = [],
  sessions: readonly SyncSession[] = [],
  explores: readonly ExplorePayload[] = [],
  localDate: string | null = null,
): Json {
  return {
    deltas: deltas.map(toWireDelta),
    content_version: contentVersion,
    battles,
    sessions: sessions.map(toWireSession),
    explores: explores.map(toWireExplore),
    local_date: localDate,
  };
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
  /** When `vigorCurrent` was last set. The regen clock (GDD 2 §6); the server never reads it. */
  readonly vigorAnchorAt: string;
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
  /**
   * When the player tagged the day (GDD 11 §3.1), or null. Separate from `streakCreditMethod`:
   * this records the tag, while crediting the day for it is T2 §4 step 9's and lands at M4.
   */
  readonly restTaggedAt: string | null;
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
  /**
   * Encounters this sync issued (T2 §1.3). Already resolved and already charged against the day's
   * cap, so the device spends them whenever — and a grant dropped here is an encounter the player
   * earned and will never be offered again, since sync reports each one exactly once.
   */
  readonly encounterGrants: readonly EncounterGrant[];
  /** Zones step 7's dual gate opened on this sync (GDD 9 §3). News, not the full set. */
  readonly unlockedZoneIds: readonly string[];
  /**
   * Step 10's rewards (T2 §4). ↯ The only way they reach the device: the response carries no
   * inventory, so a reward dropped here is in the server's satchel and not this one until a repair.
   */
  readonly rewardsGranted: readonly RewardGranted[];
  /** Every unresolved reward parked past a cap — the whole list, so it replaces the mirror's. */
  readonly pendingRewards: readonly PendingReward[];
  /** Step 11. A threshold crossed, not a banner to show — that needs a live session (T3 §9). */
  readonly warnings: readonly Warning[];
}

export interface Warning {
  readonly code: string;
  /** The `external_session_id` this device sent. */
  readonly sessionId: string;
}

export interface PendingReward {
  readonly id: string;
  readonly kind: 'item' | 'gear';
  readonly defId: string;
  readonly levelAtDrop: number | null;
  readonly bonusPrimary: number | null;
  readonly bonusSecondary: number | null;
  readonly createdAt: string;
}

/** GDD 4 §5.2 — leave one row behind. Deleting by primary key, so a replay is harmless. */
export interface DiscardPayload {
  readonly id: string;
}

/** GDD 4 §5.2 — idempotent on the reward's own `resolved_at`, so no operation id. */
export interface ResolveRewardPayload {
  readonly rewardId: string;
  readonly kept: boolean;
  /** Kept only: the id the device minted for the row it already inserted. */
  readonly newId: string | null;
}

export function toWireResolveReward(payload: ResolveRewardPayload): Json {
  return { resolution: payload.kept ? 'kept' : 'discarded', new_id: payload.newId };
}

/** One reward row, with the server's id — mirrored verbatim like the profile's lists. */
export interface RewardGranted {
  readonly kind: 'item' | 'gear';
  readonly id: string;
  readonly defId: string;
  readonly source: string;
  readonly levelAtDrop: number | null;
  readonly bonusPrimary: number | null;
  readonly bonusSecondary: number | null;
  readonly acquiredAt: string;
}

/** @param source Which of GDD 9 §5.1's three sources produced it. All share one daily pool. */
export interface EncounterGrant {
  readonly grantId: string;
  readonly zoneId: string;
  readonly enemyId: string;
  readonly source: string;
  readonly activityDate: string;
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
    vigorAnchorAt: text(player.vigor_anchor_at, `${at}.vigor_anchor_at`),
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
    restTaggedAt: nullableText(day.rest_tagged_at, `${at}.rest_tagged_at`),
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
    encounterGrants: array(body.encounter_grants, 'encounter_grants').map((entry, index) => {
      const at = `encounter_grants[${index}]`;
      const grant = object(entry, at);

      return {
        grantId: text(grant.grant_id, `${at}.grant_id`),
        zoneId: text(grant.zone_id, `${at}.zone_id`),
        enemyId: text(grant.enemy_id, `${at}.enemy_id`),
        source: text(grant.source, `${at}.source`),
        activityDate: text(grant.activity_date, `${at}.activity_date`),
      };
    }),
    unlockedZoneIds: array(body.unlocked_zone_ids, 'unlocked_zone_ids').map((id, index) =>
      text(id, `unlocked_zone_ids[${index}]`),
    ),
    rewardsGranted: array(body.rewards_granted, 'rewards_granted').map((entry, index) => {
      const at = `rewards_granted[${index}]`;
      const reward = object(entry, at);
      const kind = text(reward.kind, `${at}.kind`);

      if (kind !== 'item' && kind !== 'gear') {
        throw new Error(`${at}.kind: expected item or gear, got ${kind}`);
      }

      return {
        kind,
        id: text(reward.id, `${at}.id`),
        defId: text(reward.def_id, `${at}.def_id`),
        source: text(reward.source, `${at}.source`),
        levelAtDrop: nullableInt(reward.level_at_drop, `${at}.level_at_drop`),
        bonusPrimary: nullableInt(reward.bonus_primary, `${at}.bonus_primary`),
        bonusSecondary: nullableInt(reward.bonus_secondary, `${at}.bonus_secondary`),
        acquiredAt: text(reward.acquired_at, `${at}.acquired_at`),
      };
    }),
    pendingRewards: array(body.pending_rewards, 'pending_rewards').map((entry, index) => {
      const at = `pending_rewards[${index}]`;
      const reward = object(entry, at);
      const kind = text(reward.kind, `${at}.kind`);

      if (kind !== 'item' && kind !== 'gear') {
        throw new Error(`${at}.kind: expected item or gear, got ${kind}`);
      }

      return {
        id: text(reward.id, `${at}.id`),
        kind,
        defId: text(reward.def_id, `${at}.def_id`),
        levelAtDrop: nullableInt(reward.level_at_drop, `${at}.level_at_drop`),
        bonusPrimary: nullableInt(reward.bonus_primary, `${at}.bonus_primary`),
        bonusSecondary: nullableInt(reward.bonus_secondary, `${at}.bonus_secondary`),
        createdAt: text(reward.created_at, `${at}.created_at`),
      };
    }),
    warnings: array(body.warnings, 'warnings').map((entry, index) => {
      const warning = object(entry, `warnings[${index}]`);

      return {
        code: text(warning.code, `warnings[${index}].code`),
        sessionId: text(warning.session_id, `warnings[${index}].session_id`),
      };
    }),
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
  /** Decimal *strings*, not numbers — tech-02 §2. */
  readonly musicVolume: string;
  readonly sfxVolume: string;
  /** Null means *not yet collected*, not "unknown age" (tech-03 §1.4). */
  readonly birthYear: number | null;
  readonly audioMuted: boolean;
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
  readonly gear: readonly OwnedGear[];
  readonly items: readonly OwnedItem[];
  /** The chosen loadout in slot order (GDD 2 §5). Empty until the player chooses one. */
  readonly equippedSkillIds: readonly string[];
}

/**
 * ↯ `id` is the **server's**, and mirroring it verbatim is the whole point of these two lists. A
 * client-minted id would name a row the server never had, so every `items_consumed` naming it would
 * delete nothing and the server's inventory would drift up by one per spend (T5 §10.3).
 */
export interface OwnedGear {
  readonly id: string;
  readonly gearDefId: string;
  /** Null when owned but not worn. At most one per slot (T1 §4). */
  readonly equippedSlot: string | null;
  readonly levelAtDrop: number;
  /** Frozen at drop time (GDD 8 §3.2) — stored as sent, never recomputed on this side either. */
  readonly bonusPrimary: number;
  readonly bonusSecondary: number | null;
  readonly acquiredAt: string;
}

export interface OwnedItem {
  readonly id: string;
  readonly itemDefId: string;
  readonly acquiredAt: string;
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
      // Absent from an API older than M6/P2, which must not fail every profile read.
      audioMuted: settings.audio_muted === undefined ? false : flag(settings.audio_muted, `${at}.settings.audio_muted`),
    },
    unlockedZoneIds: array(body.unlocked_zone_ids, `${at}.unlocked_zone_ids`).map((id, index) =>
      text(id, `${at}.unlocked_zone_ids[${index}]`),
    ),
    gear: array(body.gear, `${at}.gear`).map((row, index) => {
      const gear = object(row, `${at}.gear[${index}]`);

      return {
        id: text(gear.id, `${at}.gear[${index}].id`),
        gearDefId: text(gear.gear_def_id, `${at}.gear[${index}].gear_def_id`),
        equippedSlot: nullableText(gear.equipped_slot, `${at}.gear[${index}].equipped_slot`),
        levelAtDrop: int(gear.level_at_drop, `${at}.gear[${index}].level_at_drop`),
        bonusPrimary: int(gear.bonus_primary, `${at}.gear[${index}].bonus_primary`),
        bonusSecondary: nullableInt(gear.bonus_secondary, `${at}.gear[${index}].bonus_secondary`),
        acquiredAt: text(gear.acquired_at, `${at}.gear[${index}].acquired_at`),
      };
    }),
    items: array(body.items, `${at}.items`).map((row, index) => {
      const item = object(row, `${at}.items[${index}]`);

      return {
        id: text(item.id, `${at}.items[${index}].id`),
        itemDefId: text(item.item_def_id, `${at}.items[${index}].item_def_id`),
        acquiredAt: text(item.acquired_at, `${at}.items[${index}].acquired_at`),
      };
    }),
    // Ordered by slot on the server, so the index is the slot.
    equippedSkillIds: array(body.equipped_skills, `${at}.equipped_skills`).map((row, index) =>
      text(object(row, `${at}.equipped_skills[${index}]`).skill_id, `${at}.equipped_skills[${index}].skill_id`),
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
  /** Decimal strings, `0.00` to `1.00` (tech-02 §2). */
  readonly musicVolume?: string | null;
  readonly sfxVolume?: string | null;
  readonly audioMuted?: boolean | null;
  /** `HH:00:00`, the Daily Nudge's hour (GDD 11 §7.1, amended 2026-10-28). */
  readonly dailyReminderTime?: string | null;
}

export function toWireSettings(payload: SettingsPayload): Json {
  return {
    daily_step_goal: payload.dailyStepGoal,
    birth_year: payload.birthYear,
    music_volume: payload.musicVolume ?? null,
    sfx_volume: payload.sfxVolume ?? null,
    audio_muted: payload.audioMuted ?? null,
    daily_reminder_time: payload.dailyReminderTime ?? null,
  };
}

/**
 * GDD 11 §3.1's Rest Day tag. No operation id: every field it writes is set rather than added to,
 * so a replay lands on the same row with the same result.
 */
export interface RestDayPayload {
  /** The player's own local calendar date (T2 §2). */
  readonly activityDate: string;
  /** Full Vigor, resolved here because max needs the equipped gear (GDD 2 §6, GDD 8 §2). */
  readonly vigorAfter: number;
}

export function toWireRestDay(payload: RestDayPayload): Json {
  return { activity_date: payload.activityDate, vigor_after: payload.vigorAfter };
}

/** GDD 8 §2's equip. Set, not added, so no operation id (T2 §6.3). */
export interface EquipPayload {
  readonly playerGearId: string;
  /** Null unequips. */
  readonly equippedSlot: string | null;
  /** Only when unequipping left current Vigor above the new max; null leaves Vigor alone. */
  readonly vigorAfter: number | null;
}

export function toWireEquip(payload: EquipPayload): Json {
  return { equipped_slot: payload.equippedSlot, vigor_after: payload.vigorAfter };
}

/** GDD 2 §5's loadout, sent whole. Set, not added, so no operation id (T2 §6.3). */
export interface SkillsPayload {
  readonly skillIds: readonly string[];
}

export function toWireSkills(payload: SkillsPayload): Json {
  return { skill_ids: payload.skillIds };
}

/** GDD 4 §4's out-of-battle heal. The item row is the server's ledger, so no operation id. */
export interface UseItemPayload {
  readonly playerItemId: string;
  readonly vigorAfter: number;
}

export function toWireUseItem(payload: UseItemPayload): Json {
  return { vigor_after: payload.vigorAfter };
}
