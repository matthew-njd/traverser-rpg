import * as Notifications from 'expo-notifications';

/**
 * GDD 11 §6–7's Daily Nudge, the one notification the local-only trim keeps (M6/P4).
 *
 * Nothing runs in the background, so "only if the day's goal is not yet met" is honoured on every
 * open instead: the app cancels what it scheduled and lays out the next week again, leaving today
 * out once the goal is met, the day is tagged for rest, or 7 PM has passed. A player who stops
 * opening the app hears from it for a week, then not at all (DECISIONS 2026-10-28).
 */

/** GDD 11 §7.1. */
export const NUDGE_HOUR = 19;
export const NUDGE_DAYS = 7;
const CHANNEL = 'daily-nudge';

/** GDD 11 §6, verbatim. Nothing here may name a streak — a break is never announced (§7.2). */
export const nudgeBody = (traverserName: string) =>
  `The road is waiting. A little more distance today keeps ${traverserName}'s journey moving.`;

/**
 * The 7 PM instants to schedule, local time. Built from calendar fields rather than by adding
 * 24 hours, so a daylight-saving change cannot move a nudge to 6 or 8 PM.
 */
export function nudgeTimes(now: Date, todayDone: boolean): Date[] {
  const at = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, NUDGE_HOUR, 0, 0, 0);
  const first = todayDone || now >= at(0) ? 1 : 0;

  return Array.from({ length: NUDGE_DAYS }, (_, index) => at(first + index));
}

/**
 * Idempotent: whatever an earlier open scheduled is replaced, never added to. Without permission
 * it only clears, so a revoked grant leaves nothing queued behind it.
 */
export async function refreshNudges(now: Date, todayDone: boolean, traverserName: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await Notifications.getPermissionsAsync()).granted) {
    return;
  }

  await ensureChannel();

  for (const date of nudgeTimes(now, todayDone)) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Traverser', body: nudgeBody(traverserName) },
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
