/**
 * Web DB: a lightweight in-memory SQL engine backed by localStorage.
 * Mirrors the expo-sqlite synchronous API so all of api.ts works unchanged
 * on web.  Data is serialised after every mutation and restored on init,
 * making the browser version actually testable across refreshes.
 *
 * Supports:
 *   SELECT * / aggregate  FROM table [WHERE …] [ORDER BY …]
 *   INSERT INTO / INSERT OR REPLACE INTO / INSERT … ON CONFLICT … DO UPDATE
 *   UPDATE table SET … WHERE …
 *   DELETE FROM table [WHERE …]
 *   execSync  — CREATE TABLE / DELETE FROM (no WHERE) / multi-statement
 *
 * JOIN queries (getAllActionsWithGoal, session history, CSV export) are
 * handled with dedicated in-memory join helpers.
 */

type Row = Record<string, unknown>;
type WhereCondition = { col: string; op: string; isLiteral: boolean; literalVal?: unknown };
type SetClause      = { col: string; isLiteral: boolean; literalVal?: unknown };

const STORAGE_KEY = 'intentional_db_v2';
const SETTINGS_KEY = 'intentional_settings_v1';

// ─── MicroSQLite ─────────────────────────────────────────────────────────────

class MicroSQLite {
  private tables: Map<string, Row[]>;

