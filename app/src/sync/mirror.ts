import { acknowledge } from '../db/outbox';
import { transact } from '../db/transaction';
import type { SqliteDatabase } from '../db/types';
import type {
  ActivityDay,
  PlayerProfile,
  PlayerSettings,
  PlayerState,
  SettingsPayload,
  Streak,
  SyncResponse,
} from './dto';
import { type ProjectedState, leaguesFor } from './projection';

/**
 * L2, the mirror (tech-04 §5.2) — tech-01's player tables, on-device.
 *
 * Written only by a sync response, an optimistic projection, or a local write queued for replay in
 * the same transaction. Never by a UI component.
 *
 * The mirror **mirrors**; it does not merge. tech-02 §6.1's `col = col + delta` is the *server's*
 * discipline — what comes back is the absolute result, to be stored verbatim. Adding it to what the
 * mirror holds doubles every sync, and the word "delta" everywhere else makes that easy to do.
 */

export interface MirrorPlayer extends PlayerState {
  /** tech-04 §8.4 — the row currently holds an optimistic projection. */
  readonly provisional: boolean;
}

interface PlayerRow {
  id: string;
  traverser_name: string;
  timezone: string;
  created_at: string;
  level: number;
  xp_current: number;
  xp_to_next: number | null;
  xp_lifetime: number;
  unspent_stat_points: number;
  alloc_vigor: number;
  alloc_might: number;
  alloc_resolve: number;
  alloc_favor: number;
  alloc_aegis: number;
  alloc_stride: number;
  vigor_current: number;
  vigor_anchor_at: string | null;
  lifetime_steps: number;
  daily_step_goal: number;
  tutorial_completed_at: string | null;
  provisional: number;
}

export function readPlayer(db: SqliteDatabase): MirrorPlayer | null {
  const row = db.getFirstSync<PlayerRow>('SELECT * FROM player WHERE one_row = 1');

  if (row === null) {
    return null;
  }

  return {
    playerId: row.id,
    traverserName: row.traverser_name,
    timezone: row.timezone,
    createdAt: row.created_at,
    level: row.level,
    xpCurrent: row.xp_current,
    xpToNext: row.xp_to_next,
    xpLifetime: row.xp_lifetime,
    unspentStatPoints: row.unspent_stat_points,
    allocVigor: row.alloc_vigor,
    allocMight: row.alloc_might,
    allocResolve: row.alloc_resolve,
    allocFavor: row.alloc_favor,
    allocAegis: row.alloc_aegis,
    allocStride: row.alloc_stride,
    vigorCurrent: row.vigor_current,
    // Null only until the first sync after v7's migration — an anchor at creation is the honest
    // reading of "we have never been told otherwise", and the next response overwrites it.
    vigorAnchorAt: row.vigor_anchor_at ?? row.created_at,
    lifetimeSteps: row.lifetime_steps,
    dailyStepGoal: row.daily_step_goal,
    tutorialCompletedAt: row.tutorial_completed_at,
    provisional: row.provisional === 1,
  };
}

/** The whole player block, clearing `provisional`. Shared by sync and §3's repair path. */
export function writePlayer(db: SqliteDatabase, player: PlayerState): void {
  db.runSync(
    `INSERT INTO player (
       one_row, id, traverser_name, timezone, created_at, level, xp_current, xp_to_next,
       xp_lifetime, unspent_stat_points, alloc_vigor, alloc_might, alloc_resolve, alloc_favor,
       alloc_aegis, alloc_stride, vigor_current, vigor_anchor_at, lifetime_steps, daily_step_goal,
       tutorial_completed_at, provisional
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT (one_row) DO UPDATE SET
       id = excluded.id,
       traverser_name = excluded.traverser_name,
       timezone = excluded.timezone,
       created_at = excluded.created_at,
       level = excluded.level,
       xp_current = excluded.xp_current,
       xp_to_next = excluded.xp_to_next,
       xp_lifetime = excluded.xp_lifetime,
       unspent_stat_points = excluded.unspent_stat_points,
       alloc_vigor = excluded.alloc_vigor,
       alloc_might = excluded.alloc_might,
       alloc_resolve = excluded.alloc_resolve,
       alloc_favor = excluded.alloc_favor,
       alloc_aegis = excluded.alloc_aegis,
       alloc_stride = excluded.alloc_stride,
       vigor_current = excluded.vigor_current,
       vigor_anchor_at = excluded.vigor_anchor_at,
       lifetime_steps = excluded.lifetime_steps,
       daily_step_goal = excluded.daily_step_goal,
       tutorial_completed_at = excluded.tutorial_completed_at,
       provisional = 0`,
    [
      player.playerId,
      player.traverserName,
      player.timezone,
      player.createdAt,
      player.level,
      player.xpCurrent,
      player.xpToNext,
      player.xpLifetime,
      player.unspentStatPoints,
      player.allocVigor,
      player.allocMight,
      player.allocResolve,
      player.allocFavor,
      player.allocAegis,
      player.allocStride,
      player.vigorCurrent,
      player.vigorAnchorAt,
      player.lifetimeSteps,
      player.dailyStepGoal,
      player.tutorialCompletedAt,
    ],
  );
}

