import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyAction } from '@/types';

const notificationMock = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  setNotificationCategoryAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
  getLastNotificationResponseAsync: vi.fn(),
}));

/** In-memory stand-ins for the DB the notification service reads (habits, done/skipped today, settings). */
const dbState = vi.hoisted(() => ({
  habits: [] as Array<Record<string, unknown>>,
  done: new Set<string>(),
  skipped: new Set<string>(),
  settings: new Map<string, string>(),
}));

vi.mock('@/db/api', () => ({
  MAX_SNOOZES_PER_DAY: 2,
  getAllActionsWithGoal: vi.fn(() => dbState.habits),
  getHabitsDoneToday: vi.fn(() => new Set(dbState.done)),
  getSkippedHabits: vi.fn(() => new Set(dbState.skipped)),
  getSetting: vi.fn((k: string) => dbState.settings.get(k) ?? null),
  getSnoozeCount: vi.fn((id: string, day: string) => Number(dbState.settings.get(`snooze:${id}:${day}`) ?? '0')),
  recordSnooze: vi.fn((id: string, day: string) => {
    const n = Number(dbState.settings.get(`snooze:${id}:${day}`) ?? '0') + 1;
    dbState.settings.set(`snooze:${id}:${day}`, String(n));
    return n;
  }),
}));

const blocking = vi.hoisted(() => ({ available: false, selection: false }));
vi.mock('@/services/appBlocking', () => ({
  isAvailable: () => blocking.available,
  hasSelection: () => blocking.selection,
}));

const habitSyncMock = vi.hoisted(() => ({ syncHabits: vi.fn(async () => {}) }));
vi.mock('@/services/habitSync', () => habitSyncMock);

let platformOS: string = 'ios';

vi.mock('react-native', () => ({
  Platform: { get OS() { return platformOS; } },
}));

vi.mock('expo-notifications', () => ({
  ...notificationMock,
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
    DATE: 'date',
  },
}));

const notifications = await import('./notifications');
const { localDayKey, shiftDayKey } = await import('@/utils/dates');

function action(overrides: Partial<DailyAction> = {}): DailyAction {
  return {
    id: 'action-1',
    goal_id: 'goal-1',
    name: 'Read',
    type: 'session',
    target_minutes: 30,
    reminder_time: '07:30',
    is_active: 1,
    sort_order: 0,
    objective_id: null,
    days_mask: 127,
    ...overrides,
  };
}

describe('notification reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationMock.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    notificationMock.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    notificationMock.scheduleNotificationAsync.mockResolvedValue('scheduled-id');
    notificationMock.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  it('parses and formats HH:MM reminder times', () => {
    expect(notifications.parseReminderTime('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(notifications.parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(notifications.parseReminderTime('24:00')).toBeNull();
    expect(notifications.parseReminderTime('09:99')).toBeNull();
    expect(notifications.parseReminderTime('soon')).toBeNull();
    expect(notifications.formatReminderTime(7, 5)).toBe('07:05');
  });

  it('maps days_mask (bit 0 = Monday) to Expo weekdays (1 = Sunday)', () => {
    expect(notifications.weekdaysForMask(127)).toEqual([]);
    expect(notifications.weekdaysForMask(0)).toEqual([]);
    expect(notifications.weekdaysForMask(0b0000001)).toEqual([2]); // Monday
    expect(notifications.weekdaysForMask(0b1000000)).toEqual([1]); // Sunday
    expect(notifications.weekdaysForMask(0b0111111)).toEqual([2, 3, 4, 5, 6, 7]); // Mon–Sat
  });

  // US-075 replaced the repeating per-habit DAILY/WEEKLY reminders with one rolling schedule, so the old
  // entry points now only resync everything (old expectations contradicted US-075's acceptance criteria).
  it('old per-habit reminder calls resync every habit instead of scheduling repeating reminders', async () => {
    await notifications.scheduleActionReminder(action(), 'Mind');
    await notifications.cancelActionReminder('action-1');
    await notifications.syncActionReminder(action({ is_active: 0 }), 'Mind');
    expect(habitSyncMock.syncHabits).toHaveBeenCalledTimes(3);
    expect(notificationMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules and detects the weekly review reminder', async () => {
    await notifications.scheduleWeeklyReviewReminder(19, 15);

    expect(notificationMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'weekly-review-sunday',
      content: {
        title: 'Weekly Review',
        body: 'Take 5 minutes to reflect on your week. Were you intentional?',
        data: { screen: 'weekly-review' },
      },
      trigger: {
        type: 'weekly',
        weekday: 1,
        hour: 19,
        minute: 15,
      },
    });

    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValueOnce([{ identifier: 'weekly-review-sunday' }]);
    await expect(notifications.isWeeklyReviewReminderScheduled()).resolves.toBe(true);
  });

  it('returns false on web without requesting permissions', async () => {
    platformOS = 'web';
    vi.resetModules();
    const webNotifications = await import('./notifications?t=' + Date.now());
    
    const result = await webNotifications.requestNotificationPermissions();
    
    expect(result).toBe(false);
    expect(notificationMock.requestPermissionsAsync).not.toHaveBeenCalled();
    
    platformOS = 'ios';
  });
});

// ─── US-075: habit start alerts ──────────────────────────────────────────────

function habitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run',
    goal_id: 'g-body',
    goal_name: 'Body',
    goal_color: '#000',
    goal_icon: 'run',
    name: 'Run',
    type: 'session',
    target_minutes: 30,
    reminder_time: '09:00',
    is_active: 1,
    sort_order: 0,
    objective_id: null,
    days_mask: 127,
    strict: 1,
    ...overrides,
  };
}

