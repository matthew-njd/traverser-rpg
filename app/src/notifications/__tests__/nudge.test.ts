import * as Notifications from 'expo-notifications';

import { NUDGE_DAYS, type NudgeFacts, nudgeBody, nudgeTimes, refreshNudges, reminderWindow, todayBody } from '../nudge';

jest.mock('expo-notifications', () => {
  const scheduled: unknown[] = [];

  return {
    scheduled,
    SchedulableTriggerInputTypes: { DATE: 'date' },
    AndroidImportance: { DEFAULT: 3 },
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {
      scheduled.length = 0;
    }),
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setNotificationChannelAsync: jest.fn(async () => null),
    scheduleNotificationAsync: jest.fn(async (request: unknown) => {
      scheduled.push(request);
      return String(scheduled.length);
    }),
  };
});

const mock = Notifications as unknown as { scheduled: { content: { body: string }; trigger: { date: Date } }[] };

beforeEach(() => {
  mock.scheduled.length = 0;
});

const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

const facts = (over: Partial<NudgeFacts> = {}): NudgeFacts => ({
  traverserName: 'Emdir',
  hour: 19,
  todayDone: false,
  stepsToday: 5760,
  dailyStepGoal: 7000,
  currentStreak: 0,
  ...over,
});

describe('which evenings get a nudge (GDD 11 §7)', () => {
  it('includes tonight while the goal is unmet and 7 PM is still ahead', () => {
    const times = nudgeTimes(at(2026, 10, 28, 9), false, 19);

    expect(times).toHaveLength(NUDGE_DAYS);
    expect(times[0]).toEqual(at(2026, 10, 28, 19));
    expect(times[6]).toEqual(at(2026, 11, 3, 19));
  });

  it('skips tonight once the goal is met or the day is tagged for rest', () => {
    expect(nudgeTimes(at(2026, 10, 28, 9), true, 19)[0]).toEqual(at(2026, 10, 29, 19));
  });

  it('skips tonight once 7 PM has passed', () => {
    expect(nudgeTimes(at(2026, 10, 28, 19), false, 19)[0]).toEqual(at(2026, 10, 29, 19));
  });

  it('holds 7 PM local across midnight and a daylight-saving change', () => {
    // 2026-11-01 is the autumn change in North America; adding 24 h would land on 6 PM.
    for (const time of nudgeTimes(at(2026, 10, 31, 23), false, 19)) {
      expect(time.getHours()).toBe(19);
      expect(time.getMinutes()).toBe(0);
    }

    expect(nudgeTimes(at(2026, 10, 31, 23), false, 19)[0]).toEqual(at(2026, 11, 1, 19));
  });
});

describe('scheduling', () => {
  it('replaces rather than adds, however often the app opens', async () => {
    await refreshNudges(at(2026, 10, 28, 9), facts({ todayDone: false }));
    await refreshNudges(at(2026, 10, 28, 12), facts({ todayDone: false }));

    expect(mock.scheduled).toHaveLength(NUDGE_DAYS);
  });

  it('drops tonight when an open finds the goal met', async () => {
    await refreshNudges(at(2026, 10, 28, 9), facts({ todayDone: false }));
    await refreshNudges(at(2026, 10, 28, 17), facts({ todayDone: true }));

    expect(mock.scheduled[0]?.trigger.date).toEqual(at(2026, 10, 29, 19));
  });

  it('schedules nothing, and clears what was there, without permission', async () => {
    await refreshNudges(at(2026, 10, 28, 9), facts({ todayDone: false }));
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await refreshNudges(at(2026, 10, 28, 10), facts({ todayDone: false }));

    expect(mock.scheduled).toHaveLength(0);
  });
});

it('never mentions a streak — a break is not announced (GDD 11 §7.2)', () => {
  expect(nudgeBody('Emdir')).not.toMatch(/streak/i);
  expect(nudgeBody('Emdir')).toBe(
    "The road is waiting. A little more distance today keeps Emdir's journey moving.",
  );
});

