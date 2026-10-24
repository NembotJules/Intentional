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

export interface LedgerInput {
  now: Date;
  sessions: { goal_id: string; objective_id?: string | null; started_at: string; duration_seconds: number }[];
  pillars: { id: string; name: string; color: string; icon: string; is_archived?: number }[];
  objectives: { id: string; title: string; pillar_id: string; status: string; created_at: string; closed_at: string | null }[];
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
    stage: stageFor(total / 60),
  };
}
