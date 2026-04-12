/**
 * DB bootstrap — US-007: versioned migration runner.
 *
 * initDb()       — creates all tables from scratch (safe for both fresh installs
 *                  and re-runs thanks to IF NOT EXISTS).
 * runMigrations()— applies every pending migration in order and bumps db_version.
 *                  Fresh installs skip migrations by being stamped at CURRENT_VERSION
 *                  right after initDb. Existing installs (db_version = 0 or missing)
 *                  get all migrations ≥ their current version applied in order.
 */
import { openDatabaseSync } from 'expo-sqlite';

const db = openDatabaseSync('intentional.db');
db.execSync('PRAGMA foreign_keys = ON;');

// ─── Baseline schema ─────────────────────────────────────────────────────────
// All tables are created with IF NOT EXISTS so this function is idempotent.
// New *tables* can be added here freely. New *columns* on existing tables must
// go through a versioned migration below.
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
    CREATE TABLE IF NOT EXISTS weekly_reviews (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      went_well TEXT NOT NULL DEFAULT '',
      improve TEXT NOT NULL DEFAULT '',
      adjustments TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_week ON weekly_reviews(week_start);
  `);
}

// ─── Migration runner (US-007) ────────────────────────────────────────────────

const SCHEMA_VERSION_KEY = 'db_schema_version';

/**
 * Migration list — append new entries here whenever the schema changes.
 * Each migration runs exactly once per install, in order.
 *
 * Rules:
 *  - Never edit a migration that has already shipped — add a new one instead.
 *  - New tables go in initDb() above (IF NOT EXISTS handles both paths).
 *  - New *columns* on existing tables, index changes, data back-fills → here.
 */
const MIGRATIONS: { version: number; up: string[] }[] = [
  {
    // v1: baseline stamp — marks all existing installs as current so they
    // don't try to re-apply future migrations they already have via initDb.
    version: 1,
    up: [],
  },
  // ── Add migrations below this line ────────────────────────────────────────
  // Example future migration:
  // {
  //   version: 2,
  //   up: [
  //     'ALTER TABLE meta_goals ADD COLUMN tags TEXT NOT NULL DEFAULT ""',
  //   ],
  // },
];

const CURRENT_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

function getDbVersion(): number {
  try {
    const row = db.getFirstSync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [SCHEMA_VERSION_KEY],
    );
    return row ? parseInt(row.value, 10) : 0;
  } catch {
    return 0;
  }
}

function setDbVersion(v: number): void {
  db.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SCHEMA_VERSION_KEY, String(v)],
  );
}

/**
 * Call this once at app startup, *after* initDb().
 *
 * - Fresh install: initDb() already created all tables; stamp as CURRENT_VERSION.
 * - Existing install: apply any pending migrations in order, then update the stamp.
 */
export function runMigrations(): void {
  const currentVersion = getDbVersion();

  if (currentVersion >= CURRENT_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    // Each migration's SQL statements run in sequence.
    for (const sql of migration.up) {
      db.execSync(sql);
    }
  }

  // Stamp the final version in one write so a crash mid-run re-applies from
  // the last stamped version rather than skipping migrations.
  setDbVersion(CURRENT_VERSION);
}

// ─── Helpers re-exported for use in api.ts ────────────────────────────────────

export { db };

export function getSetting(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
