/**
 * Notification service — US-020 (action reminders) + US-036 (weekly review).
 * Uses expo-notifications. iOS permissions must be granted at runtime.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DailyAction } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Permissions ─────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── US-020: Action reminders ─────────────────────────────────────────────────

/** Notification identifier for an action reminder. */
function actionReminderId(actionId: string): string {
  return `action-reminder-${actionId}`;
}

/**
 * Parse "HH:MM" string into { hour, minute }.
 * Returns null when the format is invalid.
 */
export function parseReminderTime(raw: string): { hour: number; minute: number } | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Format { hour, minute } back to "HH:MM".
 */
export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Schedule (or reschedule) a daily local notification for an action.
 * Cancels any existing notification for that action first.
 * No-ops when reminder_time is null/empty or permissions are missing.
 */
export async function scheduleActionReminder(action: DailyAction, goalName: string): Promise<void> {
  await cancelActionReminder(action.id);
  if (!action.reminder_time) return;
  const parsed = parseReminderTime(action.reminder_time);
  if (!parsed) return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: actionReminderId(action.id),
    content: {
      title: `Time for ${action.name}`,
      body: goalName ? `Part of your ${goalName} goal` : 'Stay intentional.',
      data: { actionId: action.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });
}

/** Cancel the daily reminder for a specific action. */
export async function cancelActionReminder(actionId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(actionReminderId(actionId));
  } catch {
    // notification may not exist yet
  }
}

// ─── US-036: Weekly review reminder ──────────────────────────────────────────

const WEEKLY_REVIEW_NOTIF_ID = 'weekly-review-sunday';

/**
 * Schedule a recurring Sunday evening notification prompting a weekly review.
 * Defaults to Sunday at 20:00 (local time).
 */
export async function scheduleWeeklyReviewReminder(hour = 20, minute = 0): Promise<void> {
  await cancelWeeklyReviewReminder();
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_REVIEW_NOTIF_ID,
    content: {
      title: 'Weekly Review',
      body: 'Take 5 minutes to reflect on your week. Were you intentional?',
      data: { screen: 'weekly-review' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // Sunday (Expo: 1 = Sunday)
      hour,
      minute,
    },
  });
}

export async function cancelWeeklyReviewReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(WEEKLY_REVIEW_NOTIF_ID);
  } catch {
    // not scheduled yet
  }
}

/** Read back whether the weekly review reminder is currently scheduled. */
export async function isWeeklyReviewReminderScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => n.identifier === WEEKLY_REVIEW_NOTIF_ID);
}
