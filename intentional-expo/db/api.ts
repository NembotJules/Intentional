import { db, getSetting as getSettingRaw, setSetting } from './index';

/** Re-export so screens can call api.getSetting without a separate db import */
export const getSetting = getSettingRaw;
import type { MetaGoal, DailyAction, FocusSession, HabitCompletion, ActionType, SessionHistoryListItem, WeeklyReview, Objective, ObjectiveStatus, Task } from '@/types';
import { dayKeyDiff, localDayKey, localDayKeyFromIso, localDayRangeIso, localDayStart, shiftDayKey } from '@/utils/dates';

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
type NewGoalInput = Omit<MetaGoal, 'id' | 'is_archived'> & { is_archived?: number };

// ─── Custom errors (US-055) ─────────────────────────────────────────────────

export class ActiveObjectiveExistsError extends Error {
  constructor(pillarId: string) {
    super(`Pillar ${pillarId} already has an active objective`);
    this.name = 'ActiveObjectiveExistsError';
  }
}

export async function getGoals(): Promise<MetaGoal[]> {
  const rows = db.getAllSync<MetaGoal>('SELECT * FROM meta_goals WHERE is_archived = 0 ORDER BY sort_order ASC');
  return rows;
}

export async function getGoalById(id: string): Promise<MetaGoal | null> {
  const row = db.getFirstSync<MetaGoal>('SELECT * FROM meta_goals WHERE id = ? AND is_archived = 0', [id]);
  return row ?? null;
}

/** All focus time on this goal (seconds) */
export function getTotalFocusSecondsForGoal(goalId: string): number {
  const rows = db.getAllSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE goal_id = ?',
    [goalId]
  );
  return rows[0]?.total ?? 0;
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

// ─── Objectives (US-055) ────────────────────────────────────────────────────

export async function getObjectives(pillarId?: string): Promise<Objective[]> {
  if (pillarId) {
    return db.getAllSync<Objective>(
      'SELECT * FROM objectives WHERE pillar_id = ? ORDER BY sort_order ASC',
      [pillarId]
    );
  }
  return db.getAllSync<Objective>('SELECT * FROM objectives ORDER BY sort_order ASC');
}

export async function getActiveObjective(pillarId: string): Promise<Objective | null> {
  const row = db.getFirstSync<Objective>(
    'SELECT * FROM objectives WHERE pillar_id = ? AND status = ? LIMIT 1',
    [pillarId, 'active']
  );
  return row ?? null;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day "YYYY-MM-DD" (rejects "2026-1-5", "abc", "2026-02-30"). */
export function isValidDayKey(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY_KEY.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  return dt.getFullYear() === y && dt.getMonth() === m! - 1 && dt.getDate() === d;
}

function validateObjectiveText(title: string | undefined, doneWhen: string | undefined): void {
  if (title !== undefined) {
    if (!title.trim()) throw new Error('Objective title is required');
    if (title.length > 60) throw new Error('Objective title must be 60 characters or less');
  }
  if (doneWhen !== undefined && doneWhen.length > 140) {
    throw new Error('Objective done_when must be 140 characters or less');
  }
}

/** Deadlines are local calendar days and can't be in the past (today is fine). */
function validateDeadline(deadline: string): void {
  if (!isValidDayKey(deadline)) throw new Error('Objective deadline must be a date (YYYY-MM-DD)');
  if (deadline < localDayKey()) throw new Error('Objective deadline must be today or later');
}

export async function addObjective(
  input: Omit<Objective, 'id' | 'created_at' | 'closed_at' | 'close_note' | 'metric_start'> & { metric_start?: number | null }
): Promise<Objective> {
  validateObjectiveText(input.title, input.done_when);
  validateDeadline(input.deadline);

  // Check one-active invariant when status is active
  if (input.status === 'active') {
    const existing = await getActiveObjective(input.pillar_id);
    if (existing) {
      throw new ActiveObjectiveExistsError(input.pillar_id);
    }
  }

  const id = uuid();
  const created_at = new Date().toISOString();
  const objective: Objective = {
    ...input,
    title: input.title.trim(),
    // The metric's starting point is where it stands today unless given.
    metric_start: input.metric_start ?? (input.metric_target != null ? input.metric_current : null),
    id,
    created_at,
    closed_at: null,
    close_note: null,
  };

  db.runSync(
    'INSERT INTO objectives (id, pillar_id, title, done_when, deadline, status, metric_current, metric_target, metric_unit, metric_start, sort_order, created_at, closed_at, close_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      objective.id,
      objective.pillar_id,
      objective.title,
      objective.done_when,
      objective.deadline,
      objective.status,
      objective.metric_current,
      objective.metric_target,
      objective.metric_unit,
      objective.metric_start ?? null,
      objective.sort_order,
      objective.created_at,
      objective.closed_at,
      objective.close_note,
    ]
  );

  return objective;
}

