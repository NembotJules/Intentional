import { db } from './index';
import type { MetaGoal, DailyAction, FocusSession, HabitCompletion, ActionType, SessionHistoryListItem } from '@/types';

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
type NewGoalInput = Omit<MetaGoal, 'id' | 'is_archived'> & { is_archived?: number };

export async function getGoals(): Promise<MetaGoal[]> {
  const rows = db.getAllSync<MetaGoal>('SELECT * FROM meta_goals WHERE is_archived = 0 ORDER BY sort_order ASC');
  return rows;
}

export async function addGoal(g: NewGoalInput): Promise<MetaGoal> {
  const id = uuid();
  db.runSync(
    'INSERT INTO meta_goals (id, name, color, icon, sort_order, why_statement, is_archived) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [id, g.name, g.color, g.icon, g.sort_order, g.why_statement ?? '']
  );
  return { ...g, id, is_archived: 0 };
}

export async function updateGoal(id: string, g: Partial<MetaGoal>): Promise<void> {
  const current = db.getFirstSync<MetaGoal>('SELECT * FROM meta_goals WHERE id = ?', [id]);
  if (!current) return;
  db.runSync(
    'UPDATE meta_goals SET name = ?, color = ?, icon = ?, why_statement = ? WHERE id = ?',
    [g.name ?? current.name, g.color ?? current.color, g.icon ?? current.icon, g.why_statement ?? current.why_statement, id]
  );
}

export async function archiveGoal(id: string): Promise<void> {
  db.runSync('UPDATE meta_goals SET is_archived = 1 WHERE id = ?', [id]);
}

export async function reorderGoals(orderedIds: string[]): Promise<void> {
  orderedIds.forEach((id, i) => {
    db.runSync('UPDATE meta_goals SET sort_order = ? WHERE id = ?', [i, id]);
  });
}

export async function getActionsByGoal(goalId: string, includeInactive = false): Promise<DailyAction[]> {
  if (includeInactive) {
    return db.getAllSync<DailyAction>('SELECT * FROM daily_actions WHERE goal_id = ? ORDER BY sort_order ASC', [goalId]);
  }
  return db.getAllSync<DailyAction>('SELECT * FROM daily_actions WHERE goal_id = ? AND is_active = 1 ORDER BY sort_order ASC', [goalId]);
}

export async function getAllActions(): Promise<DailyAction[]> {
  return db.getAllSync<DailyAction>('SELECT * FROM daily_actions WHERE is_active = 1 ORDER BY sort_order ASC');
}

export async function addAction(a: Omit<DailyAction, 'id'>): Promise<DailyAction> {
  const id = uuid();
  db.runSync(
    'INSERT INTO daily_actions (id, goal_id, name, type, target_minutes, reminder_time, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    [id, a.goal_id, a.name, a.type, a.target_minutes, a.reminder_time ?? null, a.sort_order]
  );
  return { ...a, id, is_active: 1 };
}

export async function updateAction(id: string, a: Partial<DailyAction>): Promise<void> {
  const current = db.getFirstSync<DailyAction>('SELECT * FROM daily_actions WHERE id = ?', [id]);
  if (!current) return;
  db.runSync(
    'UPDATE daily_actions SET name = ?, type = ?, target_minutes = ?, is_active = ? WHERE id = ?',
    [a.name ?? current.name, a.type ?? current.type, a.target_minutes ?? current.target_minutes, a.is_active ?? current.is_active, id]
  );
}

export async function deleteAction(id: string): Promise<void> {
  db.runSync('DELETE FROM daily_actions WHERE id = ?', [id]);
}

export async function reorderActions(goalId: string, orderedIds: string[]): Promise<void> {
  orderedIds.forEach((id, i) => {
    db.runSync('UPDATE daily_actions SET sort_order = ? WHERE id = ? AND goal_id = ?', [i, id, goalId]);
  });
}

