/**
 * Year in Hours (US-086): the year's story, from the rows.
 *
 * Pure. A session belongs to the year of its local calendar day (a run that starts at 23:30 on Dec 31 counts for that year).
 * The full story is offered Dec 1 → Jan 15 (in January it's last year's); any other day Insights offers "Your year so far".
 */
import { STAGES, stageFor, type StageName } from '@/services/lifeLedger';
import { dayKeyDiff, localDayKeyFromIso } from '@/utils/dates';

export const YEAR_SEEN_KEY = (year: number) => `year_story_seen:${year}`;

/** Which year the story is about today, and whether it's the year-end window (Dec 1 → Jan 15) or "so far". */
export function storyYear(now: Date): { year: number; final: boolean } {
  const m = now.getMonth();
  const d = now.getDate();
  if (m === 11) return { year: now.getFullYear(), final: true };
  if (m === 0 && d <= 15) return { year: now.getFullYear() - 1, final: true };
  return { year: now.getFullYear(), final: false };
}

export interface YearInput {
  year: number;
  now: Date;
  sessions: { goal_id: string; started_at: string; duration_seconds: number }[];
  pillars: { id: string; name: string; color: string; icon: string }[];
  objectives: { id: string; title: string; pillar_id: string; status: string; closed_at: string | null }[];
  /** Minutes per goal over the year (objective_id rollup), optional. */
  goalMinutes?: Record<string, number>;
}

export interface YearSummary {
  year: number;
  totalMinutes: number;
  sessionCount: number;
  activeDays: number;
  pillars: { id: string; name: string; color: string; icon: string; minutes: number; share: number }[];
  months: { index: number; label: string; long: string; minutes: number }[];
  bestMonth: { index: number; long: string; minutes: number } | null;
  bestDay: { dayKey: string; minutes: number } | null;
  longestStreak: { days: number; from: string; to: string } | null;
  goalsAchieved: { id: string; title: string; pillarId: string; closedAt: string; minutes: number }[];
  stageStart: { name: StageName; index: number };
  stageEnd: { name: StageName; index: number };
  /** Stages reached during the year, in order. */
  stagesReached: StageName[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1));

export function buildYear(input: YearInput): YearSummary {
  const { year } = input;
  const prefix = `${year}-`;
  let before = 0;
  let total = 0;
  let count = 0;
  const byDay = new Map<string, number>();
  const byPillar = new Map<string, number>();
  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const s of input.sessions) {
    const mins = s.duration_seconds / 60;
    if (mins <= 0) continue;
    const day = localDayKeyFromIso(s.started_at);
    if (day < prefix) {
      before += mins;
      continue;
    }
    if (!day.startsWith(prefix)) continue;
    total += mins;
    count += 1;
    byDay.set(day, (byDay.get(day) ?? 0) + mins);
    byPillar.set(s.goal_id, (byPillar.get(s.goal_id) ?? 0) + mins);
    byMonth[Number(day.slice(5, 7)) - 1]! += mins;
  }

  const pillars = input.pillars
    .map((p) => ({ ...p, minutes: Math.round(byPillar.get(p.id) ?? 0), share: total > 0 ? (byPillar.get(p.id) ?? 0) / total : 0 }))
    .filter((p) => p.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const months = MONTHS.map((d, i) => ({
    index: i,
    label: d.toLocaleDateString('en-US', { month: 'narrow' }),
    long: d.toLocaleDateString('en-US', { month: 'long' }),
    minutes: Math.round(byMonth[i]!),
  }));
  const best = months.reduce<(typeof months)[number] | null>((b, m) => (m.minutes > 0 && (!b || m.minutes > b.minutes) ? m : b), null);

  const days = [...byDay.keys()].sort();
  let streak: YearSummary['longestStreak'] = null;
  let runFrom = days[0];
  for (let i = 0; i < days.length; i++) {
    if (i > 0 && dayKeyDiff(days[i - 1]!, days[i]!) !== 1) runFrom = days[i];
    const len = dayKeyDiff(runFrom!, days[i]!) + 1;
    if (!streak || len > streak.days) streak = { days: len, from: runFrom!, to: days[i]! };
  }
  let bestDay: YearSummary['bestDay'] = null;
  for (const [dayKey, m] of byDay) if (!bestDay || m > bestDay.minutes || (m === bestDay.minutes && dayKey < bestDay.dayKey)) bestDay = { dayKey, minutes: Math.round(m) };

  const goalsAchieved = input.objectives
    .filter((o) => o.status === 'completed' && o.closed_at && localDayKeyFromIso(o.closed_at).startsWith(prefix))
    .map((o) => ({ id: o.id, title: o.title, pillarId: o.pillar_id, closedAt: o.closed_at!, minutes: Math.round(input.goalMinutes?.[o.id] ?? 0) }))
    .sort((a, b) => (a.closedAt < b.closedAt ? -1 : 1));

  const start = stageFor(before / 60);
  const end = stageFor((before + total) / 60);
  return {
    year,
    totalMinutes: Math.round(total),
    sessionCount: count,
    activeDays: byDay.size,
    pillars,
    months,
    bestMonth: best ? { index: best.index, long: best.long, minutes: best.minutes } : null,
    bestDay,
    longestStreak: streak,
    goalsAchieved,
    stageStart: { name: start.name, index: start.index },
    stageEnd: { name: end.name, index: end.index },
    stagesReached: STAGES.slice(start.index + 1, end.index + 1).map((s) => s.name),
  };
}

/** "Flick grew from a Spark to a Torch." / "Flick stayed a Flame, and burned brighter." */
export function stagePathLine(y: YearSummary): string {
  if (y.stageEnd.index > y.stageStart.index) return `Flick grew from a ${y.stageStart.name} to a ${y.stageEnd.name}.`;
  return `Flick stayed a ${y.stageEnd.name}, and every hour fed it.`;
}

export function yearShareText(y: YearSummary, opts: { final: boolean }): string {
  const h = Math.round(y.totalMinutes / 60);
  const lines = [
    opts.final ? `My ${y.year} in hours on Intentional:` : `My ${y.year} so far on Intentional:`,
    `⏱ ${h.toLocaleString('en-US')}h given to the life I chose`,
  ];
  if (y.pillars[0]) lines.push(`🥇 Most of it to ${y.pillars[0].name} (${Math.round(y.pillars[0].share * 100)}%)`);
  if (y.longestStreak && y.longestStreak.days > 1) lines.push(`🔥 ${y.longestStreak.days} days in a row`);
  if (y.goalsAchieved.length) lines.push(`🏆 ${y.goalsAchieved.length} ${y.goalsAchieved.length === 1 ? 'goal' : 'goals'} achieved`);
  return lines.join('\n');
}

/** 45 → "45m", 750 → "12.5h", 18720 → "312h" (the year's big numbers). */
export function yearHours(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = m / 60;
  return h >= 100 ? `${Math.round(h).toLocaleString('en-US')}h` : `${Math.round(h * 10) / 10}h`;
}

/** "Mar 3 – Mar 24" */
export function rangeLabel(from: string, to: string): string {
  const f = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}
