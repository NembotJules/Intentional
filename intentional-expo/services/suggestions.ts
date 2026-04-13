/**
 * suggestions.ts — US-040: Smart suggestion engine
 *
 * Runs 5 rules against the local SQLite data and returns the highest-priority
 * suggestion for the current moment.  All operations are synchronous so the
 * result is available immediately without an async waterfall.
 *
 * Rule priority (highest → lowest):
 *   1. streak_at_risk  — active streak that hasn't been logged today
 *   2. best_time       — historical median start hour matches current hour (±1)
 *   3. overdue         — session action not logged in 3+ days
 *   4. goal_neglect    — whole goal pillar silent for 7+ days
 *   5. momentum        — fallback, surface highest current streak ≥ 3
 *
 * Returns null when there is not enough data yet or nothing to suggest.
 */

import * as api from '@/db/api';
import type { DailyAction, MetaGoal } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

export type SuggestionType =
  | 'streak_at_risk'
  | 'best_time'
  | 'overdue'
  | 'goal_neglect'
  | 'momentum';

export interface Suggestion {
  type: SuggestionType;
  headline: string;
  body: string;
  ctaLabel: string;
  /** Navigate to Focus with this action pre-selected (optional). */
  actionId?: string;
  goalId?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoSince(daysBack: number): string {
  return new Date(Date.now() - daysBack * 86400_000).toISOString();
}

function daysBetweenIso(a: string, b: string): number {
  const msA = new Date(a.slice(0, 10) + 'T12:00:00Z').getTime();
  const msB = new Date(b.slice(0, 10) + 'T12:00:00Z').getTime();
  return Math.round(Math.abs(msB - msA) / 86400_000);
}

/** Median of a numeric array; returns 0 for empty arrays. */
function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? Math.round((s[m - 1] + s[m]) / 2) : s[m];
}

function fmtHour(h: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${disp}:00 ${ampm}`;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Compute the single highest-priority suggestion for right now.
 *
 * @param activeActions  Active (is_active = 1) actions; pass sections from useTodaySections.
 * @param goals          Active (is_archived = 0) goals.
 */
export function getTopSuggestion(
  activeActions: DailyAction[],
  goals: MetaGoal[],
): Suggestion | null {
  if (!activeActions.length || !goals.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const goalMap = new Map(goals.map((g) => [g.id, g]));

  // ── Rule 1: Streak at risk ───────────────────────────────────────────────
  // Pick the action with the longest active streak that hasn't been logged today.
  let atRiskAction: DailyAction | null = null;
  let atRiskGoal: MetaGoal | null = null;
  let atRiskStreak = 0;

  for (const action of activeActions) {
    const { current } = api.getActionStreakMetrics(action.id, action.type);
    if (current < 2) continue;
    if (api.isActionLoggedTodaySync(action.id, action.type)) continue;
    if (current > atRiskStreak) {
      const goal = goalMap.get(action.goal_id);
      if (goal) {
        atRiskAction = action;
        atRiskGoal = goal;
        atRiskStreak = current;
      }
    }
  }

  if (atRiskAction && atRiskGoal) {
    return {
      type: 'streak_at_risk',
      headline: `${atRiskStreak}-day streak at risk`,
      body: `Log "${atRiskAction.name}" today to keep your streak alive.`,
      ctaLabel: atRiskAction.type === 'habit' ? 'Mark done' : 'Start session',
      actionId: atRiskAction.id,
      goalId: atRiskGoal.id,
    };
  }

  // ── Rule 2: Best time of day ─────────────────────────────────────────────
  // Need ≥ 7 sessions in last 14 days to have a meaningful sample.
  // Fire only when the current hour is within ±1 of the historical median.
  const recentSessions = api.getRecentSessionsCompact(isoSince(14));

  if (recentSessions.length >= 7) {
    const hours = recentSessions.map((s) => new Date(s.started_at).getHours());
    const medHour = median(hours);
    const nowHour = new Date().getHours();

    if (Math.abs(nowHour - medHour) <= 1) {
      // Find the most-started action during this hour window
      const counts: Record<string, number> = {};
      for (const s of recentSessions) {
        const h = new Date(s.started_at).getHours();
        if (Math.abs(h - medHour) <= 1) {
          counts[s.action_id] = (counts[s.action_id] ?? 0) + 1;
        }
      }
      const topId = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0];
      const topAction = activeActions.find((a) => a.id === topId);
      const topGoal = topAction ? goalMap.get(topAction.goal_id) : undefined;

      if (topAction && topGoal) {
        return {
          type: 'best_time',
          headline: 'Peak focus hour',
          body: `You typically start around ${fmtHour(medHour)}. "${topAction.name}" is waiting.`,
          ctaLabel: 'Start session',
          actionId: topAction.id,
          goalId: topGoal.id,
        };
      }
    }
  }

  // ── Rule 3: Overdue action ───────────────────────────────────────────────
  // Session action with ≥1 historical session but none in the last 3 days.
  let overdueDays = 2;
  let overdueAction: DailyAction | null = null;
  let overdueGoal: MetaGoal | null = null;

  for (const action of activeActions) {
    if (action.type !== 'session') continue;
    const last = api.getLastSessionDateForAction(action.id);
    if (!last) continue;
    const d = daysBetweenIso(last, today);
    if (d >= 3 && d > overdueDays) {
      const goal = goalMap.get(action.goal_id);
      if (goal) {
        overdueDays = d;
        overdueAction = action;
        overdueGoal = goal;
      }
    }
  }

  if (overdueAction && overdueGoal) {
    return {
      type: 'overdue',
      headline: `"${overdueAction.name}" — ${overdueDays} days ago`,
      body: `Your last session was ${overdueDays} day${overdueDays !== 1 ? 's' : ''} ago. Time to pick it back up.`,
      ctaLabel: 'Start session',
      actionId: overdueAction.id,
      goalId: overdueGoal.id,
    };
  }

  // ── Rule 4: Goal neglect ─────────────────────────────────────────────────
  // A whole goal that had history but has been silent for 7+ days.
  const since7d = isoSince(7);

  for (const goal of goals) {
    const total = api.getTotalSessionCountForGoal(goal.id);
    if (total === 0) continue;
    const recent = api.getSessionCountForGoalSince(goal.id, since7d);
    if (recent === 0) {
      return {
        type: 'goal_neglect',
        headline: `${goal.icon} ${goal.name} needs attention`,
        body: `No focus sessions on this goal in the past 7 days.`,
        ctaLabel: 'Focus now',
        goalId: goal.id,
      };
    }
  }

  // ── Rule 5: Momentum (fallback) ──────────────────────────────────────────
  // Surface the action with the longest current streak ≥ 3 as a positive nudge.
  let momentumAction: DailyAction | null = null;
  let momentumGoal: MetaGoal | null = null;
  let momentumStreak = 2;

  for (const action of activeActions) {
    const { current } = api.getActionStreakMetrics(action.id, action.type);
    if (current > momentumStreak) {
      const goal = goalMap.get(action.goal_id);
      if (goal) {
        momentumStreak = current;
        momentumAction = action;
        momentumGoal = goal;
      }
    }
  }

  if (momentumAction && momentumGoal) {
    return {
      type: 'momentum',
      headline: `${momentumStreak} days in a row`,
      body: `Keep the "${momentumAction.name}" momentum going today.`,
      ctaLabel: momentumAction.type === 'habit' ? 'Mark done' : 'Start session',
      actionId: momentumAction.id,
      goalId: momentumGoal.id,
    };
  }

  return null;
}