export async function getSessionsBetween(start: string, end: string): Promise<FocusSession[]> {
  return db.getAllSync<FocusSession>(
    'SELECT * FROM focus_sessions WHERE started_at >= ? AND started_at <= ? ORDER BY started_at DESC',
    [start, end]
  );
}

export type SessionHistoryTimeRange = 'week' | 'month' | 'all';

/** US-030: sessions with action/goal labels, date desc, optional goal + time window */
export function getSessionHistoryList(opts: {
  timeRange: SessionHistoryTimeRange;
  goalId: string | 'all';
}): SessionHistoryListItem[] {
  const now = new Date();
  let start: Date;
  if (opts.timeRange === 'week') {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
  } else if (opts.timeRange === 'month') {
    start = new Date(now);
    start.setMonth(start.getMonth() - 1);
  } else {
    start = new Date(0);
  }
  const startIso = start.toISOString();
  const endIso = now.toISOString();

  const select = `
    SELECT fs.id, fs.action_id, fs.goal_id, fs.started_at, fs.ended_at, fs.duration_seconds, fs.note, fs.was_completed,
      COALESCE(da.name, 'Deleted action') AS action_name,
      COALESCE(mg.name, 'Unknown goal') AS goal_name
    FROM focus_sessions fs
    LEFT JOIN daily_actions da ON da.id = fs.action_id
    LEFT JOIN meta_goals mg ON mg.id = fs.goal_id
    WHERE fs.started_at >= ? AND fs.started_at <= ?
  `;

  if (opts.goalId === 'all') {
    return db.getAllSync<SessionHistoryListItem>(`${select} ORDER BY fs.started_at DESC`, [startIso, endIso]);
  }
  return db.getAllSync<SessionHistoryListItem>(
    `${select} AND fs.goal_id = ? ORDER BY fs.started_at DESC`,
    [startIso, endIso, opts.goalId]
  );
}

export async function getSessionsForActionToday(actionId: string, dateStr: string): Promise<FocusSession[]> {
  const start = dateStr + 'T00:00:00.000Z';
  const end = dateStr + 'T23:59:59.999Z';
  return db.getAllSync<FocusSession>(
    'SELECT * FROM focus_sessions WHERE action_id = ? AND started_at >= ? AND started_at <= ?',
    [actionId, start, end]
  );
}

export async function saveFocusSession(session: Omit<FocusSession, 'id'>): Promise<FocusSession> {
  const id = uuid();
  db.runSync(
    'INSERT INTO focus_sessions (id, action_id, goal_id, started_at, ended_at, duration_seconds, note, was_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, session.action_id, session.goal_id, session.started_at, session.ended_at, session.duration_seconds, session.note ?? null, session.was_completed]
  );
  return { ...session, id };
}

export async function updateFocusSessionNote(sessionId: string, note: string | null): Promise<void> {
  db.runSync('UPDATE focus_sessions SET note = ? WHERE id = ?', [note, sessionId]);
}