export async function updateObjective(id: string, patch: Partial<Omit<Objective, 'id' | 'pillar_id' | 'created_at'>>): Promise<void> {
  const current = db.getFirstSync<Objective>('SELECT * FROM objectives WHERE id = ?', [id]);
  if (!current) throw new Error(`Objective ${id} does not exist`);

  validateObjectiveText(patch.title, patch.done_when);
  if (patch.deadline !== undefined && patch.deadline !== current.deadline) validateDeadline(patch.deadline);

  // Status changes go through setObjectiveStatus so closed_at / close_note stay consistent.
  const { status, closed_at: _c, close_note: _n, ...rest } = patch;
  if (status !== undefined && status !== current.status) await setObjectiveStatus(id, status, patch.close_note ?? undefined);
  const latest = db.getFirstSync<Objective>('SELECT * FROM objectives WHERE id = ?', [id])!;

  const updated: Objective = { ...latest, ...rest, title: (rest.title ?? latest.title).trim() };
  // Adding a metric later starts it from its current value.
  if (updated.metric_target != null && updated.metric_start == null) updated.metric_start = updated.metric_current;
  // A note can be added after closing (e.g. the reflection after "Mark as achieved").
  const close_note = patch.close_note !== undefined && status === undefined ? patch.close_note?.slice(0, 140) ?? null : latest.close_note;

  db.runSync(
    'UPDATE objectives SET title = ?, done_when = ?, deadline = ?, metric_current = ?, metric_target = ?, metric_unit = ?, metric_start = ?, sort_order = ?, close_note = ? WHERE id = ?',
    [
      updated.title,
      updated.done_when,
      updated.deadline,
      updated.metric_current,
      updated.metric_target,
      updated.metric_unit,
      updated.metric_start ?? null,
      updated.sort_order,
      close_note,
      id,
    ]
  );
}

export async function setObjectiveStatus(id: string, status: ObjectiveStatus, note?: string): Promise<void> {
  const current = db.getFirstSync<Objective>('SELECT * FROM objectives WHERE id = ?', [id]);
  if (!current) throw new Error(`Objective ${id} does not exist`);

  // Check one-active invariant if activating
  if (status === 'active' && current.status !== 'active') {
    const existing = await getActiveObjective(current.pillar_id);
    if (existing && existing.id !== id) {
      throw new ActiveObjectiveExistsError(current.pillar_id);
    }
  }

  // Closing stamps closed_at and the note; reopening keeps the old ones as history (nothing is ever deleted).
  const closing = status === 'completed' || status === 'dropped';
  const closed_at = closing ? new Date().toISOString() : current.closed_at;
  const close_note = closing ? (note?.slice(0, 140) ?? null) : current.close_note;

  db.runSync(
    'UPDATE objectives SET status = ?, closed_at = ?, close_note = ? WHERE id = ?',
    [status, closed_at, close_note, id]
  );
}

// ─── Tasks (US-056) ─────────────────────────────────────────────────────────

export async function getTasks(objectiveId: string): Promise<Task[]> {
  return db.getAllSync<Task>(
    'SELECT * FROM tasks WHERE objective_id = ? ORDER BY sort_order ASC',
    [objectiveId]
  );
}

function validateTaskFields(title: string | undefined, estimate: number | undefined, planned: string | null | undefined): void {
  if (title !== undefined) {
    if (!title.trim()) throw new Error('Task title is required');
    if (title.length > 60) throw new Error('Task title must be 60 characters or less');
  }
  if (estimate !== undefined && !(Number.isFinite(estimate) && estimate > 0)) {
    throw new Error('Task estimate must be greater than 0');
  }
  if (planned != null && !isValidDayKey(planned)) throw new Error('Task planned_date must be a date (YYYY-MM-DD)');
}

