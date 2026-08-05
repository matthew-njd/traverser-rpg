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
 * Written **only** by a sync response, by an optimistic projection, or by a local write that is
 * simultaneously queued for replay. Never by a UI component.
 *
 * ↯ The mirror *mirrors*; it does not merge. tech-02 §6.1's additive rule is the **server's**
 * discipline — every write there is `col = col + delta` so nothing can erase real effort. What comes
 * back on the wire is the result of that merge, an absolute authoritative total, and the client's
 * job is to store it verbatim. Adding a response to what the mirror already holds would double every
 * sync, and it is an easy mistake to make precisely because the word "delta" is everywhere else in
 * this protocol.
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
    lifetimeSteps: row.lifetime_steps,
    dailyStepGoal: row.daily_step_goal,
    tutorialCompletedAt: row.tutorial_completed_at,
    provisional: row.provisional === 1,
  };
}

/**
 * Writes the whole player block, clearing `provisional`. Used for a sync response and for
 * `GET /players/me`'s one-shot repair path (tech-02 §3) — which is the same operation, and is why it
 * takes a {@link PlayerState} rather than a `SyncResponse`.
 */
export function writePlayer(db: SqliteDatabase, player: PlayerState): void {
  db.runSync(
    `INSERT INTO player (
       one_row, id, traverser_name, timezone, created_at, level, xp_current, xp_to_next,
       xp_lifetime, unspent_stat_points, alloc_vigor, alloc_might, alloc_resolve, alloc_favor,
       alloc_aegis, alloc_stride, vigor_current, lifetime_steps, daily_step_goal,
       tutorial_completed_at, provisional
     )
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
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
      player.lifetimeSteps,
      player.dailyStepGoal,
      player.tutorialCompletedAt,
    ],
  );
}

/**
 * ↯ Touches only the three projected columns and sets the flag — it is not a partial `writePlayer`.
 * A projection that also rewrote level, unspent points or allocations would be inventing authority
 * it does not have, and the fields it would overwrite are exactly the ones the player can change
 * from another screen while a sync is in flight.
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
       xp_awarded, step_goal_snapshot, goal_met, streak_credit_method
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (player_id, activity_date) DO UPDATE SET
       steps = excluded.steps,
       tier1_minutes = excluded.tier1_minutes,
       tier2_minutes = excluded.tier2_minutes,
       tier3_minutes = excluded.tier3_minutes,
       xp_awarded = excluded.xp_awarded,
       step_goal_snapshot = excluded.step_goal_snapshot,
       goal_met = excluded.goal_met,
       streak_credit_method = excluded.streak_credit_method`,
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
  };
}

/**
 * Step 12 of the foreground pass (tech-04 §8.1): apply the response and drop the drained entries,
 * **in one transaction**.
 *
 * ↯ The two halves must not be separable. If the mirror were updated and the crash came before the
 * outbox rows were deleted, the next pass would resend deltas the server has already merged — safe,
 * because the ledger recognises the ids, but noise. The dangerous direction is the other one:
 * dropping the queue first and crashing before the mirror is written loses the only local record
 * that those deltas were ever produced, and the health watermark has long since moved past them.
 *
 * ↯ Entries are acknowledged from `accepted ∪ duplicate`, **never from "everything we sent"**. An
 * entry the server did not name has not been accounted for and must survive to be resent — that is
 * the difference between at-least-once delivery and losing a day's steps to a truncated response.
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

/**
 * The whole authoritative document — registration's response and tech-02 §3's repair path are the
 * same write, which is why they share a function. A repair that touched only some tables would
 * leave the rest of the mirror stale in exactly the situation where drift was already suspected.
 */
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
  });
}

/**
 * Applies a settings change locally. The caller queues the same change for replay in the same
 * transaction (tech-02 §3: these endpoints apply optimistically to the mirror and replay to the
 * server) — which is why this writes and does not queue.
 *
 * Null means *leave alone*, matching the wire: last-write-wins is correct for point-in-time
 * preferences, and a null that meant "clear" would make a partial update destructive (§6.3).
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
 * ↯ Paged out of SQLite on demand and **never mirrored into the store** (tech-04 §5.2) — the store
 * holds the small hot slice, and a growing table cached in memory is how a store becomes the thing
 * that has to be invalidated.
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
    }));
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
 * ↯ Null means **not yet collected**, not "unknown age" (tech-03 §1.4). Without it there is no
 * `HRmax`, so tier minutes are not charged at all rather than being charged against some assumed
 * age — which would silently misclassify every workout until the player noticed. Step XP is
 * unaffected either way.
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