/** Today (whatever day the test runs) at hh:mm local time. */
function todayAt(hour: number, minute = 0, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function scheduledCalls() {
  return notificationMock.scheduleNotificationAsync.mock.calls.map((c) => c[0]);
}

describe('syncHabitAlerts (US-075)', () => {
  let now: Date;
  let today: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    now = todayAt(8, 0);
    vi.setSystemTime(now);
    today = localDayKey(now);
    platformOS = 'ios';
    dbState.habits = [];
    dbState.done = new Set();
    dbState.skipped = new Set();
    dbState.settings = new Map();
    blocking.available = false;
    blocking.selection = false;
    notificationMock.getPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    notificationMock.scheduleNotificationAsync.mockResolvedValue('id');
    notificationMock.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cancels old habit and legacy reminder ids (not the weekly review), then schedules DATE alerts with the category and data', async () => {
    dbState.habits = [habitRow()];
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'habit-run-2000-01-01-start', content: { data: {} } },
      { identifier: 'action-reminder-run', content: { data: {} } },
      { identifier: 'action-reminder-run-wd2', content: { data: {} } },
      { identifier: 'weekly-review-sunday', content: { data: { screen: 'weekly-review' } } },
    ]);

    await notifications.syncHabitAlerts();

    expect(notificationMock.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual([
      'habit-run-2000-01-01-start',
      'action-reminder-run',
      'action-reminder-run-wd2',
    ]);
    const calls = scheduledCalls();
    expect(calls).toHaveLength(7);
    expect(calls[0]).toEqual({
      identifier: `habit-run-${today}-start`,
      content: {
        title: '🔥 Run · Body',
        body: 'Time to start. 30 min.',
        data: { actionId: 'run', kind: 'start', scheduledAt: todayAt(9, 0).toISOString() },
        categoryIdentifier: 'habit-start',
      },
      trigger: { type: 'date', date: todayAt(9, 0) },
    });
    expect(calls.map((c) => c.identifier)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => `habit-run-${shiftDayKey(today, i)}-start`));
    expect(calls[6].trigger).toEqual({ type: 'date', date: todayAt(9, 0, 6) });
    // Cancelling happens before any scheduling.
    const lastCancel = Math.max(...notificationMock.cancelScheduledNotificationAsync.mock.invocationCallOrder);
    const firstSchedule = Math.min(...notificationMock.scheduleNotificationAsync.mock.invocationCallOrder);
    expect(lastCancel).toBeLessThan(firstSchedule);
  });

  it('skips today for a habit already done or skipped, and a habit whose time has passed', async () => {
    dbState.habits = [habitRow(), habitRow({ id: 'read', name: 'Read', goal_name: 'Mind', reminder_time: '10:00' }), habitRow({ id: 'yoga', name: 'Yoga', reminder_time: '07:00' })];
    dbState.done = new Set(['run']);
    dbState.skipped = new Set(['read']);

    await notifications.syncHabitAlerts();

    const ids = scheduledCalls().map((c) => c.identifier);
    expect(ids.filter((id) => id.includes(today))).toEqual([]);
    expect(ids).toContain(`habit-run-${shiftDayKey(today, 1)}-start`);
    expect(ids).toContain(`habit-read-${shiftDayKey(today, 1)}-start`);
    expect(ids).toContain(`habit-yoga-${shiftDayKey(today, 1)}-start`);
    expect(ids).toHaveLength(18);
  });

  it('adds heads-ups only when the setting is on, without the button category', async () => {
    dbState.habits = [habitRow()];
    dbState.settings.set('habit_headsup', '1');

    await notifications.syncHabitAlerts();

    const calls = scheduledCalls();
    expect(calls).toHaveLength(14);
    const heads = calls.find((c) => c.identifier === `habit-run-${today}-headsup`);
    expect(heads).toEqual({
      identifier: `habit-run-${today}-headsup`,
      content: {
        title: 'Run in 10 min',
        body: 'Get ready: 30 min for Body.',
        data: { actionId: 'run', kind: 'headsup', scheduledAt: todayAt(9, 0).toISOString() },
      },
      trigger: { type: 'date', date: todayAt(8, 50) },
    });
  });

  it('says apps are blocked only when blocking is available, and "Apps blocked" when strict auto-block is active', async () => {
    dbState.habits = [habitRow()];
    blocking.available = true;
    blocking.selection = true;
    await notifications.syncHabitAlerts();
    expect(scheduledCalls()[0].content.body).toBe('Time to start. 30 min, apps blocked.');

    vi.clearAllMocks();
    notificationMock.getPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    dbState.settings.set('strict_autoblock_active', '1');
    await notifications.syncHabitAlerts();
    expect(scheduledCalls()[0].content.body).toBe('Apps blocked. Tap to start your 30 min.');

    vi.clearAllMocks();
    notificationMock.getPermissionsAsync.mockResolvedValue({ status: 'granted', granted: true });
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    blocking.selection = false; // no app picked yet → no blocking line
    dbState.settings.delete('strict_autoblock_active');
    await notifications.syncHabitAlerts();
    expect(scheduledCalls()[0].content.body).toBe('Time to start. 30 min.');
  });

  it('keeps a pending snooze for an open habit but cancels it once the habit is done', async () => {
    dbState.habits = [habitRow(), habitRow({ id: 'read', name: 'Read', reminder_time: '10:00' })];
    dbState.done = new Set(['read']);
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: `snooze-run-${today}-1`, content: { data: { actionId: 'run' } } },
      { identifier: `snooze-read-${today}-1`, content: { data: { actionId: 'read' } } },
    ]);
    await notifications.syncHabitAlerts();
    expect(notificationMock.cancelScheduledNotificationAsync.mock.calls.map((c) => c[0])).toEqual([`snooze-read-${today}-1`]);
  });

  it('does nothing (and never prompts) without notification permission', async () => {
    dbState.habits = [habitRow()];
    notificationMock.getPermissionsAsync.mockResolvedValue({ status: 'denied', granted: false });
    notificationMock.getAllScheduledNotificationsAsync.mockResolvedValue([{ identifier: 'habit-run-x-start', content: { data: {} } }]);

    await notifications.syncHabitAlerts();

    expect(notificationMock.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(notificationMock.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(notificationMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('never throws, even when scheduling fails', async () => {
    dbState.habits = [habitRow()];
    notificationMock.scheduleNotificationAsync.mockRejectedValue(new Error('boom'));
    await expect(notifications.syncHabitAlerts()).resolves.toBeUndefined();
    expect(notificationMock.scheduleNotificationAsync).toHaveBeenCalledTimes(7);
  });

  it('registers the three habit buttons with the right foreground options', async () => {
    await notifications.registerHabitCategory();
    expect(notificationMock.setNotificationCategoryAsync).toHaveBeenCalledWith('habit-start', [
      { identifier: 'start-now', buttonTitle: 'Start now', options: { opensAppToForeground: true } },
      { identifier: 'snooze-10', buttonTitle: 'In 10 min', options: { opensAppToForeground: false } },
      { identifier: 'skip-today', buttonTitle: 'Skip today', options: { opensAppToForeground: false, isDestructive: false } },
    ]);
  });

  it('snoozes a start alert by 10 minutes with the same content, at most twice a day', async () => {
    const content = { title: '🔥 Run · Body', body: 'Time to start. 30 min.' };
    await expect(notifications.snoozeHabitAlert('run', content)).resolves.toBe(true);
    const fireAt = new Date(now.getTime() + 10 * 60_000);
    expect(notificationMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: `snooze-run-${today}-1`,
      content: { ...content, data: { actionId: 'run', kind: 'start', scheduledAt: fireAt.toISOString() }, categoryIdentifier: 'habit-start' },
      trigger: { type: 'date', date: fireAt },
    });

    await expect(notifications.snoozeHabitAlert('run', content)).resolves.toBe(true);
    await expect(notifications.snoozeHabitAlert('run', content)).resolves.toBe(false);
    expect(notificationMock.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(dbState.settings.get(`snooze:run:${today}`)).toBe('2');
  });

  it('rebuilds the snooze text from the habit when the original content is missing', async () => {
    dbState.habits = [habitRow()];
    await expect(notifications.snoozeHabitAlert('run')).resolves.toBe(true);
    expect(scheduledCalls()[0].content.title).toBe('🔥 Run · Body');
    expect(scheduledCalls()[0].content.body).toBe('Time to start. 30 min.');
  });
});

// ─── US-076: notification responses ──────────────────────────────────────────

describe('processNotificationResponse (US-076)', () => {
  function response(actionIdentifier: string, data: Record<string, unknown>, identifier = 'habit-run-day-start') {
    return {
      actionIdentifier,
      notification: { request: { identifier, content: { title: '🔥 Run · Body', body: 'Time to start. 30 min.', data } } },
    };
  }

  function deps(overrides: { now?: Date; canNavigate?: () => boolean } = {}) {
    let last: string | null = null;
    return {
      push: vi.fn((_href: string) => {}),
      skipHabit: vi.fn((_id: string) => {}),
      snooze: vi.fn(async (_id: string, _content?: { title?: string | null; body?: string | null }) => true),
      sync: vi.fn(async () => {}),
      seen: () => last,
      markSeen: (k: string) => {
        last = k;
      },
      ...overrides,
    };
  }

  const DEFAULT = 'expo.modules.notifications.actions.DEFAULT';
  const startAt = todayAt(9, 0);
  const data = { actionId: 'run', kind: 'start', scheduledAt: startAt.toISOString() };

  it('a tap within 30 min of the start time opens Focus and auto-starts the habit', async () => {
    const d = deps({ now: new Date(startAt.getTime() + 5 * 60_000) });
    await expect(notifications.processNotificationResponse(response(DEFAULT, data), d)).resolves.toBe(true);
    expect(d.push).toHaveBeenCalledWith(expect.stringMatching(/^\/\(tabs\)\/focus\?actionId=run&autostart=1&ts=\d+$/));
  });

  it('"Start now" more than 30 min late only preselects the habit', async () => {
    const d = deps({ now: new Date(startAt.getTime() + 45 * 60_000) });
    await notifications.processNotificationResponse(response('start-now', data), d);
    expect(d.push).toHaveBeenCalledWith(expect.stringMatching(/^\/\(tabs\)\/focus\?actionId=run&ts=\d+$/)); // late tap: no autostart
  });

  it('"In 10 min" snoozes with the original content and does not navigate', async () => {
    const d = deps({ now: startAt });
    await notifications.processNotificationResponse(response('snooze-10', data), d);
    expect(d.snooze).toHaveBeenCalledWith('run', { title: '🔥 Run · Body', body: 'Time to start. 30 min.' });
    expect(d.push).not.toHaveBeenCalled();
  });

  it('"Skip today" records the skip, then resyncs, without navigating', async () => {
    const d = deps({ now: startAt });
    await notifications.processNotificationResponse(response('skip-today', data), d);
    expect(d.skipHabit).toHaveBeenCalledWith('run');
    expect(d.sync).toHaveBeenCalledTimes(1);
    expect(d.skipHabit.mock.invocationCallOrder[0]).toBeLessThan(d.sync.mock.invocationCallOrder[0]);
    expect(d.push).not.toHaveBeenCalled();
  });

  it('opens the weekly review, or Today for a notification without a habit', async () => {
    const d = deps();
    await notifications.processNotificationResponse(response(DEFAULT, { screen: 'weekly-review' }, 'weekly-review-sunday'), d);
    await notifications.processNotificationResponse(response(DEFAULT, {}, 'other'), d);
    expect(d.push.mock.calls).toEqual([['/weekly-review'], ['/(tabs)/today']]);
  });

  it('handles the same response only once (live listener + cold-start check)', async () => {
    const d = deps({ now: startAt });
    await expect(notifications.processNotificationResponse(response('skip-today', data), d)).resolves.toBe(true);
    await expect(notifications.processNotificationResponse(response('skip-today', data), d)).resolves.toBe(false);
    expect(d.skipHabit).toHaveBeenCalledTimes(1);
    // A different button on the same notification is a new response.
    await expect(notifications.processNotificationResponse(response('snooze-10', data), d)).resolves.toBe(true);
  });

  it('before onboarding is done, buttons still work but nothing navigates', async () => {
    const d = deps({ now: startAt, canNavigate: () => false });
    await notifications.processNotificationResponse(response(DEFAULT, data, 'a'), d);
    await notifications.processNotificationResponse(response('skip-today', data, 'b'), d);
    expect(d.push).not.toHaveBeenCalled();
    expect(d.skipHabit).toHaveBeenCalledWith('run');
  });
});