  constructor() {
    this.tables = new Map([
      ['meta_goals',       []],
      ['daily_actions',    []],
      ['focus_sessions',   []],
      ['habit_completions',[]],
      ['weekly_reviews',   []],
      ['settings',         []],
    ]);
    this.load();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private load(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Record<string, Row[]>;
      for (const [name, rows] of Object.entries(data)) {
        this.tables.set(name, rows);
      }
    } catch { /* ignore parse errors — start fresh */ }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      const data: Record<string, Row[]> = {};
      for (const [name, rows] of this.tables) data[name] = rows;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* quota exceeded — silently skip */ }
  }

  // ── Public API (mirrors expo-sqlite sync API) ───────────────────────────────

  execSync(sql: string): void {
    // Multi-statement blocks separated by ;
    for (const stmt of sql.split(';').map(s => s.trim()).filter(Boolean)) {
      this.execOne(stmt);
    }
    this.persist();
  }

  runSync(sql: string, params: unknown[] = []): void {
    const t = sql.trimStart();
    if (/^INSERT/i.test(t))  this.insert(t, params);
    else if (/^UPDATE/i.test(t)) this.update(t, params);
    else if (/^DELETE/i.test(t)) this.delete(t, params);
    this.persist();
  }

  getAllSync<T>(sql: string, params: unknown[] = []): T[] {
    return this.select(sql, params) as T[];
  }

  getFirstSync<T>(sql: string, params: unknown[] = []): T | null {
    return (this.select(sql, params)[0] as T) ?? null;
  }

  // ── execSync helpers ───────────────────────────────────────────────────────

  private execOne(sql: string): void {
    if (/^create\s+(?:unique\s+)?index/i.test(sql)) return;   // ignore index DDL
    if (/^pragma/i.test(sql)) return;                          // ignore PRAGMA
    if (/^create\s+table/i.test(sql)) {
      const m = /create\s+table\s+(?:if\s+not\s+exists\s+)?(\w+)/i.exec(sql);
      if (m && !this.tables.has(m[1]!)) this.tables.set(m[1]!, []);
      return;
    }
    // DELETE without WHERE → clear table
    if (/^delete\s+from\s+(\w+)\s*$/i.test(sql)) {
      const m = /^delete\s+from\s+(\w+)/i.exec(sql);
      if (m) this.tables.set(m[1]!, []);
      return;
    }
  }

  // ── INSERT ─────────────────────────────────────────────────────────────────

  private insert(sql: string, params: unknown[]): void {
    const isUpsert  = /ON\s+CONFLICT/i.test(sql);
    const isReplace = /INSERT\s+OR\s+REPLACE/i.test(sql);

    const tableM = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i.exec(sql);
    if (!tableM) return;
    const tableName = tableM[1]!;

    const colM = /\(([^)]+)\)\s*VALUES/i.exec(sql);
    if (!colM) return;
    const cols = colM[1]!.split(',').map(c => c.trim());

    const valStart = sql.indexOf('VALUES') + 6;
    const valParenM = /\(([^)]+)\)/.exec(sql.slice(valStart));
    if (!valParenM) return;
    const valTokens = this.splitTokens(valParenM[1]!);

    let pi = 0;
    const row: Row = {};
    for (let i = 0; i < cols.length; i++) {
      const token = (valTokens[i] ?? '?').trim();
      row[cols[i]!] = token === '?'                    ? (params[pi++] ?? null)
                    : token === 'NULL' || token === 'null' ? null
                    : !isNaN(Number(token))             ? Number(token)
                    :                                     token.replace(/^'|'$/g, '');
    }

    const table = this.tables.get(tableName) ?? [];
    const pkCol = tableName === 'settings' ? 'key' : 'id';
    const existIdx = table.findIndex(r => r[pkCol] === row[pkCol]);

    if (existIdx >= 0 && isReplace) {
      table[existIdx] = row;
    } else if (existIdx >= 0 && isUpsert) {
      // Apply the DO UPDATE SET clause
      const doM = /DO\s+UPDATE\s+SET\s+(.+)$/is.exec(sql);
      if (doM) {
        for (const sc of this.parseSet(doM[1]!)) {
          table[existIdx]![sc.col] = sc.isLiteral ? sc.literalVal : row[sc.col] ?? null;
        }
      } else {
        table[existIdx] = { ...table[existIdx], ...row };
      }
    } else if (existIdx < 0) {
      table.push(row);
    }

    this.tables.set(tableName, table);
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────

  private update(sql: string, params: unknown[]): void {
    const tableM = /UPDATE\s+(\w+)\s+SET/i.exec(sql);
    if (!tableM) return;
    const tableName = tableM[1]!;

    const whereIdx = sql.search(/\s+WHERE\s+/i);
    if (whereIdx < 0) return;

    const setStart = sql.search(/\s+SET\s+/i) + 5;
    const setPart   = sql.slice(setStart, whereIdx).trim();
    const wherePart = sql.slice(whereIdx).replace(/^\s+WHERE\s+/i, '').trim();

    const setCols = this.parseSet(setPart);
    const whereConds = this.parseWhere(wherePart);

    let pi = 0;
    const setMap: Row = {};
    for (const sc of setCols) {
      setMap[sc.col] = sc.isLiteral ? sc.literalVal : (params[pi++] ?? null);
    }
    const whereVals: unknown[] = [];
    for (const wc of whereConds) {
      if (!wc.isLiteral) whereVals.push(params[pi++] ?? null);
    }

    const table = this.tables.get(tableName) ?? [];
    for (const row of table) {
      if (this.matches(row, whereConds, whereVals)) Object.assign(row, setMap);
    }
    this.tables.set(tableName, table);
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────

  private delete(sql: string, params: unknown[]): void {
    const tableM = /DELETE\s+FROM\s+(\w+)/i.exec(sql);
    if (!tableM) return;
    const tableName = tableM[1]!;

    const whereM = /WHERE\s+(.+)$/i.exec(sql);
    if (!whereM) { this.tables.set(tableName, []); return; }

    const conds = this.parseWhere(whereM[1]!.trim());
    let pi = 0;
    const vals: unknown[] = [];
    for (const c of conds) { if (!c.isLiteral) vals.push(params[pi++] ?? null); }

    const table = this.tables.get(tableName) ?? [];
    this.tables.set(tableName, table.filter(r => !this.matches(r, conds, vals)));
  }

  // ── SELECT ─────────────────────────────────────────────────────────────────

  private select(sql: string, params: unknown[]): Row[] {
    if (/\bJOIN\b/i.test(sql)) return this.joinSelect(sql, params);

    const fromM = /FROM\s+(\w+)/i.exec(sql);
    if (!fromM) return [];
    const table = this.tables.get(fromM[1]!) ?? [];

    const isAgg = /\b(SUM|MAX|MIN|COUNT|AVG)\s*\(/i.test(sql);

    // WHERE  (stop before ORDER BY)
    const whereM = /WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s*;?\s*$)/i.exec(sql);
    const conds   = whereM ? this.parseWhere(whereM[1]!) : [];
    let pi = 0;
    const vals: unknown[] = [];
    for (const c of conds) { if (!c.isLiteral) vals.push(params[pi++] ?? null); }

    let rows = table.filter(r => this.matches(r, conds, vals));
    if (isAgg) return [this.aggregate(sql, rows)];

    // ORDER BY
    const orderM = /ORDER\s+BY\s+([\w.]+)\s*(ASC|DESC)?/i.exec(sql);
    if (orderM) {
      const col = orderM[1]!.includes('.') ? orderM[1]!.split('.')[1]! : orderM[1]!;
      const asc = !orderM[2] || orderM[2].toUpperCase() === 'ASC';
      rows = [...rows].sort((a, b) => {
        const av = String(a[col] ?? ''), bv = String(b[col] ?? '');
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return rows;
  }

  // ── JOIN helpers ───────────────────────────────────────────────────────────

  private joinSelect(sql: string, params: unknown[]): Row[] {
    const actions = this.tables.get('daily_actions') ?? [];
    const goals   = this.tables.get('meta_goals')    ?? [];
    const sessions= this.tables.get('focus_sessions') ?? [];

    const goalById  = new Map(goals.map(g   => [g.id   as string, g]));
    const actionById= new Map(actions.map(a => [a.id   as string, a]));

    // ── daily_actions ⟕ meta_goals  (getAllActionsWithGoal) ──────────────────
    if (/FROM\s+daily_actions/i.test(sql)) {
      const rows = actions
        .filter(a => {
          const g = goalById.get(a.goal_id as string);
          return g && g.is_archived === 0;
        })
        .map(a => {
          const g = goalById.get(a.goal_id as string) ?? {};
          return { ...a, goal_name: (g as Row).name ?? '', goal_color: (g as Row).color ?? '', goal_icon: (g as Row).icon ?? '' };
        });
      return rows.sort((a, b) => {
        const ag = goalById.get(a.goal_id as string), bg = goalById.get(b.goal_id as string);
        const gs = ((ag?.sort_order ?? 0) as number) - ((bg?.sort_order ?? 0) as number);
        return gs !== 0 ? gs : ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0);
      });
    }

    // ── focus_sessions ⟕ daily_actions ⟕ meta_goals  (history / CSV) ────────
    if (/FROM\s+focus_sessions/i.test(sql)) {
      // Apply WHERE on sessions (strip table-alias prefixes)
      const whereM = /WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s*;?\s*$)/i.exec(sql);
      let filtered = sessions;
      if (whereM) {
        const cleanWhere = whereM[1]!.replace(/\b(?:fs|da|mg)\./g, '');
        const conds = this.parseWhere(cleanWhere);
        let pi = 0;
        const vals: unknown[] = [];
        for (const c of conds) { if (!c.isLiteral) vals.push(params[pi++] ?? null); }
        filtered = sessions.filter(r => this.matches(r, conds, vals));
      }
      const joined = filtered.map(s => ({
        ...s,
        action_name: (actionById.get(s.action_id as string)?.name as string) ?? 'Deleted action',
        goal_name:   (goalById.get(s.goal_id as string)?.name   as string) ?? 'Unknown goal',
      }));
      return joined.sort((a, b) =>
        String(b.started_at ?? '').localeCompare(String(a.started_at ?? ''))
      );
    }

    return [];
  }

  // ── Aggregate computation ──────────────────────────────────────────────────

  private aggregate(sql: string, rows: Row[]): Row {
    const r: Row = {};

    const coalesceM = /COALESCE\s*\(\s*SUM\s*\(\s*(\w+)\s*\)\s*,\s*(\d+)\s*\)\s+(?:as\s+)?(\w+)/i.exec(sql);
    if (coalesceM) {
      r[coalesceM[3]!] = rows.reduce((s, row) => s + (Number(row[coalesceM[1]!]) || 0), 0)
                         || Number(coalesceM[2]);
    }
    if (!coalesceM) {
      const sumM = /\bSUM\s*\(\s*(\w+)\s*\)\s+(?:as\s+)?(\w+)/i.exec(sql);
      if (sumM) r[sumM[2]!] = rows.reduce((s, row) => s + (Number(row[sumM[1]!]) || 0), 0);
    }
    const maxM = /\bMAX\s*\(\s*(\w+)\s*\)\s+(?:as\s+)?(\w+)/i.exec(sql);
    if (maxM) {
      const vs = rows.map(row => row[maxM[1]!]).filter(v => v != null);
      r[maxM[2]!] = vs.length ? vs.reduce((m, v) => (String(v) > String(m) ? v : m)) : null;
    }
    const minM = /\bMIN\s*\(\s*(\w+)\s*\)\s+(?:as\s+)?(\w+)/i.exec(sql);
    if (minM) {
      const vs = rows.map(row => row[minM[1]!]).filter(v => v != null);
      r[minM[2]!] = vs.length ? vs.reduce((m, v) => (String(v) < String(m) ? v : m)) : null;
    }
    const cntM = /\bCOUNT\s*\(\s*\*\s*\)\s+(?:as\s+)?(\w+)/i.exec(sql);
    if (cntM) r[cntM[1]!] = rows.length;

    return r;
  }

  // ── SQL parsing helpers ────────────────────────────────────────────────────

  private splitTokens(valStr: string): string[] {
    const tokens: string[] = [];
    let cur = '', depth = 0, inStr = false;
    for (const ch of valStr) {
      if (ch === "'" && !inStr) { inStr = true;  cur += ch; continue; }
      if (ch === "'" &&  inStr) { inStr = false; cur += ch; continue; }
      if (!inStr && ch === '(') { depth++; cur += ch; continue; }
      if (!inStr && ch === ')') { depth--; cur += ch; continue; }
      if (!inStr && ch === ',' && depth === 0) { tokens.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) tokens.push(cur.trim());
    return tokens;
  }

  private parseSet(setPart: string): SetClause[] {
    return setPart.split(',').map(s => {
      const eqIdx = s.indexOf('=');
      const col = s.slice(0, eqIdx).trim();
      const val = s.slice(eqIdx + 1).trim();
      if (val === '?') return { col, isLiteral: false };
      if (/^excluded\./i.test(val)) return { col, isLiteral: false }; // upsert ref
      if (val === 'NULL' || val === 'null') return { col, isLiteral: true, literalVal: null };
      const n = Number(val);
      if (!isNaN(n)) return { col, isLiteral: true, literalVal: n };
      return { col, isLiteral: true, literalVal: val.replace(/^'|'$/g, '') };
    });
  }

  private parseWhere(wherePart: string): WhereCondition[] {
    return wherePart.split(/\s+AND\s+/i).flatMap(part => {
      const m = /(\w+(?:\.\w+)?)\s*(>=|<=|!=|<>|>|<|=)\s*(.+)/.exec(part.trim());
      if (!m) return [];
      const raw = m[1]!;
      const col = raw.includes('.') ? raw.split('.')[1]! : raw;
      const op  = m[2]!;
      const val = m[3]!.trim();
      if (val === '?') return [{ col, op, isLiteral: false }];
      if (val === 'NULL' || val === 'null') return [{ col, op, isLiteral: true, literalVal: null }];
      const n = Number(val);
      if (!isNaN(n)) return [{ col, op, isLiteral: true, literalVal: n }];
      return [{ col, op, isLiteral: true, literalVal: val.replace(/^'|'$/g, '') }];
    });
  }

  private matches(row: Row, conds: WhereCondition[], vals: unknown[]): boolean {
    let vi = 0;
    for (const c of conds) {
      const rv = String(row[c.col] ?? '');
      const cv = String(c.isLiteral ? (c.literalVal ?? '') : (vals[vi++] ?? ''));
      const ok = c.op === '='  ? rv === cv
               : c.op === '!=' || c.op === '<>' ? rv !== cv
               : c.op === '>'  ? rv >  cv
               : c.op === '>=' ? rv >= cv
               : c.op === '<'  ? rv <  cv
               : c.op === '<=' ? rv <= cv
               : true;
      if (!ok) return false;
    }
    return true;
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────

const db = new MicroSQLite();

// ─── Public exports ───────────────────────────────────────────────────────────

export { db };

export function initDb(): void {
  // Tables are pre-created in the constructor; nothing else needed on web.
}

/** No-op on web — migration versioning only applies to native SQLite. */
export function runMigrations(): void {}

export function getSetting(key: string): string | null {
  // Settings are stored in the 'settings' table (same as native).
  // Fast path: also mirror in localStorage for quick reads.
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const map = JSON.parse(raw) as Record<string, string>;
        if (key in map) return map[key] ?? null;
      }
    } catch { /* ignore */ }
  }
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  // Mirror in the fast-path localStorage map.
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const map: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      map[key] = value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }
}
