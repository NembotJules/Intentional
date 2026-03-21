import { db } from './index';
import type { MetaGoal, DailyAction, FocusSession, HabitCompletion, ActionType } from '@/types';

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

/** Consecutive calendar days (UTC) with ≥1 focus session for this action; allows “streak continues” if today empty but yesterday had work. */
export async function getFocusStreakForAction(actionId: string): Promise<number> {
  const sessions = db.getAllSync<FocusSession>('SELECT started_at FROM focus_sessions WHERE action_id = ?', [actionId]);
  const daySet = new Set(sessions.map((s) => s.started_at.slice(0, 10)));
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