/** M6 P4 — no other path can schedule anything, so a streak reset has nothing to send with. */
it('schedules from this module and nowhere else', () => {
  const fs = jest.requireActual<typeof import('fs')>('fs');
  const path = jest.requireActual<typeof import('path')>('path');
  const root = path.join(__dirname, '..', '..');
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name !== '__tests__') {
          walk(full);
        }
      } else if (/scheduleNotificationAsync|presentNotificationAsync/.test(fs.readFileSync(full, 'utf8'))) {
        callers.push(path.relative(root, full));
      }
    }
  };

  walk(root);

  expect(callers).toEqual([path.join('notifications', 'nudge.ts')]);
});

describe('the player-chosen hour (GDD 11 §7.1, amended 2026-10-28)', () => {
  it('schedules at the chosen hour and skips today once it has passed', () => {
    expect(nudgeTimes(at(2026, 10, 28, 9), false, 8)[0]).toEqual(at(2026, 10, 29, 8));
    expect(nudgeTimes(at(2026, 10, 28, 9), false, 18)[0]).toEqual(at(2026, 10, 28, 18));
  });

  it('names the hour Android may deliver in, never a minute', () => {
    expect(reminderWindow(19)).toBe('between 7 and 8 PM');
    expect(reminderWindow(6)).toBe('between 6 and 7 AM');
    expect(reminderWindow(11)).toBe('between 11 AM and 12 PM');
    expect(reminderWindow(21)).toBe('between 9 and 10 PM');
  });
});

describe("tonight's nudge says what it knew (GDD 11 §6, amended 2026-10-29)", () => {
  const twoFourteen = at(2026, 10, 29, 14, 14);

  it('names the time of the open, the shortfall, and how to count steps since', () => {
    expect(todayBody(facts(), twoFourteen)).toBe(
      "As of 2:14 PM, Emdir was 1,240 steps short of today's goal. Walked since? Open Traverser to count it.",
    );
  });

  it('adds the streak only from two days, and only as something to keep', () => {
    expect(todayBody(facts({ currentStreak: 0 }), twoFourteen)).not.toMatch(/streak/);
    expect(todayBody(facts({ currentStreak: 1 }), twoFourteen)).not.toMatch(/streak/);
    expect(todayBody(facts({ currentStreak: 6 }), twoFourteen)).toBe(
      "As of 2:14 PM, Emdir was 1,240 steps short of today's goal. Walked since? Open Traverser to count it and keep a 6-day streak going.",
    );
  });

  it('never names a break, a loss, or a deadline', () => {
    for (const streak of [0, 1, 2, 30]) {
      expect(todayBody(facts({ currentStreak: streak }), twoFourteen)).not.toMatch(/break|lose|lost|midnight|before/i);
    }
  });

  it('carries numbers on tonight only; the days no open has read keep the original copy', async () => {
    await refreshNudges(at(2026, 10, 29, 9, 5), facts({ currentStreak: 3 }));

    expect(mock.scheduled[0]?.content.body).toBe(
      "As of 9:05 AM, Emdir was 1,240 steps short of today's goal. Walked since? Open Traverser to count it and keep a 3-day streak going.",
    );

    for (const later of mock.scheduled.slice(1)) {
      expect(later.content.body).toBe(nudgeBody('Emdir'));
    }
  });

  it('still skips tonight when the goal is met, the day is rested, or the hour has passed', async () => {
    await refreshNudges(at(2026, 10, 29, 9), facts({ todayDone: true }));
    expect(mock.scheduled.every((entry) => entry.content.body === nudgeBody('Emdir'))).toBe(true);

    await refreshNudges(at(2026, 10, 29, 19, 30), facts());
    expect(mock.scheduled[0]?.trigger.date).toEqual(at(2026, 10, 30, 19));
    expect(mock.scheduled[0]?.content.body).toBe(nudgeBody('Emdir'));
  });
});
