/**
 * The week, in one object (US-078 / US-082 / US-085 / partner).
 *
 * Pure: give it the rows, get back what the weekly card, the Sunday ritual, the partner message and
 * Insights' "Habits this week" show. A week is Monday → Sunday in local time.
 * db/api.ts → getWeekSummary() gathers the rows from the database.
 */
import type { Pace } from '@/services/goalProgress';
import { isScheduledOn, localDayKey, localDayKeyFromIso, localDayStart, shiftDayKey } from '@/utils/dates';

export type HabitDay = 'done' | 'rest' | 'missed' | 'today' | 'upcoming' | 'off';

export interface WeekPillarIn {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface WeekSessionIn {
  goal_id: string;
  action_id: string | null;
  task_id?: string | null;
  objective_id?: string | null;
  started_at: string;
  duration_seconds: number;
}

export interface WeekHabitIn {
  id: string;
  goal_id: string;
  name: string;
  target_minutes: number;
  days_mask: number | null;
  is_active: number;
}

export interface WeekGoalIn {
  id: string;
  title: string;
  pillar_id: string;
  progress: number | null;
  pace: Pace;
}

export interface WeekInput {
  /** Monday of the week (YYYY-MM-DD). */
  weekStart: string;
  now: Date;
  pillars: WeekPillarIn[];
  /** Sessions of this week and of the week before (others are ignored). */
  sessions: WeekSessionIn[];
  habits: WeekHabitIn[];
  /** "Skip today" rows (habit_skips). */
  skips: { action_id: string; date: string }[];
  /** Old check-off habits (habit_completions with completed = 1). */
  completions?: { action_id: string; date: string }[];
  goals: WeekGoalIn[];
}

export interface WeekPillar extends WeekPillarIn {
  minutes: number;
  prevMinutes: number;
}

export interface WeekHabit {
  id: string;
  name: string;
  pillarId: string;
  /** Minutes this habit got this week. */
  givenMinutes: number;
  /** Minutes it was scheduled for (scheduled days that weren't rest days × its length). */
  plannedMinutes: number;
  /** Monday → Sunday. */
  days: HabitDay[];
  kept: number;
  /** Scheduled days so far that count (not rest days, not still ahead). */
  due: number;
}

export interface WeekGoal extends WeekGoalIn {
  minutes: number;
}

export interface WeekSummary {
  weekStart: string;
  weekEnd: string;
  /** "Oct 20 – 26" / "Oct 27 – Nov 2". */
  label: string;
  /** True once Sunday is over (or it is Sunday evening: the ritual reads the week as done). */
  isPast: boolean;
  totalMinutes: number;
  prevTotalMinutes: number;
  pillars: WeekPillar[];
  /** Minutes per day, Monday → Sunday. */
  days: { dayKey: string; minutes: number }[];
  /** Days with at least one session (0–7). */
  daysShowedUp: number;
  bestDay: { dayKey: string; minutes: number } | null;
  habits: WeekHabit[];
  habitsKept: number;
  habitsDue: number;
  restDays: number;
  goals: WeekGoal[];
}

/** Monday of the week that contains `day`. */
export function weekStartOf(day: string = localDayKey()): string {
  const dow = localDayStart(day).getDay();
  return shiftDayKey(day, dow === 0 ? -6 : 1 - dow);
}

export function weekLabel(weekStart: string): string {
  const a = localDayStart(weekStart);
  const b = localDayStart(shiftDayKey(weekStart, 6));
  const month = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  if (a.getMonth() === b.getMonth()) return `${month(a)} ${a.getDate()} – ${b.getDate()}`;
  return `${month(a)} ${a.getDate()} – ${month(b)} ${b.getDate()}`;
}

/** 0 → "0m", 45 → "45m", 125 → "2h 5m", 120 → "2h". */
export function formatMinutes(total: number): string {
  const mins = Math.max(0, Math.round(total));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function buildWeekSummary(input: WeekInput): WeekSummary {
  const { weekStart, now } = input;
  const weekEnd = shiftDayKey(weekStart, 6);
  const prevStart = shiftDayKey(weekStart, -7);
  const today = localDayKey(now);
  const dayKeys = Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i));

  const minutesByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const byPillar = new Map<string, number>();
  const prevByPillar = new Map<string, number>();
  const habitMinutesByDay = new Map<string, number>(); // `${habit}|${day}`
  const byGoal = new Map<string, number>();
  let total = 0;
  let prevTotal = 0;

  for (const s of input.sessions) {
    const day = localDayKeyFromIso(s.started_at);
    const mins = s.duration_seconds / 60;
    if (day >= weekStart && day <= weekEnd) {
      total += mins;
      minutesByDay.set(day, (minutesByDay.get(day) ?? 0) + mins);
      byPillar.set(s.goal_id, (byPillar.get(s.goal_id) ?? 0) + mins);
      if (s.action_id) habitMinutesByDay.set(`${s.action_id}|${day}`, (habitMinutesByDay.get(`${s.action_id}|${day}`) ?? 0) + mins);
      if (s.objective_id) byGoal.set(s.objective_id, (byGoal.get(s.objective_id) ?? 0) + mins);
    } else if (day >= prevStart && day < weekStart) {
      prevTotal += mins;
      prevByPillar.set(s.goal_id, (prevByPillar.get(s.goal_id) ?? 0) + mins);
    }
  }

  const skipped = new Set(input.skips.map((s) => `${s.action_id}|${s.date}`));
  const completed = new Set((input.completions ?? []).map((c) => `${c.action_id}|${c.date}`));