/**
 * The Vigor pair, written together because they are one fact — a value and the instant it held
 * (GDD 2 §6). Recovery and a settled battle are the only writers.
 */
export function writeVigor(db: SqliteDatabase, vigorCurrent: number, anchorAt: string): void {
  db.runSync('UPDATE player SET vigor_current = ?, vigor_anchor_at = ? WHERE one_row = 1', [
    vigorCurrent,
    anchorAt,
  ]);
}

/**
 * Only the three projected columns plus the flag — never a partial `writePlayer`. Level, unspent
 * points and allocations are not the client's to invent, and are what the player changes elsewhere.
 */
export function writeProjection(db: SqliteDatabase, projected: ProjectedState): void {
  db.runSync(
    `UPDATE player
        SET xp_current = ?, xp_lifetime = ?, lifetime_steps = ?, provisional = 1
      WHERE one_row = 1`,
    [projected.xpCurrent, projected.xpLifetime, projected.lifetimeSteps],
  );
}

function writeActivityDay(db: SqliteDatabase, playerId: string, day: ActivityDay): void {
  db.runSync(
    `INSERT INTO activity_day (
       player_id, activity_date, steps, tier1_minutes, tier2_minutes, tier3_minutes,
       xp_awarded, step_goal_snapshot, goal_met, streak_credit_method, rest_tagged_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (player_id, activity_date) DO UPDATE SET
       steps = excluded.steps,
       tier1_minutes = excluded.tier1_minutes,
       tier2_minutes = excluded.tier2_minutes,
       tier3_minutes = excluded.tier3_minutes,
       xp_awarded = excluded.xp_awarded,
       step_goal_snapshot = excluded.step_goal_snapshot,
       goal_met = excluded.goal_met,
       streak_credit_method = excluded.streak_credit_method,
       rest_tagged_at = excluded.rest_tagged_at`,
    [
      playerId,
      day.activityDate,
      day.steps,
      day.tier1Minutes,
      day.tier2Minutes,
      day.tier3Minutes,
      day.xpAwarded,
      day.stepGoalSnapshot,
      day.goalMet ? 1 : 0,
      day.streakCreditMethod,
      day.restTaggedAt,
    ],
  );
}

function writeStreak(db: SqliteDatabase, playerId: string, streak: Streak): void {
  db.runSync(
    `INSERT INTO streak_state (player_id, current_streak, longest_streak, last_credited_date)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (player_id) DO UPDATE SET
       current_streak = excluded.current_streak,
       longest_streak = excluded.longest_streak,
       last_credited_date = excluded.last_credited_date`,
    [playerId, streak.current, streak.longest, streak.lastCreditedDate],
  );
}

export function readActivityDay(db: SqliteDatabase, activityDate: string): ActivityDay | null {
  const row = db.getFirstSync<{
    activity_date: string;
    steps: number;
    tier1_minutes: number;
    tier2_minutes: number;
    tier3_minutes: number;
    xp_awarded: number;
    step_goal_snapshot: number;
    goal_met: number;
    streak_credit_method: string | null;
    rest_tagged_at: string | null;
  }>('SELECT * FROM activity_day WHERE activity_date = ?', [activityDate]);

  if (row === null) {
    return null;
  }

  return {
    activityDate: row.activity_date,
    steps: row.steps,
    tier1Minutes: row.tier1_minutes,
    tier2Minutes: row.tier2_minutes,
    tier3Minutes: row.tier3_minutes,
    xpAwarded: row.xp_awarded,
    stepGoalSnapshot: row.step_goal_snapshot,
    goalMet: row.goal_met === 1,
    streakCreditMethod: row.streak_credit_method,
    restTaggedAt: row.rest_tagged_at,
  };
}

