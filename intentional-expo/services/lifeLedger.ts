/**
 * Your Life in Hours (US-083) + Flick's stage (US-079 thresholds).
 *
 * Pure: every session ever saved, the pillars and the goals → the lifetime ledger: total, first day,
 * days with time, hours per pillar, the last 12 months, goals achieved (with their hours), and the
 * stage Flick has grown to. Stages only go up: they're computed from lifetime hours, never from a week.
 */
import { localDayKeyFromIso } from '@/utils/dates';

export const STAGES = [
  { name: 'Spark', hours: 0 },
  { name: 'Flame', hours: 10 },
  { name: 'Torch', hours: 50 },
  { name: 'Bonfire', hours: 150 },
  { name: 'Beacon', hours: 500 },
  { name: 'Sun', hours: 1000 },
] as const;

export type StageName = (typeof STAGES)[number]['name'];

export function stageFor(hours: number): { name: StageName; index: number; next: { name: StageName; hours: number } | null; hoursToNext: number | null; progress: number } {
  const h = Math.max(0, hours);
  let index = 0;
  for (let i = 0; i < STAGES.length; i++) if (h >= STAGES[i]!.hours) index = i;
  const cur = STAGES[index]!;
  const next = STAGES[index + 1] ?? null;
  return {
    name: cur.name,
    index,
    next: next ? { name: next.name, hours: next.hours } : null,
    hoursToNext: next ? Math.max(0, next.hours - h) : null,
    progress: next ? (h - cur.hours) / (next.hours - cur.hours) : 1,
  };
}

/** Hours left to the next stage; null once Flick is a Sun. */
export function hoursToNext(hours: number): number | null {
  return stageFor(hours).hoursToNext;
}

/**
 * The stage to celebrate, if lifetime hours passed one Flick hasn't shown yet.
 * `seenIndex` is the last stage celebrated; null means never checked (an upgrade or fresh install),
 * where we stamp the current stage silently instead of throwing a party for history.
 * Crossing two stages at once celebrates the higher one.
 */
export function stageUp(seenIndex: number | null, hours: number): { celebrate: ReturnType<typeof stageFor> | null; seen: number } {
  const cur = stageFor(hours);
  if (seenIndex === null) return { celebrate: null, seen: cur.index };
  if (cur.index > seenIndex) return { celebrate: cur, seen: cur.index };
  // Stages never go down, even if sessions were deleted.
  return { celebrate: null, seen: seenIndex };
}

/** "37h to Torch" (rounded up, so it never says 0h before the stage is reached), or the top stage's line. */
export function stageToNextLabel(stage: { next: { name: StageName } | null; hoursToNext: number | null }): string {
  if (!stage.next || stage.hoursToNext === null) return 'the brightest stage';
  return `${Math.max(1, Math.ceil(stage.hoursToNext - 1e-9))}h to ${stage.next.name}`;
}

/** "Flick is now a Torch. 50 hours given to the life you chose." */
export function stageLine(stage: { name: StageName; index: number }): string {
  const hours = STAGES[stage.index]!.hours;
  return `Flick is now a ${stage.name}. ${hours.toLocaleString('en-US')} hours given to the life you chose.`;
}

/**
 * Flick's brightness (`intensity`) today: this week's minutes against the person's own 4-week average,
 * pro-rated for how much of the week has passed, so Monday morning isn't a "bad week".
 * At their average → a healthy 0.75; well above → blazing; nothing yet this week → dim, never out.
 * With no history yet, any time this week is a healthy flame.
 * `dayOfWeek` is 1 (Monday) … 7 (Sunday).
 */
export function weekBrightness(thisWeekMinutes: number, prevFourWeeksMinutes: number, dayOfWeek: number): number {
  const avg = prevFourWeeksMinutes / 4;
  if (avg <= 0) return thisWeekMinutes > 0 ? 0.75 : 0.45;
  const expected = avg * (Math.min(7, Math.max(1, dayOfWeek)) / 7);
  const ratio = thisWeekMinutes / expected;
  return Math.min(1, Math.max(0.3, 0.3 + 0.45 * ratio));
}

