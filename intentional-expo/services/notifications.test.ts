import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyAction } from '@/types';

const notificationMock = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
}));

let platformOS: string = 'ios';

vi.mock('react-native', () => ({
  Platform: { get OS() { return platformOS; } },
}));

vi.mock('expo-notifications', () => ({
  ...notificationMock,
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
  },
}));

const notifications = await import('./notifications');

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

  it('cancels the prior action reminder before scheduling the next one', async () => {
    await notifications.scheduleActionReminder(action(), 'Mind');

    expect(notificationMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith('action-reminder-action-1');
    expect(notificationMock.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'action-reminder-action-1',
      content: {
        title: 'Time for Read',
        body: 'For your Mind pillar',
        data: { actionId: 'action-1' },
      },
      trigger: {
        type: 'daily',
        hour: 7,
        minute: 30,
      },
    });
  });

  it('maps days_mask (bit 0 = Monday) to Expo weekdays (1 = Sunday)', () => {
    expect(notifications.weekdaysForMask(127)).toEqual([]);
    expect(notifications.weekdaysForMask(0)).toEqual([]);
    expect(notifications.weekdaysForMask(0b0000001)).toEqual([2]); // Monday
    expect(notifications.weekdaysForMask(0b1000000)).toEqual([1]); // Sunday
    expect(notifications.weekdaysForMask(0b0111111)).toEqual([2, 3, 4, 5, 6, 7]); // Mon–Sat
  });

  it('schedules a Mon/Wed/Fri habit only on those days, and cancels every old reminder first', async () => {
    await notifications.scheduleActionReminder(action({ days_mask: 0b0010101 }), 'Body');
    const triggers = notificationMock.scheduleNotificationAsync.mock.calls.map((c) => c[0].trigger);
    expect(triggers).toEqual([
      { type: 'weekly', weekday: 2, hour: 7, minute: 30 },
      { type: 'weekly', weekday: 4, hour: 7, minute: 30 },
      { type: 'weekly', weekday: 6, hour: 7, minute: 30 },
    ]);
    expect(notificationMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith('action-reminder-action-1');
    expect(notificationMock.cancelScheduledNotificationAsync).toHaveBeenCalledWith('action-reminder-action-1-wd7');
  });

  it('schedules nothing for a habit with no scheduled day', async () => {
    await notifications.scheduleActionReminder(action({ days_mask: 0 }), 'Body');
    expect(notificationMock.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule invalid or denied reminders', async () => {
    await notifications.scheduleActionReminder(action({ reminder_time: '25:00' }), 'Mind');
    expect(notificationMock.scheduleNotificationAsync).not.toHaveBeenCalled();

    notificationMock.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    notificationMock.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await notifications.scheduleActionReminder(action(), 'Mind');
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

  it('treats canceling a missing action reminder as a no-op', async () => {
    notificationMock.cancelScheduledNotificationAsync.mockRejectedValueOnce(new Error('not found'));

    await expect(notifications.cancelActionReminder('action-1')).resolves.toBeUndefined();
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
