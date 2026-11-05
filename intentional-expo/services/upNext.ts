/**
 * US-098 / US-099 · "Up next": the ONE thing Today puts forward, and what the Focus sheet starts by default.
 *
 * Order: a habit due now or coming up (by start time) → a habit with no time → a habit whose time passed
 * ("missed", still doable today) → the active goals' next step → nothing.
 * Pure: Today and the Focus sheet hand it what's open today.
 */

export const NOW_WINDOW_MIN = 30;

export interface OpenHabit {
  id: string;
  name: string;
  pillarId: string;
  /** "07:00" or null (anytime). */
  time: string | null;
  /** 'session' (timed work) or 'habit' (a tick). */
  type: 'session' | 'habit';
  minutes: number;
}

export interface NextStep {
  taskId: string;
  title: string;
  pillarId: string;
  goalTitle: string;
  minutes: number;
}

export type UpNext =
  | { kind: 'habit'; habit: OpenHabit; when: 'now' | 'soon' | 'anytime' | 'missed'; inMinutes: number | null }
  | { kind: 'step'; step: NextStep }
  | null;

const toMin = (hhmm: string | null) => {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function pickUpNext(habits: OpenHabit[], steps: NextStep[], nowMinutes: number): UpNext {
  const timed = habits
    .map((h) => ({ h, at: toMin(h.time) }))
    .filter((x): x is { h: OpenHabit; at: number } => x.at !== null)
    .sort((a, b) => a.at - b.at);
  const current = timed.find((x) => x.at >= nowMinutes - NOW_WINDOW_MIN);
  if (current) {
    const diff = current.at - nowMinutes;
    return { kind: 'habit', habit: current.h, when: diff <= 0 ? 'now' : 'soon', inMinutes: diff > 0 ? diff : null };
  }
  const anytime = habits.find((h) => toMin(h.time) === null);
  if (anytime) return { kind: 'habit', habit: anytime, when: 'anytime', inMinutes: null };
  const missed = timed[timed.length - 1];
  if (missed) return { kind: 'habit', habit: missed.h, when: 'missed', inMinutes: null };
  const step = steps[0];
  return step ? { kind: 'step', step } : null;
}

/** "in 25 min", "now", "anytime today", "missed 7:00, still today". */
export function upNextWhen(u: Exclude<UpNext, null>): string {
  if (u.kind === 'step') return `Next step · ${u.step.goalTitle}`;
  const t = u.habit.time ? u.habit.time.replace(/^0/, '') : null;
  switch (u.when) {
    case 'now':
      return t ? `Now · ${t}` : 'Now';
    case 'soon':
      return u.inMinutes !== null && u.inMinutes <= 120 ? `In ${u.inMinutes} min · ${t}` : `At ${t}`;
    case 'missed':
      return `Missed ${t} · still today`;
    default:
      return 'Anytime today';
  }
}

/** The time chips the Focus sheet offers, always including the suggested length. */
export const FOCUS_PRESETS = [15, 25, 45, 60, 90] as const;
export function durationChoices(suggested: number): number[] {
  const s = Math.max(5, Math.min(240, Math.round(suggested) || 25));
  return [...new Set([...FOCUS_PRESETS, s])].sort((a, b) => a - b);
}
