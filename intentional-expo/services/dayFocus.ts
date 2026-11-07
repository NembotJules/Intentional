/**
 * US-109 · Progress's day strip: the 7 days of this calendar week (Monday first) and, for the day picked,
 * the focus minutes and how they split across pillars. Pure, so it's unit-tested.
 */
export interface DaySession {
  goal_id: string;
  started_at: string;
  duration_seconds: number;
}

export interface WeekDay {
  /** local midnight */
  date: Date;
  /** "Mon" … "Sun" */
  short: string;
  isToday: boolean;
  isFuture: boolean;
}

const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function weekDays(now: Date): WeekDay[] {
  const today = midnight(now);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return SHORT.map((short, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return { date, short, isToday: sameDay(date, today), isFuture: date.getTime() > today.getTime() };
  });
}

/** Minutes given on `day`, in total and per pillar (biggest first; pillars with nothing are left out). */
export function dayBreakdown(sessions: DaySession[], day: Date): { minutes: number; parts: { goalId: string; minutes: number }[] } {
  const by: Record<string, number> = {};
  for (const s of sessions) {
    if (!sameDay(new Date(s.started_at), day)) continue;
    by[s.goal_id] = (by[s.goal_id] ?? 0) + s.duration_seconds / 60;
  }
  const parts = Object.entries(by)
    .map(([goalId, m]) => ({ goalId, minutes: Math.round(m) }))
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  return { minutes: parts.reduce((t, p) => t + p.minutes, 0), parts };
}