export async function addTask(
  input: Omit<Task, 'id' | 'created_at' | 'is_done' | 'done_at' | 'estimate_minutes' | 'sort_order' | 'planned_date'> & {
    estimate_minutes?: number;
    sort_order?: number;
    planned_date?: string | null;
  }
): Promise<Task> {
  const estimate = input.estimate_minutes ?? 30;
  validateTaskFields(input.title, estimate, input.planned_date);

  // Validate objective exists
  const objective = db.getFirstSync<Objective>(
    'SELECT * FROM objectives WHERE id = ?',
    [input.objective_id]
  );
  if (!objective) {
    throw new Error(`Objective ${input.objective_id} does not exist`);
  }

  const id = uuid();
  const created_at = new Date().toISOString();
  // New tasks go to the end of the goal's list unless an order is given.
  const last = db.getAllSync<{ sort_order: number }>('SELECT sort_order FROM tasks WHERE objective_id = ?', [input.objective_id]);
  const task: Task = {
    ...input,
    title: input.title.trim(),
    estimate_minutes: estimate,
    planned_date: input.planned_date ?? null,
    sort_order: input.sort_order ?? (last.length ? Math.max(...last.map((r) => Number(r.sort_order) || 0)) + 1 : 0),
    id,
    is_done: 0,
    done_at: null,
    created_at,
  };

  db.runSync(
    'INSERT INTO tasks (id, objective_id, title, estimate_minutes, planned_date, is_done, done_at, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      task.id,
      task.objective_id,
      task.title,
      task.estimate_minutes,
      task.planned_date,
      task.is_done,
      task.done_at,
      task.sort_order,
      task.created_at,
    ]
  );

  return task;
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id' | 'objective_id' | 'created_at'>>): Promise<void> {
  const current = db.getFirstSync<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
  if (!current) throw new Error(`Task ${id} does not exist`);
  validateTaskFields(patch.title, patch.estimate_minutes, patch.planned_date);

  const updated: Task = {
    ...current,
    ...patch,
    title: (patch.title ?? current.title).trim(),
  };

  db.runSync(
    'UPDATE tasks SET title = ?, estimate_minutes = ?, planned_date = ?, is_done = ?, done_at = ?, sort_order = ? WHERE id = ?',
    [
      updated.title,
      updated.estimate_minutes,
      updated.planned_date,
      updated.is_done,
      updated.done_at,
      updated.sort_order,
      id,
    ]
  );
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const done_at = done ? new Date().toISOString() : null;
  db.runSync(
    'UPDATE tasks SET is_done = ?, done_at = ? WHERE id = ?',
    [done ? 1 : 0, done_at, id]
  );
}

/** Deletes a task for good (its sessions keep their hours; they just lose the task link). */
export async function deleteTask(id: string): Promise<void> {
  db.runSync('DELETE FROM tasks WHERE id = ?', [id]);
}

/**
 * Puts `orderedIds` first, in that order; every other task of the goal keeps its relative order after them,
 * so order numbers never collide (e.g. when the UI reorders only the not-done tasks).
 */
export async function reorderTasks(objectiveId: string, orderedIds: string[]): Promise<void> {
  const all = await getTasks(objectiveId);
  const own = new Set(all.map((t) => t.id));
  const first = orderedIds.filter((id) => own.has(id));
  const rest = all.map((t) => t.id).filter((id) => !first.includes(id));
  [...first, ...rest].forEach((id, i) => {
    db.runSync('UPDATE tasks SET sort_order = ? WHERE id = ?', [i, id]);
  });
}

export async function getNextTask(objectiveId: string): Promise<Task | null> {
  const row = db.getFirstSync<Task>(
    'SELECT * FROM tasks WHERE objective_id = ? AND is_done = 0 ORDER BY sort_order ASC LIMIT 1',
    [objectiveId]
  );
  return row ?? null;
}

/** Open (not-done) tasks of active goals planned for `date`. */
export async function getTasksPlannedFor(date: string): Promise<Task[]> {
  return (await getOpenPlannedTasks()).filter((t) => t.planned_date === date);
}

