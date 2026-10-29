import * as Notifications from 'expo-notifications';

/**
 * GDD 11 §6–7's Daily Nudge, the one notification the local-only trim keeps (M6/P4).
 *
 * Nothing runs in the background, so "only if the day's goal is not yet met" is honoured on every
 * open instead: the app cancels what it scheduled and lays out the next week again, leaving today
 * out once the goal is met, the day is tagged for rest, or the player's hour has passed. A player who stops
 * opening the app hears from it for a week, then not at all (DECISIONS 2026-10-28).
 */

/** The hours a player can pick, so every one-hour window ends by 10 PM (GDD 11 §7.1, amended). */
export const EARLIEST_HOUR = 6;
export const LATEST_HOUR = 21;
export const NUDGE_DAYS = 7;

/**
 * Android delivers within an hour of the time asked for (DECISIONS 2026-10-28), so the player is
 * told the window, never a minute: `between 7 and 8 PM`.
 */
export function reminderWindow(hour: number): string {
  const label = (h: number) => `${h % 12 === 0 ? 12 : h % 12}`;
  const half = (h: number) => (h < 12 ? 'AM' : 'PM');
  const end = hour + 1;

  return half(hour) === half(end)
    ? `between ${label(hour)} and ${label(end)} ${half(end)}`
    : `between ${label(hour)} ${half(hour)} and ${label(end)} ${half(end)}`;
}
const CHANNEL = 'daily-nudge';

/**
 * GDD 11 §6's original copy, for the days ahead that no open has read yet. It makes no claim about
 * steps, because there is nothing to claim.
 */
export const nudgeBody = (traverserName: string) =>
  `The road is waiting. A little more distance today keeps ${traverserName}'s journey moving.`;

/** What the open that schedules knows. Steps walked after it are invisible until the next open. */
export interface NudgeFacts {
  readonly traverserName: string;
  readonly hour: number;
  /** The goal is met, or the day is tagged for rest (GDD 11 §7.2). */
  readonly todayDone: boolean;
  readonly stepsToday: number;
  readonly dailyStepGoal: number;
  readonly currentStreak: number;
}

/**
 * GDD 11 §6, amended 2026-10-29: tonight's nudge says what the app knew and when, so a player who
 * walked since is told how to count it rather than that they haven't walked. A streak is named only
 * as something to keep — never a break, and never a midnight deadline, since Auto Sync Grace credits
 * a late sync (§7.2, §3).
 */
export function todayBody(facts: NudgeFacts, readAt: Date): string {
  const short = Math.max(0, facts.dailyStepGoal - facts.stepsToday);
  const open =
    facts.currentStreak >= 2
      ? `Open Traverser to count it and keep a ${facts.currentStreak}-day streak going.`
      : 'Open Traverser to count it.';

  return `As of ${clock(readAt)}, ${facts.traverserName} was ${grouped(short)} steps short of today's goal. Walked since? ${open}`;
}

/** `2:14 PM`. Built by hand, like the rest of the app's dates, rather than from the device's Intl. */
const clock = (at: Date) =>
  `${at.getHours() % 12 === 0 ? 12 : at.getHours() % 12}:${String(at.getMinutes()).padStart(2, '0')} ${at.getHours() < 12 ? 'AM' : 'PM'}`;

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * The instants to schedule, local time. Built from calendar fields rather than by adding 24 hours,
 * so a daylight-saving change cannot move a nudge an hour early or late.
 */
export function nudgeTimes(now: Date, todayDone: boolean, hour: number): Date[] {
  const at = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, 0, 0, 0);
  const first = todayDone || now >= at(0) ? 1 : 0;

  return Array.from({ length: NUDGE_DAYS }, (_, index) => at(first + index));
}

/**
 * Idempotent: whatever an earlier open scheduled is replaced, never added to. Without permission
 * it only clears, so a revoked grant leaves nothing queued behind it.
 */
export async function refreshNudges(now: Date, facts: NudgeFacts): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await Notifications.getPermissionsAsync()).granted) {
    return;
  }

  await ensureChannel();

  for (const date of nudgeTimes(now, facts.todayDone, facts.hour)) {
    const tonight = date.toDateString() === now.toDateString();

    await Notifications.scheduleNotificationAsync({
      content: { title: 'Traverser', body: tonight ? todayBody(facts, now) : nudgeBody(facts.traverserName) },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL },
    });
  }
}

/** Creating a channel that already exists only renames it, so this is safe to call every time. */
function ensureChannel(): Promise<unknown> {
  return Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/**
 * GDD 10 Screen 10's OS prompt. ↯ On Android 13+ the system will not show it until a channel
 * exists, so the channel comes first.
 */
export async function askForNudges(): Promise<boolean> {
  await ensureChannel();

  return (await Notifications.requestPermissionsAsync()).granted;
}

/** For Settings: granted, still askable, or only changeable in Android's settings. */
export async function nudgePermission(): Promise<'granted' | 'ask' | 'settings'> {
  const status = await Notifications.getPermissionsAsync();

  return status.granted ? 'granted' : status.canAskAgain ? 'ask' : 'settings';
}
