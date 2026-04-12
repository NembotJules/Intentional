import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('intentional.db');
db.execSync('PRAGMA foreign_keys = ON;');

export function initDb(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS meta_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      why_statement TEXT DEFAULT '',
      is_archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS daily_actions (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES meta_goals(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'session',
      target_minutes INTEGER NOT NULL DEFAULT 60,
      reminder_time TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER NOT NULL,
      note TEXT,
      was_completed INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS habit_completions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_action_date ON habit_completions(action_id, date);
    CREATE INDEX IF NOT EXISTS idx_actions_goal ON daily_actions(goal_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_dates ON focus_sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_habits_date ON habit_completions(date);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  `);
}

export { db };

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