/** Open tasks of active goals that have a planned day (today's plan + anything rolled over). */
export async function getOpenPlannedTasks(): Promise<Task[]> {
  const active = new Set(
    db.getAllSync<{ id: string }>('SELECT id FROM objectives WHERE status = ?', ['active']).map((o) => o.id)
  );
  return db
    .getAllSync<Task>('SELECT * FROM tasks WHERE is_done = ?', [0])
    .filter((t) => t.planned_date != null && active.has(t.objective_id))
    .sort((a, b) => (a.planned_date! < b.planned_date! ? -1 : a.planned_date! > b.planned_date! ? 1 : a.sort_order - b.sort_order));
}

// ─── Rollups (US-057) ───────────────────────────────────────────────────────

export function getMinutesForTask(taskId: string): number {
  const rows = db.getAllSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE task_id = ?',
    [taskId]
  );
  return Math.floor((rows[0]?.total ?? 0) / 60);
}

export function getMinutesForObjective(objectiveId: string, range?: { start: string; end: string }): number {
  if (range) {
    const rows = db.getAllSync<{ total: number }>(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE objective_id = ? AND started_at >= ? AND started_at <= ?',
      [objectiveId, range.start, range.end]
    );
    return Math.floor((rows[0]?.total ?? 0) / 60);
  }
  const rows = db.getAllSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE objective_id = ?',
    [objectiveId]
  );
  return Math.floor((rows[0]?.total ?? 0) / 60);
}

export function getMinutesForPillar(pillarId: string, range?: { start: string; end: string }): number {
  if (range) {
    const rows = db.getAllSync<{ total: number }>(
      'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE goal_id = ? AND started_at >= ? AND started_at <= ?',
      [pillarId, range.start, range.end]
    );
    return Math.floor((rows[0]?.total ?? 0) / 60);
  }
  const rows = db.getAllSync<{ total: number }>(
    'SELECT COALESCE(SUM(duration_seconds), 0) AS total FROM focus_sessions WHERE goal_id = ?',
    [pillarId]
  );
  return Math.floor((rows[0]?.total ?? 0) / 60);
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
  const objective_id = a.objective_id ?? null;
  const days_mask = a.days_mask ?? 127;
  db.runSync(
    'INSERT INTO daily_actions (id, goal_id, name, type, target_minutes, reminder_time, is_active, sort_order, objective_id, days_mask) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)',
    [id, a.goal_id, a.name, a.type, a.target_minutes, a.reminder_time ?? null, a.sort_order, objective_id, days_mask]
  );
  return { ...a, id, is_active: 1, objective_id, days_mask };
}