/**
 * Step 12 (tech-04 §8.1): apply the response and drop the drained entries, in one transaction.
 *
 * Dropping the queue before the mirror is written loses the only local record those deltas
 * existed, and the watermark has long since passed them. The other order merely resends.
 *
 * Acknowledged from `accepted ∪ duplicate`, never from "everything we sent" — an entry the
 * server did not name must survive to be resent.
 */
export function applySyncResponse(db: SqliteDatabase, response: SyncResponse): void {
  transact(db, () => {
    writePlayer(db, response.player);
    writeStreak(db, response.player.playerId, response.streak);

    for (const day of response.activityDays) {
      writeActivityDay(db, response.player.playerId, day);
    }

    acknowledge(db, [...response.acceptedDeltaIds, ...response.duplicateDeltaIds]);
  });
}

/**
 * Backfills history the device did not live through — a restored identity, on a device whose mirror
 * has no record of those days (tech-02 §3's repair path, extended to the activity log).
 *
 * ↯ `GET /players/me` does not carry activity days, so `writeProfile` cannot repair this. Without a
 * backfill the log is empty until new days sync, and the player's own history is invisible on the
 * device that just claimed it.
 */
export function writeActivityDays(
  db: SqliteDatabase,
  playerId: string,
  days: readonly ActivityDay[],
): void {
  transact(db, () => {
    for (const day of days) {
      writeActivityDay(db, playerId, day);
    }
  });
}

function writeSettingsRow(db: SqliteDatabase, playerId: string, settings: PlayerSettings): void {
  db.runSync(
    `INSERT INTO player_settings (player_id, daily_reminder_time, music_volume, sfx_volume, birth_year)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (player_id) DO UPDATE SET
       daily_reminder_time = excluded.daily_reminder_time,
       music_volume = excluded.music_volume,
       sfx_volume = excluded.sfx_volume,
       birth_year = excluded.birth_year`,
    [
      playerId,
      settings.dailyReminderTime,
      settings.musicVolume,
      settings.sfxVolume,
      settings.birthYear,
    ],
  );
}

/** The whole authoritative document — registration and §3's repair are the same write. */
export function writeProfile(db: SqliteDatabase, profile: PlayerProfile): void {
  transact(db, () => {
    writePlayer(db, profile.player);
    writeSettingsRow(db, profile.player.playerId, profile.settings);
    writeStreak(db, profile.player.playerId, profile.streak);

    for (const zoneId of profile.unlockedZoneIds) {
      db.runSync(
        `INSERT INTO player_zone_progress (player_id, zone_id, unlocked_at)
         VALUES (?, ?, ?)
         ON CONFLICT (player_id, zone_id) DO NOTHING`,
        [profile.player.playerId, zoneId, profile.player.createdAt],
      );
    }

    writeInventory(db, profile);
  });
}

/**
 * Replaces the satchel and the gear rack from the authoritative document.
 *
 * ↯ **Replace, not merge** — the mirror mirrors (§the top of this file). The lists arrive whole, so
 * a row the server no longer has is a row this device must lose: a Salve spent on another install,
 * or gear discarded. Merging would resurrect it, and the resurrected id would then be sent in
 * `items_consumed` for a row that no longer exists anywhere.
 *
 * The equipped-slot index is unique, so the delete has to precede the inserts within the same
 * transaction — re-inserting the same weapon before clearing the old row trips it.
 */
