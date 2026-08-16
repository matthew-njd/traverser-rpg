import type { SqliteDatabase } from '../db/types';
import type { TraverserApi } from './api';
import { writeActivityDays } from './mirror';

/**
 * Rebuilding the activity log from the server (tech-02 §3's repair path, extended to history).
 *
 * ↯ **`GET /players/me` does not carry activity days.** `activity_day` is otherwise only ever
 * written by a sync response, which reports the days *that sync touched* — so a device that did not
 * live through a day has no way to learn it happened. Every path that puts an existing player onto
 * a fresh mirror hits this: the onboarding restore, the Settings hand-over, and any future repair.
 */

/**
 * How far back a repair reproduces the log. The server caps one range at 400 days (T2 §3) and the
 * log shows 90, so this is one request with room to spare and no paging.
 */
export const HISTORY_DAYS = 365;

/** A local calendar date, matching what the client sent when the day was earned (T2 §2). */
function isoDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * True when the mirror is missing history it should have: the player has walked, and the log is
 * empty. Steps only ever arrive *as* activity days, so those two facts cannot both be true of a
 * mirror that was built by living through them.
 *
 * Bounded on purpose — it is false for a device that has simply not synced yet (no steps, no days),
 * and it stops being true the moment the repair succeeds, so a healthy device never asks again.
 */
export function needsHistoryRepair(db: SqliteDatabase): boolean {
  const state = db.getFirstSync<{ steps: number; days: number }>(
    `SELECT (SELECT lifetime_steps FROM player) AS steps,
            (SELECT count(*) FROM activity_day) AS days`,
  );

  return state !== null && state.steps > 0 && state.days === 0;
}

/**
 * Pulls the history and writes it to the mirror.
 *
 * **Never fatal.** Callers reach this having already done the thing that mattered — restored an
 * identity, or completed a sync — and a missing log fills itself in as new days arrive. Throwing
 * here would fail an operation that succeeded. tech-02 §1.2: an unreachable server is ordinary.
 */
export async function backfillActivity(
  db: SqliteDatabase,
  api: TraverserApi,
  playerId: string,
  now: Date = new Date(),
): Promise<void> {
  const from = new Date(now);

  from.setDate(from.getDate() - HISTORY_DAYS);

  try {
    writeActivityDays(db, playerId, await api.activity(isoDate(from), isoDate(now)));
  } catch {
    // The log fills in from the next sync onward; whatever brought us here still stands.
  }
}
