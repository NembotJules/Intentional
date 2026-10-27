/**
 * Milestones on real things (US-080).
 *
 * Pure: the history in, the milestones reached that aren't recorded yet out (each fires once, keyed by kind + ref + value).
 *   - pillar_hours  10 / 50 / 100 / 250 / 500 / 1,000 hours on one pillar (ref = pillar)
 *   - goal          a goal achieved (ref = goal). Recorded for the ledger; the goal screen has its own celebration.
 *   - habit_week    the first week with every scheduled habit kept (rest days are allowed, a missed day is not)
 *   - pillar_weeks  4 weeks in a row with every pillar getting time
 * `achieved_at` is when it really happened (the session that crossed the line), so a backfill dates old milestones right.
 */
import type { HabitDay } from '@/services/weekSummary';
import { localDayKey, localDayKeyFromIso, localDayStart, shiftDayKey } from '@/utils/dates';

export type MilestoneKind = 'pillar_hours' | 'goal' | 'habit_week' | 'pillar_weeks';
export const PILLAR_HOURS = [10, 50, 100, 250, 500, 1000] as const;
export const PILLAR_WEEKS = 4;

export interface Milestone {
  kind: MilestoneKind;
  ref_id: string | null;
  value: number;
  achieved_at: string;
}

export interface MilestoneInput {
  now: Date;
  sessions: { goal_id: string; started_at: string; duration_seconds: number }[];
  /** Live pillars (archived ones don't count toward "every pillar"). */
  pillars: { id: string; is_archived?: number }[];
  objectives: { id: string; status: string; closed_at: string | null }[];
  /** Habit days per week (Monday key → one HabitDay[7] per active habit), oldest first. */
  habitWeeks: { weekStart: string; habits: HabitDay[][] }[];
  existing: { kind: string; ref_id: string | null; value: number }[];
}

export const milestoneKey = (m: { kind: string; ref_id: string | null; value: number }) => `${m.kind}|${m.ref_id ?? ''}|${m.value}`;

const endOf = (s: { started_at: string; duration_seconds: number }) => new Date(Date.parse(s.started_at) + s.duration_seconds * 1000).toISOString();

function mondayOf(day: string): string {
  const dow = localDayStart(day).getDay();
  return shiftDayKey(day, dow === 0 ? -6 : 1 - dow);
}

export function detectMilestones(input: MilestoneInput): Milestone[] {
  const have = new Set(input.existing.map(milestoneKey));
  const out: Milestone[] = [];
  const add = (m: Milestone) => {
    const k = milestoneKey(m);
    if (have.has(k)) return;
    have.add(k);
    out.push(m);
  };
  const sessions = input.sessions.filter((s) => s.duration_seconds > 0).sort((a, b) => (a.started_at < b.started_at ? -1 : 1));

  // Pillar hours: the session that carried the pillar over each line.
  const run = new Map<string, number>();
  for (const s of sessions) {
    const before = run.get(s.goal_id) ?? 0;
    const after = before + s.duration_seconds / 3600;
    run.set(s.goal_id, after);
    for (const h of PILLAR_HOURS) if (before < h && after >= h) add({ kind: 'pillar_hours', ref_id: s.goal_id, value: h, achieved_at: endOf(s) });
  }

  for (const o of input.objectives) {
    if (o.status === 'completed' && o.closed_at) add({ kind: 'goal', ref_id: o.id, value: 1, achieved_at: o.closed_at });
  }

  // First week with every scheduled habit kept: at least one kept, nothing missed, nothing still open.
  for (const w of input.habitWeeks) {
    const days = w.habits.flat();
    if (!days.includes('done')) continue;
    if (days.some((d) => d === 'missed' || d === 'today' || d === 'upcoming')) continue;
    const weekEnd = shiftDayKey(w.weekStart, 6);
    const endOfWeek = new Date(localDayStart(shiftDayKey(weekEnd, 1)).getTime() - 1);
    const at = input.now < endOfWeek ? input.now : endOfWeek;
    add({ kind: 'habit_week', ref_id: null, value: 1, achieved_at: at.toISOString() });
    break;
  }

  // Every live pillar got time, 4 weeks in a row. A week counts from the moment its last pillar got its first minute.
  const live = input.pillars.filter((p) => !p.is_archived).map((p) => p.id);
  if (live.length && sessions.length) {
    const firstIn = new Map<string, Map<string, string>>(); // week → pillar → earliest session end
    for (const s of sessions) {
      const w = mondayOf(localDayKeyFromIso(s.started_at));
      const m = firstIn.get(w) ?? new Map<string, string>();
      const end = endOf(s);
      if (!m.has(s.goal_id) || end < m.get(s.goal_id)!) m.set(s.goal_id, end);
      firstIn.set(w, m);
    }
    const thisWeek = mondayOf(localDayKey(input.now));
    let streak = 0;
    for (let w = mondayOf(localDayKeyFromIso(sessions[0]!.started_at)); w <= thisWeek; w = shiftDayKey(w, 7)) {
      const m = firstIn.get(w);
      const full = !!m && live.every((id) => m.has(id));
      if (!full) {
        if (w !== thisWeek) streak = 0;
        continue;
      }
      streak += 1;
      if (streak === PILLAR_WEEKS) {
        const at = live.map((id) => m!.get(id)!).sort().pop()!;
        add({ kind: 'pillar_weeks', ref_id: null, value: PILLAR_WEEKS, achieved_at: at });
        break;
      }
    }
  }

  return out.sort((a, b) => (a.achieved_at < b.achieved_at ? -1 : 1));
}

/** The celebration's words. `pillarName` resolves a pillar id. */
export function milestoneCopy(m: Milestone, pillarName: (id: string) => string | null): { big: string; title: string; sub: string; share: string } {
  switch (m.kind) {
    case 'pillar_hours': {
      const name = pillarName(m.ref_id ?? '') ?? 'one pillar';
      const h = m.value.toLocaleString('en-US');
      return {
        big: `${h}h`,
        title: `${h} hours to ${name}.`,
        sub: 'Every one of them given on purpose.',
        share: `⏱ ${h} hours given to ${name}. Every one of them on purpose.\nTracked hour by hour on Intentional.`,
      };
    }
    case 'habit_week':
      return {
        big: '1 week',
        title: 'Every habit, kept all week.',
        sub: 'Each scheduled day showed up. That is who you are now.',
        share: '✅ A full week with every habit kept.\nTracked hour by hour on Intentional.',
      };
    case 'pillar_weeks':
      return {
        big: `${PILLAR_WEEKS} weeks`,
        title: `${PILLAR_WEEKS} weeks in a row, every pillar got time.`,
        sub: 'No part of the life you chose was left behind.',
        share: `🔥 ${PILLAR_WEEKS} weeks in a row giving time to every part of the life I chose.\nTracked hour by hour on Intentional.`,
      };
    default:
      return { big: '1 goal', title: 'Goal achieved.', sub: 'The hours got you there.', share: '🏆 Goal achieved.\nTracked hour by hour on Intentional.' };
  }
}

/** The goal screen already celebrates an achieved goal; everything else gets the milestone sheet. */
export const celebrates = (m: { kind: string }) => m.kind !== 'goal';
