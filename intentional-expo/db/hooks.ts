import { useState, useEffect, useCallback } from 'react';
import * as api from './api';
import type { MetaGoal, DailyAction, TodaySection } from '@/types';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useGoals(): { goals: MetaGoal[]; refresh: () => Promise<void> } {
  const [goals, setGoals] = useState<MetaGoal[]>([]);
  const refresh = useCallback(async () => {
    const rows = await api.getGoals();
    setGoals(rows);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { goals, refresh };
}

export function useTodaySections(): { sections: TodaySection[]; refresh: () => Promise<void> } {
  const [sections, setSections] = useState<TodaySection[]>([]);
  const refresh = useCallback(async () => {
    const goals = await api.getGoals();
    const result: TodaySection[] = [];
    for (const goal of goals) {
      const actions = await api.getActionsByGoal(goal.id);
      if (actions.length) result.push({ goal, actions });
    }
    setSections(result);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { sections, refresh };
}

export function useTodayScore(sections: TodaySection[]): number {
  const [score, setScore] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      let total = 0;
      let completed = 0;
      const date = todayStr();
      for (const { goal, actions } of sections) {
        for (const action of actions) {
          total++;
          if (action.type === 'habit') {
            const done = await api.isHabitDoneToday(action.id);
            if (done) completed++;
          } else {
            const sessions = await api.getSessionsForActionToday(action.id, date);
            const mins = sessions.reduce((s, x) => s + x.duration_seconds, 0) / 60;
            if (action.target_minutes <= 0 || mins >= action.target_minutes) completed++;
          }
        }
      }
      if (mounted) setScore(total ? Math.round((completed / total) * 100) : 0);
    })();
    return () => { mounted = false; };
  }, [sections]);
  return score;
}

export function useSessionMinutesToday(actionId: string): number {
  const [mins, setMins] = useState(0);
  useEffect(() => {
    api.getSessionsForActionToday(actionId, todayStr()).then((sessions) => {
      const total = sessions.reduce((s, x) => s + x.duration_seconds, 0);
      setMins(Math.floor(total / 60));
    });
  }, [actionId]);
  return mins;
}

export function useWeeklyHours(goalId: string): number {
  const [hours, setHours] = useState(0);
  useEffect(() => {
    api.getWeeklySecondsByGoal(goalId).then((sec) => setHours(sec / 3600));
  }, [goalId]);
  return hours;
}

export function useInsightsData(timeRange: 'week' | 'month' | 'all', refreshSignal = 0) {
  const [goalHours, setGoalHours] = useState<{ goal: MetaGoal; hours: number }[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [dailyAverage, setDailyAverage] = useState(0);
  const [streaks, setStreaks] = useState<{ action: DailyAction; goal: MetaGoal; current: number; best: number }[]>([]);
  /** No goals, or never logged a focus session (US-031 empty state still expects first session). */
  const [showInsightsEmpty, setShowInsightsEmpty] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const now = new Date();
      let start: Date;
      if (timeRange === 'week') {
        start = new Date(now);
        start.setDate(start.getDate() - 7);
      } else if (timeRange === 'month') {
        start = new Date(now);
        start.setMonth(start.getMonth() - 1);
      } else {
        start = new Date(0);
      }
      const goals = await api.getGoals();
      const everSessions = await api.getSessionsBetween(new Date(0).toISOString(), now.toISOString());
      if (!mounted) return;
      setShowInsightsEmpty(goals.length === 0 || everSessions.length === 0);

      const sessions = await api.getSessionsBetween(start.toISOString(), now.toISOString());
      const byGoal: Record<string, number> = {};
      goals.forEach((g) => {
        byGoal[g.id] = 0;
      });
      sessions.forEach((s) => {
        byGoal[s.goal_id] = (byGoal[s.goal_id] ?? 0) + s.duration_seconds;
      });
      const totalSec = Object.values(byGoal).reduce((a, b) => a + b, 0);
      const totalH = totalSec / 3600;
      setTotalHours(totalH);
      setGoalHours(goals.map((g) => ({ goal: g, hours: (byGoal[g.id] ?? 0) / 3600 })));

      let periodDays = 7;
      if (timeRange === 'month') periodDays = 30;
      if (timeRange === 'all') periodDays = api.getAllTimeFocusAverageDenominatorDays();
      setDailyAverage(periodDays > 0 ? totalH / periodDays : 0);

      const actionStreaks: { action: DailyAction; goal: MetaGoal; current: number; best: number }[] = [];
      for (const g of goals) {
        const actions = await api.getActionsByGoal(g.id);
        for (const a of actions) {
          const m = api.getActionStreakMetrics(a.id, a.type);
          actionStreaks.push({ action: a, goal: g, current: m.current, best: m.best });
        }
      }
      actionStreaks.sort((x, y) => y.current - x.current || y.best - x.best || x.action.name.localeCompare(y.action.name));
      if (mounted) setStreaks(actionStreaks);
    })();
    return () => {
      mounted = false;
    };
  }, [timeRange, refreshSignal]);

  return { goalHours, totalHours, dailyAverage, streaks, showInsightsEmpty };
}
