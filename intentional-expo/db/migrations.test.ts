import { describe, expect, it } from 'vitest';
import { getDbVersion, runMigrationsOnDb, SCHEMA_VERSION_KEY, type Migration, type MigrationDb } from './migrations';

class FakeMigrationDb implements MigrationDb {
  version: string | null = null;
  executed: string[] = [];
  writes: Array<{ key: string; value: string }> = [];
  throwOnVersionRead = false;

  execSync(sql: string): void {
    this.executed.push(sql);
  }

  getFirstSync<T>(): T | null {
    if (this.throwOnVersionRead) throw new Error('settings table missing');
    return this.version === null ? null : ({ value: this.version } as T);
  }

  runSync(_sql: string, params: unknown[] = []): void {
    const [key, value] = params;
    this.writes.push({ key: String(key), value: String(value) });
    if (key === SCHEMA_VERSION_KEY) this.version = String(value);
  }
}

const migrations: Migration[] = [
  { version: 1, up: [] },
  { version: 2, up: ['ALTER TABLE meta_goals ADD COLUMN archived_at TEXT'] },
  { version: 3, up: ['CREATE INDEX idx_test ON focus_sessions(goal_id)'] },
];

describe('migration runner', () => {
  it('treats missing settings/version as version zero', () => {
    const database = new FakeMigrationDb();
    database.throwOnVersionRead = true;

    expect(getDbVersion(database)).toBe(0);
  });

  it('applies pending migrations in order and stamps the target version once', () => {
    const database = new FakeMigrationDb();
    database.version = '1';

    runMigrationsOnDb(database, migrations);

    expect(database.executed).toEqual([
      'ALTER TABLE meta_goals ADD COLUMN archived_at TEXT',
      'CREATE INDEX idx_test ON focus_sessions(goal_id)',
    ]);
    expect(database.writes).toEqual([{ key: SCHEMA_VERSION_KEY, value: '3' }]);
  });

  it('does nothing when the database is already current', () => {
    const database = new FakeMigrationDb();
    database.version = '3';

    runMigrationsOnDb(database, migrations);

    expect(database.executed).toEqual([]);
    expect(database.writes).toEqual([]);
  });
});
