/**
 * Notification service — US-075/076 (habit start alerts + their buttons) and US-036 (weekly review).
 * Uses expo-notifications. iOS permissions must be granted at runtime.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DailyAction } from '@/types';
import * as api from '@/db/api';
import * as AppBlocking from '@/services/appBlocking';
import {
  ACTION_SKIP,
  ACTION_SNOOZE,
  ACTION_START,
  HABIT_CATEGORY,
  SNOOZE_MIN,
  buildHabitAlerts,
  intentFromResponse,
  startAlertContent,
  type HabitForSchedule,
  type NotificationIntent,
} from '@/services/habitSchedule';
import { localDayKey } from '@/utils/dates';

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

/**
 * Old per-habit entry points (US-020). Habit alerts are now one rolling 7-day schedule for every
 * habit (US-075), so these only resync everything; the arguments are kept so old callers stay correct.
 * habitSync imports this module, so it is loaded lazily here to avoid an import cycle.
 */
async function resyncHabits(): Promise<void> {
  try {
    const { syncHabits } = await import('@/services/habitSync');
    await syncHabits();
  } catch {
    // never let a reminder refresh break the caller
  }
}

export async function scheduleActionReminder(_action: DailyAction, _goalName: string): Promise<void> {
  await resyncHabits();
}

export async function cancelActionReminder(_actionId: string): Promise<void> {
  await resyncHabits();
}

export async function syncActionReminder(_action: DailyAction, _goalName: string): Promise<void> {
  await resyncHabits();
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

// ─── US-075: Habit start alerts ──────────────────────────────────────────────

/** Settings keys (values '1' / '0'). */
export const HEADS_UP_SETTING = 'habit_headsup';
export const AUTOBLOCK_SETTING = 'strict_autoblock_active';
export const LAST_RESPONSE_SETTING = 'last_notification_response';

const HABIT_PREFIX = 'habit-';
const LEGACY_PREFIX = 'action-reminder-';
/** Snoozed alerts survive a resync (the app comes to the foreground) unless the habit is done, skipped or gone. */
const SNOOZE_PREFIX = 'snooze-';

function snoozeId(actionId: string, dayKey: string, n: number): string {
  return `${SNOOZE_PREFIX}${actionId}-${dayKey}-${n}`;
}

/** Checks the permission without ever prompting (prompting belongs to a screen the person is looking at). */
async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.status === 'granted' || (p as { granted?: boolean }).granted === true;
  } catch {
    return false;
  }
}

function toSchedulable(h: api.ActionWithGoal): HabitForSchedule {
  return {
    id: h.id,
    name: h.name,
    pillarName: h.goal_name,
    target_minutes: h.target_minutes,
    reminder_time: h.reminder_time,
    days_mask: h.days_mask,
    is_active: h.is_active,
    strict: h.strict,
  };
}

function blockingAvailable(): boolean {
  try {
    return AppBlocking.isAvailable() && AppBlocking.hasSelection();
  } catch {
    return false;
  }
}

/**
 * Reschedules every habit's start alert (and optional heads-up) for the next 7 days as one-off notifications.
 * Cancels the previous habit alerts and the old repeating US-020 reminders first. Never prompts, never throws.
 * Call through services/habitSync.syncHabits() so app blocking stays in step too.
 */
export async function syncHabitAlerts(): Promise<void> {
  try {
    if (!(await hasNotificationPermission())) return;
    const habits = api.getAllActionsWithGoal();
    const doneToday = api.getHabitsDoneToday();
    const skippedToday = api.getSkippedHabits();
    const activeIds = new Set(habits.filter((h) => h.is_active && h.reminder_time).map((h) => h.id));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      const id = n.identifier;
      let cancel = id.startsWith(HABIT_PREFIX) || id.startsWith(LEGACY_PREFIX);
      if (!cancel && id.startsWith(SNOOZE_PREFIX)) {
        const actionId = (n.content?.data as { actionId?: unknown } | undefined)?.actionId;
        cancel = typeof actionId !== 'string' || !activeIds.has(actionId) || doneToday.has(actionId) || skippedToday.has(actionId);
      }
      if (!cancel) continue;
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // already gone
      }
    }

    const alerts = buildHabitAlerts(habits.map(toSchedulable), {
      now: new Date(),
      days: 7,
      doneToday,
      skippedToday,
      headsUp: api.getSetting(HEADS_UP_SETTING) === '1',
      blockingAvailable: blockingAvailable(),
      autoBlock: api.getSetting(AUTOBLOCK_SETTING) === '1',
    });
    for (const alert of alerts) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: alert.id,
          content: {
            title: alert.title,
            body: alert.body,
            data: alert.data,
            ...(alert.kind === 'start' ? { categoryIdentifier: HABIT_CATEGORY } : {}),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alert.fireAt },
        });
      } catch {
        // one bad alert must not stop the rest
      }
    }
  } catch {
    // never throw from a background sync
  }
}

