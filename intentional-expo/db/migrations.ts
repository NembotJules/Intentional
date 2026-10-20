export interface MigrationDb {
  execSync(sql: string): void;
  getFirstSync<T>(sql: string, params: any[]): T | null;
  runSync(sql: string, params: any[]): void;
}

export interface Migration {
  version: number;
  up: string[];
}

export const SCHEMA_VERSION_KEY = 'db_schema_version';

/**
 * Migration list. Append new entries whenever the schema changes.
 * Each migration runs exactly once per install, in order.
 */
export const MIGRATIONS: Migration[] = [
  {
    // v1: baseline stamp. Existing installs with current tables should not
    // replay future migrations they effectively already have via initDb().
    version: 1,
    up: [],
  },
  {
    // v2: US-055 — objectives table (goals with deadlines)
    version: 2,
    up: [
      `CREATE TABLE IF NOT EXISTS objectives (
        id TEXT PRIMARY KEY,
        pillar_id TEXT NOT NULL,
        title TEXT NOT NULL,
        done_when TEXT NOT NULL DEFAULT '',
        deadline TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        metric_current REAL,
        metric_target REAL,
        metric_unit TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        closed_at TEXT,
        close_note TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_objectives_pillar ON objectives(pillar_id)`,
      `CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status)`,
    ],
  },
  {
    // v3: US-056 — tasks table (steps toward goals)
    version: 3,
    up: [
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        objective_id TEXT NOT NULL,
        title TEXT NOT NULL,
        estimate_minutes INTEGER NOT NULL DEFAULT 30,
        planned_date TEXT,
        is_done INTEGER NOT NULL DEFAULT 0,
        done_at TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_objective ON tasks(objective_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_planned_date ON tasks(planned_date)`,
    ],
  },
];

export const CURRENT_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export function getDbVersion(database: MigrationDb): number {
  try {
    const row = database.getFirstSync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [SCHEMA_VERSION_KEY],
    );
    const parsed = row ? parseInt(row.value, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setDbVersion(database: MigrationDb, version: number): void {
  database.runSync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [SCHEMA_VERSION_KEY, String(version)],
  );
}

export function runMigrationsOnDb(
  database: MigrationDb,
  migrations: Migration[] = MIGRATIONS,
): void {
  const currentVersion = getDbVersion(database);
  const targetVersion = migrations[migrations.length - 1]?.version ?? 0;

  if (currentVersion >= targetVersion) return;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) continue;

    for (const sql of migration.up) {
      database.execSync(sql);
    }
  }

  setDbVersion(database, targetVersion);
}