/** UTC calendar day YYYY-MM-DD from ISO timestamp */
function utcDayFromIso(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Longest run of consecutive UTC calendar days in a sorted ascending unique list.
 * US-033: personal best streak.
 */
export function getBestConsecutiveDayStreak(sortedUniqueDaysAsc: string[]): number {
  if (!sortedUniqueDaysAsc.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedUniqueDaysAsc.length; i++) {
    const prev = new Date(sortedUniqueDaysAsc[i - 1] + 'T12:00:00.000Z').getTime();
    const next = new Date(sortedUniqueDaysAsc[i] + 'T12:00:00.000Z').getTime();
    if ((next - prev) / 86400000 === 1) cur++;
    else {
      best = Math.max(best, cur);
      cur = 1;
    }
  }
  return Math.max(best, cur);
}

/**
 * Walk backward from today (or yesterday if today missing); count consecutive days in set.
 * US-033 / focus: streak continues if today has no session yet but chain is unbroken.
 */
export function getCurrentConsecutiveDayStreak(daySet: Set<string>): number {
  if (daySet.size === 0) return 0;
  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  let cur = new Date();
  let ymd = isoDay(cur);
  if (!daySet.has(ymd)) {
    cur = new Date(cur.getTime() - 86400000);
    ymd = isoDay(cur);
  }
  let streak = 0;
  while (daySet.has(ymd)) {
    streak++;
    cur = new Date(cur.getTime() - 86400000);
    ymd = isoDay(cur);
  }
  return streak;
}

/** US-033: session actions = days with ≥1 focus session; habits = days marked completed */
export function getActionStreakMetrics(actionId: string, type: ActionType): { current: number; best: number } {
  if (type === 'habit') {
    const rows = db.getAllSync<{ date: string }>(
      'SELECT date FROM habit_completions WHERE action_id = ? AND completed = 1 ORDER BY date ASC',
      [actionId]
    );
    const days = [...new Set(rows.map((r) => r.date))].sort();
    return {
      current: getCurrentConsecutiveDayStreak(new Set(days)),
      best: getBestConsecutiveDayStreak(days),
    };
  }
  const sessions = db.getAllSync<FocusSession>('SELECT started_at FROM focus_sessions WHERE action_id = ?', [actionId]);
  const days = [...new Set(sessions.map((s) => utcDayFromIso(s.started_at)))].sort();
  return {
    current: getCurrentConsecutiveDayStreak(new Set(days)),
    best: getBestConsecutiveDayStreak(days),
  };
}

/** Consecutive calendar days (UTC) with ≥1 focus session for this action; allows “streak continues” if today empty but yesterday had work. */
export async function getFocusStreakForAction(actionId: string): Promise<number> {
  const sessions = db.getAllSync<FocusSession>('SELECT started_at FROM focus_sessions WHERE action_id = ?', [actionId]);
  const daySet = new Set(sessions.map((s) => utcDayFromIso(s.started_at)));
  return getCurrentConsecutiveDayStreak(daySet);
}

/** Inclusive calendar days from first session date (UTC) through today — for all-time daily average (US-034). */
export function getAllTimeFocusAverageDenominatorDays(): number {
  const row = db.getFirstSync<{ min: string }>('SELECT MIN(started_at) as min FROM focus_sessions');
  if (!row?.min) return 1;
  const start = new Date(utcDayFromIso(row.min) + 'T12:00:00.000Z');
  const end = new Date();
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getHabitCompletionsForDate(dateStr: string): Promise<HabitCompletion[]> {
  return db.getAllSync<HabitCompletion>('SELECT * FROM habit_completions WHERE date = ? AND completed = 1', [dateStr]);
}

export async function isHabitDoneToday(actionId: string): Promise<boolean> {
  const row = db.getFirstSync<HabitCompletion>('SELECT * FROM habit_completions WHERE action_id = ? AND date = ? AND completed = 1', [
    actionId,
    todayStr(),
  ]);
  return !!row;
}

export async function setHabitCompletion(actionId: string, dateStr: string, completed: boolean): Promise<void> {
  const existing = db.getFirstSync<HabitCompletion>('SELECT * FROM habit_completions WHERE action_id = ? AND date = ?', [actionId, dateStr]);
  if (existing) {
    db.runSync('UPDATE habit_completions SET completed = ? WHERE id = ?', [completed ? 1 : 0, existing.id]);
  } else if (completed) {
    db.runSync('INSERT INTO habit_completions (id, action_id, date, completed) VALUES (?, ?, ?, 1)', [uuid(), actionId, dateStr]);
  }
}

export async function getWeeklySecondsByGoal(goalId: string): Promise<number> {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const rows = db.getAllSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration_seconds), 0) as total FROM focus_sessions WHERE goal_id = ? AND started_at >= ?',
    [goalId, start.toISOString()]
  );
  return rows[0]?.total ?? 0;
}