/** The three buttons under a habit start alert (long-press / pull down on iOS). Call once at app start. */
export async function registerHabitCategory(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.setNotificationCategoryAsync(HABIT_CATEGORY, [
      { identifier: ACTION_START, buttonTitle: 'Start now', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: 'In 10 min', options: { opensAppToForeground: false } },
      { identifier: ACTION_SKIP, buttonTitle: 'Skip today', options: { opensAppToForeground: false, isDestructive: false } },
    ]);
  } catch {
    // categories are a nicety; the alert still works without buttons
  }
}

/**
 * "In 10 min": a one-off copy of the start alert SNOOZE_MIN minutes from now (at most MAX_SNOOZES_PER_DAY a day).
 * Its scheduledAt is the new time, so tapping it auto-starts the session. Returns whether it was scheduled.
 * `content` is the original alert's title/body; when missing it is rebuilt from the habit.
 */
export async function snoozeHabitAlert(actionId: string, content?: { title?: string | null; body?: string | null }): Promise<boolean> {
  try {
    const day = localDayKey();
    if (api.getSnoozeCount(actionId, day) >= api.MAX_SNOOZES_PER_DAY) return false;
    let title = content?.title ?? null;
    let body = content?.body ?? null;
    if (!title || !body) {
      const h = api.getAllActionsWithGoal().find((a) => a.id === actionId);
      if (!h) return false;
      const c = startAlertContent(toSchedulable(h), { blockingAvailable: blockingAvailable(), autoBlock: api.getSetting(AUTOBLOCK_SETTING) === '1' });
      title = c.title;
      body = c.body;
    }
    const n = api.recordSnooze(actionId, day);
    const fireAt = new Date(Date.now() + SNOOZE_MIN * 60_000);
    await Notifications.scheduleNotificationAsync({
      identifier: snoozeId(actionId, day, n),
      content: {
        title,
        body,
        data: { actionId, kind: 'start', scheduledAt: fireAt.toISOString() },
        categoryIdentifier: HABIT_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── US-076: Notification responses ──────────────────────────────────────────

/** The parts of an expo-notifications response the app uses (kept structural so tests can build one). */
export interface NotificationResponseLike {
  actionIdentifier: string;
  notification: {
    request: {
      identifier: string;
      content: { title?: string | null; body?: string | null; data?: Record<string, unknown> | null };
    };
  };
}

export interface NotificationIntentDeps {
  push: (href: string) => void;
  skipHabit: (actionId: string) => void;
  snooze: (actionId: string, content?: { title?: string | null; body?: string | null }) => Promise<boolean>;
  sync: () => Promise<void>;
  /** False until onboarding is done: buttons still work, but nothing navigates. */
  canNavigate?: () => boolean;
}

/** Carries out what a notification response asked for. */
export async function handleNotificationIntent(
  intent: NotificationIntent,
  deps: NotificationIntentDeps,
  content?: { title?: string | null; body?: string | null }
): Promise<void> {
  const canNavigate = deps.canNavigate ? deps.canNavigate() : true;
  switch (intent.type) {
    case 'start':
      if (!canNavigate) return;
      // ts makes every tap a fresh request for Focus's auto-start guard
      deps.push(`/(tabs)/focus?actionId=${encodeURIComponent(intent.actionId)}${intent.autostart ? '&autostart=1' : ''}&ts=${Date.now()}`);
      return;
    case 'snooze':
      await deps.snooze(intent.actionId, content);
      return;
    case 'skip':
      deps.skipHabit(intent.actionId);
      await deps.sync();
      return;
    case 'open-review':
      if (canNavigate) deps.push('/weekly-review');
      return;
    case 'open-today':
      if (canNavigate) deps.push('/(tabs)/today');
      return;
  }
}

/** Identifies one press on one notification, so the live listener and the cold-start check never both run it. */
export function notificationResponseKey(r: NotificationResponseLike): string {
  return `${r.notification.request.identifier}|${r.actionIdentifier}`;
}

/**
 * Handles a response once: returns false (and does nothing) when this exact response was already handled.
 * `seen` / `markSeen` hold the last handled key (in memory and in settings).
 */
export async function processNotificationResponse(
  r: NotificationResponseLike,
  deps: NotificationIntentDeps & { seen: () => string | null; markSeen: (key: string) => void; now?: Date }
): Promise<boolean> {
  const key = notificationResponseKey(r);
  if (deps.seen() === key) return false;
  deps.markSeen(key);
  const content = r.notification.request.content;
  const intent = intentFromResponse({ actionIdentifier: r.actionIdentifier, data: content.data ?? undefined, now: deps.now ?? new Date() });
  await handleNotificationIntent(intent, deps, { title: content.title, body: content.body });
  return true;
}

/** Live responses (app running or brought to the foreground). Returns the unsubscribe function. */
export function addNotificationResponseListener(cb: (r: NotificationResponseLike) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  try {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(r as unknown as NotificationResponseLike));
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/** The response that launched the app from a cold start (or the last one iOS kept), if any. */
export async function getLastNotificationResponse(): Promise<NotificationResponseLike | null> {
  if (Platform.OS === 'web') return null;
  try {
    const r = await Notifications.getLastNotificationResponseAsync();
    return (r as unknown as NotificationResponseLike) ?? null;
  } catch {
    return null;
  }
}
