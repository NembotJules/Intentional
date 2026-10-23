/**
 * Web stub for services/notifications.ts
 *
 * expo-notifications does not support web. All functions are safe no-ops so
 * the rest of the app can import from '@/services/notifications' on any platform.
 * Metro resolves this file instead of notifications.ts when bundling for web.
 */
import type { DailyAction } from '@/types';
import type { NotificationIntent } from '@/services/habitSchedule';

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export function parseReminderTime(value: string): { hour: number; minute: number } | null {
  const parts = value.trim().split(':');
  if (parts.length !== 2) return null;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export async function scheduleActionReminder(
  _action: DailyAction,
  _goalName: string,
): Promise<void> {}

export async function cancelActionReminder(_actionId: string): Promise<void> {}

export async function syncActionReminder(_action: DailyAction, _goalName: string): Promise<void> {}

export async function cancelAllScheduledNotifications(): Promise<void> {}

export async function scheduleWeeklyReviewReminder(): Promise<void> {}

export async function cancelWeeklyReviewReminder(): Promise<void> {}

export async function isWeeklyReviewReminderScheduled(): Promise<boolean> {
  return false;
}

export function weekdaysForMask(daysMask: number): number[] {
  const mask = daysMask & 127;
  if (mask === 127 || mask === 0) return [];
  const out: number[] = [];
  for (let bit = 0; bit < 7; bit++) if (mask & (1 << bit)) out.push(bit === 6 ? 1 : bit + 2);
  return out.sort((a, b) => a - b);
}

export const HEADS_UP_SETTING = 'habit_headsup';
export const AUTOBLOCK_SETTING = 'strict_autoblock_active';
export const LAST_RESPONSE_SETTING = 'last_notification_response';

export async function syncHabitAlerts(): Promise<void> {}

export async function registerHabitCategory(): Promise<void> {}

export async function snoozeHabitAlert(_actionId: string, _content?: { title?: string | null; body?: string | null }): Promise<boolean> {
  return false;
}

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
  canNavigate?: () => boolean;
}

export async function handleNotificationIntent(
  _intent: NotificationIntent,
  _deps: NotificationIntentDeps,
  _content?: { title?: string | null; body?: string | null }
): Promise<void> {}

export function notificationResponseKey(r: NotificationResponseLike): string {
  return `${r.notification.request.identifier}|${r.actionIdentifier}`;
}

export async function processNotificationResponse(
  _r: NotificationResponseLike,
  _deps: NotificationIntentDeps & { seen: () => string | null; markSeen: (key: string) => void; now?: Date }
): Promise<boolean> {
  return false;
}

export function addNotificationResponseListener(_cb: (r: NotificationResponseLike) => void): () => void {
  return () => {};
}

export async function getLastNotificationResponse(): Promise<NotificationResponseLike | null> {
  return null;
}