export interface LedgerInput {
  now: Date;
  sessions: { goal_id: string; objective_id?: string | null; started_at: string; duration_seconds: number }[];
  pillars: { id: string; name: string; color: string; icon: string; is_archived?: number }[];
  objectives: { id: string; title: string; pillar_id: string; status: string; created_at: string; closed_at: string | null }[];
  /** The stage already reached (stages never go down when sessions are deleted). */
  stageOverride?: ReturnType<typeof stageFor>;
}

export interface Ledger {
  totalMinutes: number;
  firstDay: string | null;
  activeDays: number;
  sessionCount: number;
  pillars: { id: string; name: string; color: string; icon: string; minutes: number; share: number }[];
  /** Oldest → newest, 12 entries: "2026-10" + minutes. */
  months: { key: string; label: string; minutes: number }[];
  goalsAchieved: { id: string; title: string; pillarId: string; closedAt: string; minutes: number; days: number }[];
  stage: ReturnType<typeof stageFor>;
}

const MONTH = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function buildLedger(input: LedgerInput): Ledger {
  let total = 0;
  const days = new Set<string>();
  const byPillar = new Map<string, number>();
  const byMonth = new Map<string, number>();
  const byGoal = new Map<string, number>();
  let first: string | null = null;
  for (const s of input.sessions) {
    const mins = s.duration_seconds / 60;
    if (mins <= 0) continue;
    total += mins;
    const day = localDayKeyFromIso(s.started_at);
    days.add(day);
    if (!first || day < first) first = day;
    byPillar.set(s.goal_id, (byPillar.get(s.goal_id) ?? 0) + mins);
    const m = MONTH(new Date(s.started_at));
    byMonth.set(m, (byMonth.get(m) ?? 0) + mins);
    if (s.objective_id) byGoal.set(s.objective_id, (byGoal.get(s.objective_id) ?? 0) + mins);
  }

  const months: Ledger['months'] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(input.now.getFullYear(), input.now.getMonth() - i, 1);
    const key = MONTH(d);
    months.push({ key, label: d.toLocaleDateString('en-US', { month: 'narrow' }), minutes: Math.round(byMonth.get(key) ?? 0) });
  }

  const known = new Set(input.pillars.map((p) => p.id));
  const pillars = input.pillars
    .map((p) => ({ id: p.id, name: p.name, color: p.color, icon: p.icon, minutes: Math.round(byPillar.get(p.id) ?? 0), share: 0 }))
    .filter((p) => p.minutes > 0 || !input.pillars.find((x) => x.id === p.id)?.is_archived);
  // Time from pillars that no longer exist still counts in the total; show it as one row.
  const orphan = [...byPillar.entries()].filter(([id]) => !known.has(id)).reduce((a, [, m]) => a + m, 0);
  if (orphan >= 1) pillars.push({ id: '__gone', name: 'Earlier pillars', color: '#A69685', icon: 'archive', minutes: Math.round(orphan), share: 0 });
  pillars.sort((a, b) => b.minutes - a.minutes);
  for (const p of pillars) p.share = total > 0 ? p.minutes / total : 0;

  const goalsAchieved = input.objectives
    .filter((o) => o.status === 'completed' && o.closed_at)
    .map((o) => {
      const ms = Date.parse(o.closed_at!) - Date.parse(o.created_at);
      return { id: o.id, title: o.title, pillarId: o.pillar_id, closedAt: o.closed_at!, minutes: Math.round(byGoal.get(o.id) ?? 0), days: Math.max(1, Math.round(ms / 864e5)) };
    })
    .sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));

  return {
    totalMinutes: Math.round(total),
    firstDay: first,
    activeDays: days.size,
    sessionCount: input.sessions.filter((s) => s.duration_seconds > 0).length,
    pillars,
    months,
    goalsAchieved,
    stage: input.stageOverride && input.stageOverride.index > stageFor(total / 60).index ? input.stageOverride : stageFor(total / 60),
  };
}
