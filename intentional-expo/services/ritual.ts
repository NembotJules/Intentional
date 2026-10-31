/**
 * The Sunday ritual (US-082): a short story of the week, then plan the next one and send it to your partner.
 *
 * Which week: on Sunday and Monday it's the week that just ended (same as the partner report);
 * any other day it's this week so far. Today shows "Your week is ready" on Sunday (from noon)
 * and Monday until the ritual is done. The reminder is a weekly notification, Sunday 18:00 by default.
 */
import { getSetting, setSetting } from '@/db';
import { reportWeek } from '@/services/partner';
import { weekStartOf } from '@/services/weekSummary';
import { localDayKey } from '@/utils/dates';

export const RITUAL_REMINDER_SETTING = 'ritual_reminder'; // '0' = off; anything else (default) = on
export const RITUAL_TIME_SETTING = 'ritual_time'; // "HH:MM", default 18:00
export const RITUAL_TIMES = ['17:00', '18:00', '19:00', '20:00', '21:00'] as const;
export const DEFAULT_RITUAL_TIME = '18:00';

export function ritualWeek(now: Date = new Date()): string {
  const r = reportWeek(now);
  return r.due ? r.weekStart : weekStartOf(localDayKey(now));
}

/** True on Sunday from noon and on Monday, while that week's ritual isn't done. */
export function isRitualDue(now: Date = new Date(), done: (weekStart: string) => boolean = isRitualDone): boolean {
  const dow = now.getDay();
  if (!(dow === 1 || (dow === 0 && now.getHours() >= 12))) return false;
  return !done(reportWeek(now).weekStart);
}

export function isRitualDone(weekStart: string): boolean {
  return getSetting(`ritual_done_${weekStart}`) === '1';
}

export function markRitualDone(weekStart: string): void {
  setSetting(`ritual_done_${weekStart}`, '1');
}

export function isRitualReminderOn(): boolean {
  return getSetting(RITUAL_REMINDER_SETTING) !== '0';
}

export function ritualTime(): { hour: number; minute: number; label: string } {
  const raw = getSetting(RITUAL_TIME_SETTING) ?? DEFAULT_RITUAL_TIME;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  const hour = m ? Math.min(23, Number(m[1])) : 18;
  const minute = m ? Math.min(59, Number(m[2])) : 0;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { hour, minute, label: `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}` };
}

/** The reminder's words: it names the partner when there is one. */
export function ritualReminderContent(partnerName?: string | null): { title: string; body: string } {
  return {
    title: 'Your week is ready 🔥',
    body: partnerName
      ? `See where your hours went, plan next week, and send it to ${partnerName}. 3 minutes.`
      : 'See where your hours went and plan next week. 3 minutes.',
  };
}