export function writeInventory(db: SqliteDatabase, profile: PlayerProfile): void {
  const playerId = profile.player.playerId;

  db.runSync('DELETE FROM player_gear WHERE player_id = ?', [playerId]);
  db.runSync('DELETE FROM player_item WHERE player_id = ?', [playerId]);

  for (const gear of profile.gear) {
    db.runSync(
      `INSERT INTO player_gear (
         id, player_id, gear_def_id, equipped_slot, level_at_drop,
         bonus_primary, bonus_secondary, acquired_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gear.id,
        playerId,
        gear.gearDefId,
        gear.equippedSlot,
        gear.levelAtDrop,
        gear.bonusPrimary,
        gear.bonusSecondary,
        gear.acquiredAt,
      ],
    );
  }

  for (const item of profile.items) {
    db.runSync(
      'INSERT INTO player_item (id, player_id, item_def_id, acquired_at) VALUES (?, ?, ?, ?)',
      [item.id, playerId, item.itemDefId, item.acquiredAt],
    );
  }
}

/**
 * Applies a settings change locally; the caller queues the same change in the same transaction.
 *
 * Null means leave alone, matching the wire — a null meaning "clear" would make a partial update
 * destructive (§6.3).
 */
export function writeSettings(db: SqliteDatabase, settings: SettingsPayload): void {
  if (settings.dailyStepGoal !== null) {
    db.runSync('UPDATE player SET daily_step_goal = ? WHERE one_row = 1', [settings.dailyStepGoal]);
  }

  if (settings.birthYear !== null) {
    db.runSync('UPDATE player_settings SET birth_year = ?', [settings.birthYear]);
  }
}

/**
 * The activity log, newest first (GDD 13 §3.2).
 *
 * Paged from SQLite on demand, never mirrored into the store (tech-04 §5.2) — a growing table in
 * memory is how a store becomes the thing that has to be invalidated.
 */
export function readActivityDays(db: SqliteDatabase, limit: number): ActivityDay[] {
  return db
    .getAllSync<{
      activity_date: string;
      steps: number;
      tier1_minutes: number;
      tier2_minutes: number;
      tier3_minutes: number;
      xp_awarded: number;
      step_goal_snapshot: number;
      goal_met: number;
      streak_credit_method: string | null;
      rest_tagged_at: string | null;
    }>('SELECT * FROM activity_day ORDER BY activity_date DESC LIMIT ?', [limit])
    .map((row) => ({
      activityDate: row.activity_date,
      steps: row.steps,
      tier1Minutes: row.tier1_minutes,
      tier2Minutes: row.tier2_minutes,
      tier3Minutes: row.tier3_minutes,
      xpAwarded: row.xp_awarded,
      stepGoalSnapshot: row.step_goal_snapshot,
      goalMet: row.goal_met === 1,
      streakCreditMethod: row.streak_credit_method,
      restTaggedAt: row.rest_tagged_at,
    }));
}

/** GDD 13 §3.1's already-tagged state, so today's button can show it rather than re-asking. */
export function isRestTagged(db: SqliteDatabase, activityDate: string): boolean {
  return (
    db.getFirstSync<{ rest_tagged_at: string | null }>(
      'SELECT rest_tagged_at FROM activity_day WHERE activity_date = ?',
      [activityDate],
    )?.rest_tagged_at != null
  );
}

/** The tag itself. The row may not exist yet — a rest day often has no synced activity at all. */
export function writeRestTag(
  db: SqliteDatabase,
  playerId: string,
  activityDate: string,
  taggedAt: string,
  stepGoalSnapshot: number,
): void {
  db.runSync(
    `INSERT INTO activity_day (player_id, activity_date, step_goal_snapshot, rest_tagged_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (player_id, activity_date) DO UPDATE SET rest_tagged_at = excluded.rest_tagged_at`,
    [playerId, activityDate, stepGoalSnapshot, taggedAt],
  );
}

export function readStreak(db: SqliteDatabase): Streak {
  const row = db.getFirstSync<{
    current_streak: number;
    longest_streak: number;
    last_credited_date: string | null;
  }>('SELECT current_streak, longest_streak, last_credited_date FROM streak_state');

  return {
    current: row?.current_streak ?? 0,
    longest: row?.longest_streak ?? 0,
    lastCreditedDate: row?.last_credited_date ?? null,
  };
}

/**
 * Null means not yet collected (tech-03 §1.4). Without it there is no `HRmax`, so tier minutes
 * are not charged at all rather than charged against an assumed age. Step XP is unaffected.
 */
export function readBirthYear(db: SqliteDatabase): number | null {
  return (
    db.getFirstSync<{ birth_year: number | null }>('SELECT birth_year FROM player_settings')
      ?.birth_year ?? null
  );
}

/** Leagues are derived on read on both sides and stored on neither (tech-01 §4). */
export function mirrorLeagues(db: SqliteDatabase): number {
  return leaguesFor(readPlayer(db)?.lifetimeSteps ?? 0);
}
