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
/**
 * Expo weekly-trigger weekdays (1 = Sunday … 7 = Saturday) for a habit's days_mask (bit 0 = Monday … bit 6 = Sunday).
 * Every day → [] (use one DAILY trigger instead). No day → [] too (callers schedule nothing).
 */
export function weekdaysForMask(daysMask: number): number[] {
  const mask = daysMask & 127;
  if (mask === 127 || mask === 0) return [];
  const out: number[] = [];
  for (let bit = 0; bit < 7; bit++) if (mask & (1 << bit)) out.push(bit === 6 ? 1 : bit + 2);
  return out.sort((a, b) => a - b);
}

function weekdayReminderId(actionId: string, weekday: number): string {
  return `${actionReminderId(actionId)}-wd${weekday}`;
}

/**
 * Schedule (or reschedule) a habit's reminder at its start time, on its scheduled weekdays only.
 * Every day → one DAILY trigger; some days → one WEEKLY trigger per day. Cancels the old ones first.
 * No-ops when reminder_time is null/empty, no day is scheduled, or permissions are missing.
 */
export async function scheduleActionReminder(action: DailyAction, goalName: string): Promise<void> {
  await cancelActionReminder(action.id);
  if (!action.reminder_time) return;
  const parsed = parseReminderTime(action.reminder_time);
  if (!parsed) return;
  const mask = (action.days_mask ?? 127) & 127;
  if (mask === 0) return;
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  const content = {
    title: `Time for ${action.name}`,
    body: goalName ? `For your ${goalName} pillar` : 'Stay intentional.',
    data: { actionId: action.id },
  };
  const weekdays = weekdaysForMask(mask);
  if (weekdays.length === 0) {
    await Notifications.scheduleNotificationAsync({
      identifier: actionReminderId(action.id),
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: parsed.hour, minute: parsed.minute },
    });
    return;
  }
  for (const weekday of weekdays) {
    await Notifications.scheduleNotificationAsync({
      identifier: weekdayReminderId(action.id, weekday),
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: parsed.hour, minute: parsed.minute },
    });
  }
}

/** Cancel every reminder for a habit (the daily one and any per-weekday ones). */
export async function cancelActionReminder(actionId: string): Promise<void> {
  const ids = [actionReminderId(actionId), ...[1, 2, 3, 4, 5, 6, 7].map((wd) => weekdayReminderId(actionId, wd))];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // notification may not exist yet
    }
  }
}

/**
 * Make the OS schedule match the action's current state: active with a valid
 * reminder_time → scheduled, otherwise (paused, archived, no time) → cancelled.
 */
export async function syncActionReminder(action: DailyAction, goalName: string): Promise<void> {
  if (action.is_active && action.reminder_time) {
    await scheduleActionReminder(action, goalName);
  } else {
    await cancelActionReminder(action.id);
  }
}

/** Cancel every scheduled notification (used by Delete All Data). */
export async function cancelAllScheduledNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // nothing scheduled
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