export async function updateAction(id: string, a: Partial<DailyAction>): Promise<void> {
  const current = db.getFirstSync<DailyAction>('SELECT * FROM daily_actions WHERE id = ?', [id]);
  if (!current) return;
  if (a.days_mask !== undefined && (a.days_mask & 127) === 0) throw new Error('A habit needs at least one day');
  db.runSync(
    'UPDATE daily_actions SET name = ?, type = ?, target_minutes = ?, is_active = ?, reminder_time = ?, objective_id = ?, days_mask = ? WHERE id = ?',
    [
      a.name ?? current.name,
      a.type ?? current.type,
      a.target_minutes ?? current.target_minutes,
      a.is_active ?? current.is_active,
      'reminder_time' in a ? (a.reminder_time ?? null) : current.reminder_time,
      'objective_id' in a ? (a.objective_id ?? null) : current.objective_id,
      a.days_mask ?? current.days_mask,
      id,
    ]
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
    SELECT fs.id, fs.action_id, fs.goal_id, fs.started_at, fs.ended_at, fs.duration_seconds, fs.note, fs.was_completed, fs.task_id,
      da.name AS action_name,
      COALESCE(mg.name, 'Unknown goal') AS goal_name,
      mg.color AS goal_color
    FROM focus_sessions fs
    LEFT JOIN daily_actions da ON da.id = fs.action_id
    LEFT JOIN meta_goals mg ON mg.id = fs.goal_id
    WHERE fs.started_at >= ? AND fs.started_at <= ?
  `;

  const rows =
    opts.goalId === 'all'
      ? db.getAllSync<SessionHistoryListItem>(`${select} ORDER BY fs.started_at DESC`, [startIso, endIso])
      : db.getAllSync<SessionHistoryListItem>(`${select} AND fs.goal_id = ? ORDER BY fs.started_at DESC`, [startIso, endIso, opts.goalId]);
  // Tasks and pillar-only sessions have no habit: label them by task title or "Free time".
  return rows.map((r) => ({ ...r, action_name: r.action_name || sessionLabel(r) }));
}

export async function getSessionsForActionToday(actionId: string, dateStr: string): Promise<FocusSession[]> {
  const { start, end } = localDayRangeIso(dateStr);
  return db.getAllSync<FocusSession>(
    'SELECT * FROM focus_sessions WHERE action_id = ? AND started_at >= ? AND started_at <= ?',
    [actionId, start, end]
  );
}

/**
 * Saves a session. Every session resolves to its goal when it has one (model § 4, invariant 3):
 * a task's goal, or the goal a habit is linked to. Callers don't have to pass objective_id.
 */
export async function saveFocusSession(session: Omit<FocusSession, 'id'>): Promise<FocusSession> {
  const id = uuid();
  const task_id = session.task_id ?? null;
  let objective_id = session.objective_id ?? null;
  if (!objective_id && task_id) {
    objective_id = db.getFirstSync<{ objective_id: string }>('SELECT objective_id FROM tasks WHERE id = ?', [task_id])?.objective_id ?? null;
  }
  if (!objective_id && session.action_id) {
    objective_id =
      db.getFirstSync<{ objective_id: string | null }>('SELECT objective_id FROM daily_actions WHERE id = ?', [session.action_id])?.objective_id ?? null;
  }
  db.runSync(
    'INSERT INTO focus_sessions (id, action_id, goal_id, started_at, ended_at, duration_seconds, note, was_completed, task_id, objective_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, session.action_id, session.goal_id, session.started_at, session.ended_at, session.duration_seconds, session.note ?? null, session.was_completed, task_id, objective_id]
  );
  return { ...session, id, task_id, objective_id };
}

export async function updateFocusSessionNote(sessionId: string, note: string | null): Promise<void> {
  db.runSync('UPDATE focus_sessions SET note = ? WHERE id = ?', [note, sessionId]);
}

/**
 * Longest run of consecutive calendar days in a sorted ascending unique list.
 * US-033: personal best streak.
 */
export function getBestConsecutiveDayStreak(sortedUniqueDaysAsc: string[]): number {
  if (!sortedUniqueDaysAsc.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sortedUniqueDaysAsc.length; i++) {
    if (dayKeyDiff(sortedUniqueDaysAsc[i - 1], sortedUniqueDaysAsc[i]) === 1) cur++;
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
  let ymd = localDayKey();
  if (!daySet.has(ymd)) ymd = shiftDayKey(ymd, -1);
  let streak = 0;
  while (daySet.has(ymd)) {
    streak++;
    ymd = shiftDayKey(ymd, -1);
  }
  return streak;
}

/** True when a habit with `daysMask` (bit 0 = Monday … bit 6 = Sunday) is scheduled on `dayKey`. */
export function isScheduledOn(daysMask: number, dayKey: string): boolean {
  const dow = localDayStart(dayKey).getDay(); // 0 = Sunday
  const bit = dow === 0 ? 6 : dow - 1;
  return ((daysMask ?? 127) & (1 << bit)) !== 0;
}

/**
 * US-069: streaks count scheduled days only. Unscheduled days are skipped (a Mon/Wed/Fri habit
 * doesn't break on Tuesday); today doesn't break the current streak until it's over.
 * Exported for tests; `today` is injectable.
 */
export function scheduledStreaks(doneDays: Set<string>, daysMask: number, today: string = localDayKey()): { current: number; best: number } {
  const mask = (daysMask ?? 127) & 127;
  if (mask === 0 || doneDays.size === 0) return { current: 0, best: 0 };
  // current: walk back over scheduled days
  let current = 0;
  let day = today;
  if (isScheduledOn(mask, day) && !doneDays.has(day)) day = shiftDayKey(day, -1); // today still open
  for (let guard = 0; guard < 3660; guard++, day = shiftDayKey(day, -1)) {
    if (!isScheduledOn(mask, day)) continue;
    if (!doneDays.has(day)) break;
    current++;
  }
  // best: longest run of consecutive scheduled days that were all done
  const sorted = [...doneDays].filter((d) => isScheduledOn(mask, d)).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    let expected = prev ? shiftDayKey(prev, 1) : d;
    while (prev && !isScheduledOn(mask, expected)) expected = shiftDayKey(expected, 1);
    run = prev && expected === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

/** US-033: session actions = days with ≥1 focus session; habits = days marked completed. Respects the habit's schedule. */
export function getActionStreakMetrics(actionId: string, type: ActionType): { current: number; best: number } {
  const mask = db.getFirstSync<{ days_mask: number | null }>('SELECT days_mask FROM daily_actions WHERE id = ?', [actionId])?.days_mask ?? 127;
  if (type === 'habit') {
    const rows = db.getAllSync<{ date: string }>(
      'SELECT date FROM habit_completions WHERE action_id = ? AND completed = 1 ORDER BY date ASC',
      [actionId]
    );
    return scheduledStreaks(new Set(rows.map((r) => r.date)), mask);
  }
  const sessions = db.getAllSync<FocusSession>('SELECT started_at FROM focus_sessions WHERE action_id = ?', [actionId]);
  return scheduledStreaks(new Set(sessions.map((s) => localDayKeyFromIso(s.started_at))), mask);
}

// ─── Goal sessions, pillar maintenance ──────────────────────────────────────

/** Minutes given per pillar on a local day — every session counts (habits, tasks, free time). */
export function getMinutesByPillarForDay(dayKey: string): Record<string, number> {
  const { start, end } = localDayRangeIso(dayKey);
  const rows = db.getAllSync<FocusSession>('SELECT * FROM focus_sessions WHERE started_at >= ? AND started_at <= ?', [start, end]);
  const out: Record<string, number> = {};
  for (const s of rows) out[s.goal_id] = (out[s.goal_id] ?? 0) + Math.floor(s.duration_seconds / 60);
  return out;
}

export interface ObjectiveSessionRow {
  id: string;
  started_at: string;
  duration_seconds: number;
  was_completed: number;
  /** What the time went to: the task title, the habit name, or "Free time". */
  label: string;
}

/** US-061: the latest sessions that count toward a goal (tasks and linked habits), newest first. */
export function getSessionsForObjective(objectiveId: string, limit = 10): ObjectiveSessionRow[] {
  const sessions = db.getAllSync<FocusSession>('SELECT * FROM focus_sessions WHERE objective_id = ?', [objectiveId]);
  return sessions
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .slice(0, limit)
    .map((s) => ({ id: s.id, started_at: s.started_at, duration_seconds: s.duration_seconds, was_completed: s.was_completed, label: sessionLabel(s) }));
}

/** Human label for a session: task title → habit name → "Free time". */
export function sessionLabel(s: Pick<FocusSession, 'action_id' | 'task_id'>): string {
  if (s.task_id) {
    const t = db.getFirstSync<{ title: string }>('SELECT title FROM tasks WHERE id = ?', [s.task_id]);
    if (t) return t.title;
  }
  if (s.action_id) {
    const a = db.getFirstSync<{ name: string }>('SELECT name FROM daily_actions WHERE id = ?', [s.action_id]);
    if (a) return a.name;
    return 'Deleted habit';
  }
  return 'Free time';
}

const MAINTENANCE_KEY = 'maintenance_pillars';

/** US-074: pillars the person marked "runs on habits" (no goal nudges). */
export function getMaintenancePillars(): Set<string> {
  try {
    return new Set(JSON.parse(getSetting(MAINTENANCE_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function setPillarMaintenance(pillarId: string, maintenance: boolean): void {
  const set = getMaintenancePillars();
  if (maintenance) set.add(pillarId);
  else set.delete(pillarId);
  setSetting(MAINTENANCE_KEY, JSON.stringify([...set]));
}

/** Best streak (days) across all actions on this goal */
export function getGoalBestStreakDays(goalId: string): number {
  const actions = db.getAllSync<DailyAction>('SELECT * FROM daily_actions WHERE goal_id = ?', [goalId]);
  let best = 0;
  for (const a of actions) {
    const m = getActionStreakMetrics(a.id, a.type);
    best = Math.max(best, m.best);
  }
  return best;
}

/** Consecutive local calendar days with ≥1 focus session for this action; allows “streak continues” if today empty but yesterday had work. */
export async function getFocusStreakForAction(actionId: string): Promise<number> {
  const sessions = db.getAllSync<FocusSession>('SELECT started_at FROM focus_sessions WHERE action_id = ?', [actionId]);
  const daySet = new Set(sessions.map((s) => localDayKeyFromIso(s.started_at)));
  return getCurrentConsecutiveDayStreak(daySet);
}

/** Inclusive local calendar days from first session date through today — for all-time daily average (US-034). */
export function getAllTimeFocusAverageDenominatorDays(): number {
  const row = db.getFirstSync<{ min: string }>('SELECT MIN(started_at) as min FROM focus_sessions');
  if (!row?.min) return 1;
  return Math.max(1, dayKeyDiff(localDayKeyFromIso(row.min), localDayKey()) + 1);
}

function todayStr(): string {
  return localDayKey();
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

// ─── Sync helpers used by the suggestion engine (US-040) ─────────────────────

/** True if the action was already logged today (habit: completed; session: ≥1 session). */
export function isActionLoggedTodaySync(actionId: string, type: ActionType): boolean {
  const t = todayStr();
  if (type === 'habit') {
    const row = db.getFirstSync<{ id: string }>(
      'SELECT id FROM habit_completions WHERE action_id = ? AND date = ? AND completed = 1',
      [actionId, t],
    );
    return !!row;
  }
  const row = db.getFirstSync<{ id: string }>(
    'SELECT id FROM focus_sessions WHERE action_id = ? AND started_at >= ?',
    [actionId, localDayRangeIso(t).start],
  );
  return !!row;
}

/** ISO string of the most recent session for this action, or null if never logged. */
export function getLastSessionDateForAction(actionId: string): string | null {
  const row = db.getFirstSync<{ last: string | null }>(
    'SELECT MAX(started_at) AS last FROM focus_sessions WHERE action_id = ?',
    [actionId],
  );
  return row?.last ?? null;
}

/** Compact rows for stats: { started_at, action_id, goal_id } from the last N days. */
export function getRecentSessionsCompact(
  sinceIso: string,
): Array<{ started_at: string; action_id: string; goal_id: string }> {
  return db.getAllSync<{ started_at: string; action_id: string; goal_id: string }>(
    'SELECT started_at, action_id, goal_id FROM focus_sessions WHERE started_at >= ? ORDER BY started_at DESC',
    [sinceIso],
  );
}

/** How many sessions exist for a goal after sinceIso. */
export function getSessionCountForGoalSince(goalId: string, sinceIso: string): number {
  const row = db.getFirstSync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM focus_sessions WHERE goal_id = ? AND started_at >= ?',
    [goalId, sinceIso],
  );
  return row?.cnt ?? 0;
}

/** Total session count for a goal across all time. */
export function getTotalSessionCountForGoal(goalId: string): number {
  const row = db.getFirstSync<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM focus_sessions WHERE goal_id = ?',
    [goalId],
  );
  return row?.cnt ?? 0;
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

/** US-041 — Screen Time–style category labels (FamilyControls-shaped prefs; Expo Go cannot enforce shields). */
export const BLOCKABLE_APP_CATEGORIES = [
  { id: 'social', label: 'Social' },
  { id: 'games', label: 'Games' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'reading', label: 'Reading & Reference' },
  { id: 'health', label: 'Health & Fitness' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'creativity', label: 'Creativity' },
  { id: 'education', label: 'Education' },
  { id: 'finance', label: 'Finance' },
] as const;

const BLOCKED_CATEGORIES_KEY = 'blocked_category_ids';
const BLOCKED_CATEGORIES_DEFAULT = ['social', 'games', 'entertainment'];

export function getBlockedCategoryIds(): string[] {
  const raw = getSetting(BLOCKED_CATEGORIES_KEY);
  if (!raw) return [...BLOCKED_CATEGORIES_DEFAULT];
  try {
    const p = JSON.parse(raw) as unknown;
    if (!Array.isArray(p)) return [...BLOCKED_CATEGORIES_DEFAULT];
    return p.filter((x): x is string => typeof x === 'string');
  } catch {
    return [...BLOCKED_CATEGORIES_DEFAULT];
  }
}

export function setBlockedCategoryIds(ids: string[]): void {
  const valid = new Set<string>(BLOCKABLE_APP_CATEGORIES.map((c) => c.id));
  const next = ids.filter((id) => valid.has(id));
  setSetting(BLOCKED_CATEGORIES_KEY, JSON.stringify(next.length > 0 ? next : [...BLOCKED_CATEGORIES_DEFAULT]));
}

// ─── US-045: Delete All Data ─────────────────────────────────────────────────

export function deleteAllData(): void {
  db.execSync(`
    DELETE FROM focus_sessions;
    DELETE FROM habit_completions;
    DELETE FROM daily_actions;
    DELETE FROM tasks;
    DELETE FROM objectives;
    DELETE FROM meta_goals;
    DELETE FROM weekly_reviews;
    DELETE FROM settings;
  `);
}

// ─── US-036/037: Weekly Reviews ──────────────────────────────────────────────

/** Local date string (YYYY-MM-DD) for the Monday of the current week. */
export function currentWeekStart(): string {
  const today = localDayKey();
  const day = localDayStart(today).getDay();
  return shiftDayKey(today, day === 0 ? -6 : 1 - day);
}

export function saveWeeklyReview(review: Omit<WeeklyReview, 'id' | 'created_at'>): WeeklyReview {
  const id = uuid();
  const created_at = new Date().toISOString();
  db.runSync(
    `INSERT INTO weekly_reviews (id, week_start, went_well, improve, adjustments, goals_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       went_well = excluded.went_well,
       improve = excluded.improve,
       adjustments = excluded.adjustments,
       goals_data = excluded.goals_data,
       created_at = excluded.created_at`,
    [id, review.week_start, review.went_well, review.improve, review.adjustments, review.goals_data ?? null, created_at]
  );
  const saved = db.getFirstSync<WeeklyReview>('SELECT * FROM weekly_reviews WHERE week_start = ?', [review.week_start]);
  return saved ?? { ...review, id, created_at };
}

export function getWeeklyReviews(): WeeklyReview[] {
  return db.getAllSync<WeeklyReview>('SELECT * FROM weekly_reviews ORDER BY week_start DESC');
}

export function getWeeklyReviewForWeek(weekStart: string): WeeklyReview | null {
  return db.getFirstSync<WeeklyReview>('SELECT * FROM weekly_reviews WHERE week_start = ?', [weekStart]) ?? null;
}

// ─── US-042: All actions (Settings flat list) ─────────────────────────────────

export interface ActionWithGoal extends DailyAction {
  goal_name: string;
  goal_color: string;
  goal_icon: string;
}

// ─── US-044: CSV Export ────────────────────────────────────────────────────────

/** One CSV row per focus session. */
export interface SessionCsvRow {
  date: string;
  goal: string;
  action: string;
  duration_minutes: number;
  completed: string;
  note: string;
}

export function getAllSessionsCsvRows(): SessionCsvRow[] {
  const rows = db.getAllSync<{
    started_at: string;
    duration_seconds: number;
    was_completed: number;
    note: string | null;
    action_id: string | null;
    task_id: string | null;
    action_name: string | null;
    goal_name: string;
  }>(
    `SELECT fs.started_at, fs.duration_seconds, fs.was_completed, fs.note, fs.action_id, fs.task_id,
       da.name AS action_name,
       COALESCE(mg.name, 'Unknown goal')   AS goal_name
     FROM focus_sessions fs
     LEFT JOIN daily_actions da ON da.id = fs.action_id
     LEFT JOIN meta_goals mg ON mg.id = fs.goal_id
     ORDER BY fs.started_at DESC`
  );
  return rows.map((r) => ({
    date: localDayKeyFromIso(r.started_at),
    goal: r.goal_name,
    action: r.action_name || sessionLabel(r),
    duration_minutes: Math.round(r.duration_seconds / 60),
    completed: r.was_completed ? 'yes' : 'no',
    note: r.note ?? '',
  }));
}

export function buildCsvString(rows: SessionCsvRow[]): string {
  const header = 'date,goal,action,duration_minutes,completed,note';
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const body = rows
    .map((r) =>
      [r.date, r.goal, r.action, r.duration_minutes, r.completed, r.note]
        .map(escape)
        .join(',')
    )
    .join('\n');
  return header + '\n' + body;
}

export function getAllActionsWithGoal(): ActionWithGoal[] {
  return db.getAllSync<ActionWithGoal>(
    `SELECT da.*, mg.name AS goal_name, mg.color AS goal_color, mg.icon AS goal_icon
     FROM daily_actions da
     LEFT JOIN meta_goals mg ON mg.id = da.goal_id
     WHERE mg.is_archived = 0
     ORDER BY mg.sort_order ASC, da.sort_order ASC`
  );
}
