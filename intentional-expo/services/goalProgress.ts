/**
 * Goal progress & pace domain (US-058)
 * Pure functions for calculating objective progress, days left, and pace.
 * No DB access — receives objective and tasks as parameters.
 */

import type { Objective, Task } from '@/types';

export type Pace = 'ahead' | 'on_track' | 'behind' | 'unknown';

/**
 * Calculate progress as a fraction (0.0 to 1.0+).
 * 
 * Returns:
 * - metric fraction when metric_target is set (handles counting down: current moves toward target)
 * - done tasks / total tasks when no metric
 * - null when no metric and no tasks
 */
export function progressOf(objective: Objective, tasks: Task[]): number | null {
  const target = objective.metric_target;
  if (target !== null && target !== undefined) {
    const current = objective.metric_current;
    // Measure from where the metric started: 90 → 70 kg and 0 → 5,000 € both read 0% on day one.
    const start = objective.metric_start ?? (current !== null && current !== undefined && current > target ? null : 0);
    if (current !== null && current !== undefined && start !== null) {
      if (start === target) return current === target ? 1 : 0;
      const frac = (current - start) / (target - start);
      return Math.max(0, Math.min(1, frac)); // overshooting the target counts as done
    }
  }

  // No (usable) metric: use task completion
  if (tasks.length === 0) return null;

  const doneTasks = tasks.filter(t => t.is_done === 1).length;
  return doneTasks / tasks.length;
}

/**
 * Calculate days left until deadline.
 * Returns negative if overdue, 0 if today is the deadline.
 */
export function daysLeft(objective: Objective, today: Date): number {
  const deadlineDate = new Date(objective.deadline + 'T00:00:00');
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  const diffMs = deadlineDate.getTime() - todayDate.getTime();
  // round, not floor: a DST change makes some days 23 or 25 hours long
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Calculate pace: ahead, on track, behind, or unknown.
 * 
 * Compares progress to elapsed fraction of (created_at → deadline) with ±10% tolerance band.
 * - ahead: progress > elapsed + 10%
 * - on_track: progress within ±10% of elapsed
 * - behind: progress < elapsed - 10%
 * - unknown: when progress is null (no way to measure)
 */
export function paceOf(objective: Objective, tasks: Task[], today: Date): Pace {
  const progress = progressOf(objective, tasks);
  if (progress === null) return 'unknown';
  // Past the deadline and not done is behind, however close it is.
  if (progress < 1 && daysLeft(objective, today) < 0) return 'behind';
  
  const createdAt = new Date(objective.created_at);
  const deadline = new Date(objective.deadline + 'T23:59:59');
  const now = today;
  
  // Total duration from created to deadline
  const totalMs = deadline.getTime() - createdAt.getTime();
  if (totalMs <= 0) {
    // Edge case: deadline is before or equal to created_at (shouldn't happen, but handle it)
    return progress >= 1 ? 'on_track' : 'behind';
  }
  
  // Elapsed duration from created to now
  const elapsedMs = now.getTime() - createdAt.getTime();
  const elapsedFraction = Math.max(0, Math.min(1, elapsedMs / totalMs));
  
  // Compare with ±10% tolerance band
  const tolerance = 0.1;
  
  if (progress > elapsedFraction + tolerance) return 'ahead';
  if (progress < elapsedFraction - tolerance) return 'behind';
  return 'on_track';
}
