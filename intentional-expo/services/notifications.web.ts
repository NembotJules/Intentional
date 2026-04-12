/**
 * Web stub for services/notifications.ts
 *
 * expo-notifications does not support web. All functions are safe no-ops so
 * the rest of the app can import from '@/services/notifications' on any platform.
 * Metro resolves this file instead of notifications.ts when bundling for web.
 */
import type { DailyAction } from '@/types';

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

export async function scheduleWeeklyReviewReminder(): Promise<void> {}

export async function cancelWeeklyReviewReminder(): Promise<void> {}

export async function isWeeklyReviewReminderScheduled(): Promise<boolean> {
  return false;
}