  const habits: WeekHabit[] = input.habits
    .filter((h) => h.is_active)
    .map((h) => {
      const mask = (h.days_mask ?? 127) & 127;
      const target = Math.max(1, h.target_minutes || 0);
      let given = 0;
      let planned = 0;
      let kept = 0;
      let due = 0;
      const days: HabitDay[] = dayKeys.map((day) => {
        const mins = habitMinutesByDay.get(`${h.id}|${day}`) ?? 0;
        given += mins;
        if (!isScheduledOn(mask, day)) return 'off';
        const done = mins >= target || completed.has(`${h.id}|${day}`);
        if (skipped.has(`${h.id}|${day}`) && !done) return 'rest';
        planned += h.target_minutes || 0;
        if (done) {
          kept += 1;
          due += 1;
          return 'done';
        }
        if (day < today) {
          due += 1;
          return 'missed';
        }
        return day === today ? 'today' : 'upcoming';
      });
      return { id: h.id, name: h.name, pillarId: h.goal_id, givenMinutes: Math.round(given), plannedMinutes: planned, days, kept, due };
    });

  const days = dayKeys.map((dayKey) => ({ dayKey, minutes: Math.round(minutesByDay.get(dayKey) ?? 0) }));
  const best = days.reduce<{ dayKey: string; minutes: number } | null>((b, d) => (d.minutes > 0 && (!b || d.minutes > b.minutes) ? d : b), null);

  return {
    weekStart,
    weekEnd,
    label: weekLabel(weekStart),
    isPast: today > weekEnd || (today === weekEnd && now.getHours() >= 17),
    totalMinutes: Math.round(total),
    prevTotalMinutes: Math.round(prevTotal),
    pillars: input.pillars.map((p) => ({ ...p, minutes: Math.round(byPillar.get(p.id) ?? 0), prevMinutes: Math.round(prevByPillar.get(p.id) ?? 0) })),
    days,
    daysShowedUp: days.filter((d) => d.minutes > 0).length,
    bestDay: best,
    habits,
    habitsKept: habits.reduce((a, h) => a + h.kept, 0),
    habitsDue: habits.reduce((a, h) => a + h.due, 0),
    restDays: habits.reduce((a, h) => a + h.days.filter((d) => d === 'rest').length, 0),
    goals: input.goals.map((g) => ({ ...g, minutes: Math.round(byGoal.get(g.id) ?? 0) })),
  };
}

const PACE_WORD: Record<Pace, string | null> = { ahead: 'ahead', on_track: 'on track', behind: 'a bit behind', unknown: null };

/** One honest sentence about the week, for the card and the ritual. Never guilt. */
export function headlineFor(s: WeekSummary): string {
  if (s.totalMinutes <= 0) return 'A quiet week. The next one starts with one hour.';
  const top = [...s.pillars].sort((a, b) => b.minutes - a.minutes)[0];
  const diff = s.totalMinutes - s.prevTotalMinutes;
  if (s.prevTotalMinutes > 0 && diff >= 30) return `${formatMinutes(diff)} more than last week. ${top ? `${top.name} led the way.` : ''}`.trim();
  if (s.daysShowedUp >= 6) return `You showed up ${s.daysShowedUp} days out of 7.`;
  if (top && top.minutes > 0) return `${top.name} got the most of you this week.`;
  return 'Every hour here went to something you chose.';
}

/** The plain-text week, for the partner message and as the caption under the shared card. */
export function weekText(s: WeekSummary, opts: { userName?: string; partnerName?: string } = {}): string {
  const lines: string[] = [];
  const hi = opts.partnerName ? `${opts.partnerName}, here's my week` : 'My week';
  lines.push(`${hi} (${s.label}) on Intentional:`);
  lines.push('');
  lines.push(`⏱ ${formatMinutes(s.totalMinutes)} given to the life I chose${s.prevTotalMinutes > 0 ? ` (last week: ${formatMinutes(s.prevTotalMinutes)})` : ''}`);
  const given = s.pillars.filter((p) => p.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (given.length) lines.push(given.map((p) => `${p.name} ${formatMinutes(p.minutes)}`).join(' · '));
  const quiet = s.pillars.filter((p) => p.minutes <= 0).map((p) => p.name);
  if (quiet.length && given.length) lines.push(`No time yet: ${quiet.join(', ')}`);
  if (s.habitsDue > 0) lines.push(`✅ Habits kept: ${s.habitsKept} of ${s.habitsDue}${s.restDays ? ` (${s.restDays} rest ${s.restDays === 1 ? 'day' : 'days'})` : ''}`);
  lines.push(`📅 Showed up ${s.daysShowedUp} of 7 days`);
  for (const g of s.goals) {
    const pct = g.progress !== null ? `${Math.round(g.progress * 100)}%` : null;
    const pace = PACE_WORD[g.pace];
    const bits = [pct, pace, g.minutes > 0 ? `${formatMinutes(g.minutes)} this week` : null].filter(Boolean);
    lines.push(`🎯 ${g.title}${bits.length ? `: ${bits.join(', ')}` : ''}`);
  }
  if (opts.partnerName) {
    lines.push('');
    lines.push(s.totalMinutes > 0 ? 'Keep me honest next week too.' : 'Quiet week. Ask me about it.');
  }
  if (opts.userName) lines.push(`— ${opts.userName}`);
  return lines.join('\n');
}
