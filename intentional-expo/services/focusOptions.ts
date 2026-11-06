/**
 * US-099 · What the "Start focusing" sheet can start: today's open timed habits, each active goal's next
 * step, and free time on any pillar. The suggestion is "Up next" (services/upNext), restricted to things
 * that take focused time (a check-off habit isn't a session).
 */
import * as api from '@/db/api';
import { getGoalColor } from '@/utils/goalColors';
import { localDayKey } from '@/utils/dates';
import { pickUpNext, type NextStep, type OpenHabit } from '@/services/upNext';

export interface FocusOption {
  key: string;
  kind: 'habit' | 'step' | 'free';
  pillarId: string;
  pillarName: string;
  color: string;
  icon: string;
  title: string;
  subtitle: string;
  minutes: number;
  actionId?: string;
  taskId?: string;
}

/** Pure: build the options and pick the suggestion. */
export function buildFocusOptions(input: {
  pillars: { id: string; name: string; color: string; icon: string }[];
  habits: OpenHabit[];
  steps: NextStep[];
  nowMinutes: number;
}): { options: FocusOption[]; suggested: FocusOption | null } {
  const byId = Object.fromEntries(input.pillars.map((p) => [p.id, p]));
  const sessions = input.habits.filter((h) => h.type === 'session' && byId[h.pillarId]);
  const habitOpts: FocusOption[] = sessions.map((h) => ({
    key: `habit:${h.id}`,
    kind: 'habit',
    pillarId: h.pillarId,
    pillarName: byId[h.pillarId]!.name,
    color: byId[h.pillarId]!.color,
    icon: byId[h.pillarId]!.icon,
    title: h.name,
    subtitle: `${byId[h.pillarId]!.name} · ${h.time ? h.time.replace(/^0/, '') : 'anytime'} · ${h.minutes} min`,
    minutes: h.minutes || 25,
    actionId: h.id,
  }));
  const stepOpts: FocusOption[] = input.steps
    .filter((s) => byId[s.pillarId])
    .map((s) => ({
      key: `step:${s.taskId}`,
      kind: 'step',
      pillarId: s.pillarId,
      pillarName: byId[s.pillarId]!.name,
      color: byId[s.pillarId]!.color,
      icon: byId[s.pillarId]!.icon,
      title: s.title,
      subtitle: `Next step · ${s.goalTitle}`,
      minutes: Math.max(15, s.minutes || 25),
      taskId: s.taskId,
    }));
  const freeOpts: FocusOption[] = input.pillars.map((p) => ({
    key: `free:${p.id}`,
    kind: 'free',
    pillarId: p.id,
    pillarName: p.name,
    color: p.color,
    icon: p.icon,
    title: `Free time for ${p.name}`,
    subtitle: 'No task or habit',
    minutes: 25,
  }));
  const options = [...habitOpts, ...stepOpts, ...freeOpts];
  const up = pickUpNext(sessions, input.steps, input.nowMinutes);
  const suggested =
    (up?.kind === 'habit' ? options.find((o) => o.actionId === up.habit.id) : up?.kind === 'step' ? options.find((o) => o.taskId === up.step.taskId) : null) ?? options[0] ?? null;
  return { options, suggested };
}

/** Reads today from the local database. */
export async function loadFocusOptions(now: Date = new Date()): Promise<{ options: FocusOption[]; suggested: FocusOption | null }> {
  const date = localDayKey(now);
  const goals = await api.getGoals();
  const skipped = api.getSkippedHabits(date);
  const habits: OpenHabit[] = [];
  const steps: NextStep[] = [];
  for (const g of goals) {
    for (const a of await api.getActionsByGoal(g.id)) {
      if (!api.isScheduledOn(a.days_mask ?? 127, date) || skipped.has(a.id)) continue;
      if (a.type === 'habit') {
        if (await api.isHabitDoneToday(a.id)) continue;
      } else {
        const mins = Math.floor((await api.getSessionsForActionToday(a.id, date)).reduce((s, x) => s + x.duration_seconds, 0) / 60);
        if (a.target_minutes > 0 && mins >= a.target_minutes) continue;
      }
      habits.push({ id: a.id, name: a.name, pillarId: g.id, time: a.reminder_time ?? null, type: a.type === 'habit' ? 'habit' : 'session', minutes: a.target_minutes });
    }
    const obj = await api.getActiveObjective(g.id);
    if (obj) {
      const next = await api.getNextTask(obj.id);
      if (next) steps.push({ taskId: next.id, title: next.title, pillarId: g.id, goalTitle: obj.title, minutes: Math.max(15, next.estimate_minutes - api.getMinutesForTask(next.id)) });
    }
  }
  habits.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'));
  return buildFocusOptions({
    pillars: goals.map((g) => ({ id: g.id, name: g.name, color: getGoalColor(g), icon: g.icon })),
    habits,
    steps,
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
  });
}
