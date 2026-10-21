import { describe, expect, it } from 'vitest';
import { getDbVersion, runMigrationsOnDb, SCHEMA_VERSION_KEY, type Migration, type MigrationDb } from './migrations';

class FakeMigrationDb implements MigrationDb {
  version: string | null = null;
  executed: string[] = [];
  writes: Array<{ key: string; value: string }> = [];
  throwOnVersionRead = false;
  /** table → existing columns, answered through PRAGMA table_info */
  columns: Record<string, string[]> = {};
  /** a statement containing this text throws */
  failOn: string | null = null;

  execSync(sql: string): void {
    if (this.failOn && sql.includes(this.failOn)) throw new Error('boom: ' + sql);
    this.executed.push(sql);
  }

  getAllSync<T>(sql: string): T[] {
    const m = /PRAGMA table_info\((\w+)\)/.exec(sql);
    return (m ? (this.columns[m[1]!] ?? []).map((name) => ({ name })) : []) as T[];
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

  it('applies pending migrations in order, each in a transaction, stamping after each one', () => {
    const database = new FakeMigrationDb();
    database.version = '1';

    runMigrationsOnDb(database, migrations);

    expect(database.executed).toEqual([
      'BEGIN',
      'ALTER TABLE meta_goals ADD COLUMN archived_at TEXT',
      'COMMIT',
      'BEGIN',
      'CREATE INDEX idx_test ON focus_sessions(goal_id)',
      'COMMIT',
    ]);
    expect(database.writes).toEqual([
      { key: SCHEMA_VERSION_KEY, value: '2' },
      { key: SCHEMA_VERSION_KEY, value: '3' },
    ]);
  });

  it('skips ADD COLUMN when the column already exists (fresh installs get the newest schema from initDb)', () => {
    const database = new FakeMigrationDb();
    database.version = '1';
    database.columns = { meta_goals: ['id', 'name', 'archived_at'] };

    runMigrationsOnDb(database, migrations);

    expect(database.executed).not.toContain('ALTER TABLE meta_goals ADD COLUMN archived_at TEXT');
    expect(database.version).toBe('3');
  });

  it('rolls back a failing migration, keeps the last good version, and rethrows', () => {
    const database = new FakeMigrationDb();
    database.version = '1';
    database.failOn = 'CREATE INDEX idx_test';

    expect(() => runMigrationsOnDb(database, migrations)).toThrow(/boom/);
    expect(database.executed.slice(-1)).toEqual(['ROLLBACK']);
    expect(database.version).toBe('2');
  });

  it('does nothing when the database is already current', () => {
    const database = new FakeMigrationDb();
    database.version = '3';

    runMigrationsOnDb(database, migrations);

    expect(database.executed).toEqual([]);
    expect(database.writes).toEqual([]);
  });
});
