/**
 * US-111 · The day streak on Today's flame: consecutive days you gave your pillars any time (a focus session or a
 * habit done). Today doesn't break it until it's over. `weekDays` is this week (Mon → Sun) for the streak moment.
 */
import { shiftDayKey } from '@/utils/dates';

export function currentDayStreak(days: Set<string>, today: string): number {
  let ymd = days.has(today) ? today : shiftDayKey(today, -1);
  let n = 0;
  while (days.has(ymd)) {
    n++;
    ymd = shiftDayKey(ymd, -1);
  }
  return n;
}

export type WeekDay = { key: string; letter: string; done: boolean; isToday: boolean; future: boolean };

/** Monday → Sunday of the week holding `today` (YYYY-MM-DD), each marked done / today / still to come. */
export function weekDays(days: Set<string>, today: string): WeekDay[] {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const monday = shiftDayKey(today, -dow);
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, i) => {
    const key = shiftDayKey(monday, i);
    return { key, letter, done: days.has(key), isToday: key === today, future: key > today };
  });
}

/** The short line under the number in the streak moment. */
export function streakLine(n: number): string {
  if (n === 0) return 'Give a pillar a few minutes today to light it.';
  if (n === 1) return 'Day one. Come back tomorrow to keep it lit.';
  if (n < 7) return 'Keep it going. Every day counts.';
  if (n < 30) return 'A real rhythm. Flick is glowing.';
  return 'This is who you are now.';
}
