import { db, getSetting as getSettingRaw, setSetting } from './index';

/** Re-export so screens can call api.getSetting without a separate db import */
export const getSetting = getSettingRaw;
import type { MetaGoal, DailyAction, FocusSession, HabitCompletion, ActionType, SessionHistoryListItem, WeeklyReview } from '@/types';

const uuid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
type NewGoalInput = Omit<MetaGoal, 'id' | 'is_archived'> & { is_archived?: number };

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
    'UPDATE daily_actions SET name = ?, type = ?, target_minutes = ?, is_active = ?, reminder_time = ? WHERE id = ?',
    [
      a.name ?? current.name,
      a.type ?? current.type,
      a.target_minutes ?? current.target_minutes,
      a.is_active ?? current.is_active,
      'reminder_time' in a ? (a.reminder_time ?? null) : current.reminder_time,
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
    [actionId, t + 'T00:00:00.000Z'],
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
    DELETE FROM meta_goals;
    DELETE FROM weekly_reviews;
    DELETE FROM settings;
  `);
}

// ─── US-036/037: Weekly Reviews ──────────────────────────────────────────────

/** ISO date string (YYYY-MM-DD) for the Monday of the current week (UTC). */
export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export function saveWeeklyReview(review: Omit<WeeklyReview, 'id' | 'created_at'>): WeeklyReview {
  const id = uuid();
  const created_at = new Date().toISOString();
  db.runSync(
    `INSERT INTO weekly_reviews (id, week_start, went_well, improve, adjustments, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       went_well = excluded.went_well,
       improve = excluded.improve,
       adjustments = excluded.adjustments,
       created_at = excluded.created_at`,
    [id, review.week_start, review.went_well, review.improve, review.adjustments, created_at]
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
    action_name: string;
    goal_name: string;
  }>(
    `SELECT fs.started_at, fs.duration_seconds, fs.was_completed, fs.note,
       COALESCE(da.name, 'Deleted action') AS action_name,
       COALESCE(mg.name, 'Unknown goal')   AS goal_name
     FROM focus_sessions fs
     LEFT JOIN daily_actions da ON da.id = fs.action_id
     LEFT JOIN meta_goals mg ON mg.id = fs.goal_id
     ORDER BY fs.started_at DESC`
  );
  return rows.map((r) => ({
    date: r.started_at.slice(0, 10),
    goal: r.goal_name,
    action: r.action_name,
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
