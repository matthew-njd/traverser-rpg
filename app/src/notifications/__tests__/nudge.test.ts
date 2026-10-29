import * as Notifications from 'expo-notifications';

import { NUDGE_DAYS, nudgeBody, nudgeTimes, refreshNudges } from '../nudge';

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

const mock = Notifications as unknown as { scheduled: { trigger: { date: Date } }[] };

beforeEach(() => {
  mock.scheduled.length = 0;
});

const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h, 0, 0, 0);

describe('which evenings get a nudge (GDD 11 §7)', () => {
  it('includes tonight while the goal is unmet and 7 PM is still ahead', () => {
    const times = nudgeTimes(at(2026, 10, 28, 9), false);

    expect(times).toHaveLength(NUDGE_DAYS);
    expect(times[0]).toEqual(at(2026, 10, 28, 19));
    expect(times[6]).toEqual(at(2026, 11, 3, 19));
  });

  it('skips tonight once the goal is met or the day is tagged for rest', () => {
    expect(nudgeTimes(at(2026, 10, 28, 9), true)[0]).toEqual(at(2026, 10, 29, 19));
  });

  it('skips tonight once 7 PM has passed', () => {
    expect(nudgeTimes(at(2026, 10, 28, 19), false)[0]).toEqual(at(2026, 10, 29, 19));
  });

  it('holds 7 PM local across midnight and a daylight-saving change', () => {
    // 2026-11-01 is the autumn change in North America; adding 24 h would land on 6 PM.
    for (const time of nudgeTimes(at(2026, 10, 31, 23), false)) {
      expect(time.getHours()).toBe(19);
      expect(time.getMinutes()).toBe(0);
    }

    expect(nudgeTimes(at(2026, 10, 31, 23), false)[0]).toEqual(at(2026, 11, 1, 19));
  });
});

describe('scheduling', () => {
  it('replaces rather than adds, however often the app opens', async () => {
    await refreshNudges(at(2026, 10, 28, 9), false, 'Emdir');
    await refreshNudges(at(2026, 10, 28, 12), false, 'Emdir');

    expect(mock.scheduled).toHaveLength(NUDGE_DAYS);
  });

  it('drops tonight when an open finds the goal met', async () => {
    await refreshNudges(at(2026, 10, 28, 9), false, 'Emdir');
    await refreshNudges(at(2026, 10, 28, 17), true, 'Emdir');

    expect(mock.scheduled[0]?.trigger.date).toEqual(at(2026, 10, 29, 19));
  });

  it('schedules nothing, and clears what was there, without permission', async () => {
    await refreshNudges(at(2026, 10, 28, 9), false, 'Emdir');
    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await refreshNudges(at(2026, 10, 28, 10), false, 'Emdir');

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
