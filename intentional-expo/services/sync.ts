/**
 * US-089 · Backup & restore. The phone stays the source of truth; the account keeps a copy.
 *
 * Push: every local row is hashed and compared with the hash last uploaded (a ledger kept in settings, per account).
 * Changed rows are upserted (idempotent: same row, same result), rows gone from the phone are deleted from the copy.
 * This replaces the plan's write-site outbox: the same change set, computed from the data itself, so a new write
 * path can never be forgotten. `updated_at` is the upload time: the latest upload wins.
 *
 * Restore: pull every row of the account, replace the phone's tables with them (device-only settings stay), and
 * stamp the ledger so the next push uploads nothing.
 *
 * Pure-ish: takes the local DB and the Supabase client, so it runs against the web shim in tests.
 */
import type { Supa } from '@/services/supabase';

export interface LocalDb {
  getAllSync<T>(sql: string, params?: unknown[]): T[];
  runSync(sql: string, params?: unknown[]): unknown;
  execSync(sql: string): void;
}
type Row = Record<string, unknown>;

export type CloudTable = 'pillars' | 'objectives' | 'tasks' | 'habits' | 'sessions' | 'backup_rows';
export type LocalTable =
  | 'meta_goals'
  | 'objectives'
  | 'tasks'
  | 'daily_actions'
  | 'focus_sessions'
  | 'habit_completions'
  | 'habit_skips'
  | 'weekly_reviews'
  | 'milestones'
  | 'settings';

/** Settings that belong to this phone, not the person: never uploaded, never overwritten by a restore. */
export const DEVICE_SETTINGS = new Set([
  'db_schema_version',
  'fc_selection',
  'blocked_category_ids',
  'strict_autoblock_active',
  'strict_picker_offered',
  'last_notification_response',
  'sync_ledger',
  'sync_last_push',
]);
const DEVICE_PREFIXES = ['snooze:', 'sync_'];
export const isDeviceSetting = (key: string) => DEVICE_SETTINGS.has(key) || DEVICE_PREFIXES.some((p) => key.startsWith(p));

const bool = (v: unknown) => v === 1 || v === true || v === '1';
const int = (v: unknown, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.round(Number(v)) : d);
const num = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const ts = (v: unknown) => (typeof v === 'string' && v && !Number.isNaN(Date.parse(v)) ? v : null);

/** One local table: where it goes and how its typed columns are filled. */
interface Spec {
  local: LocalTable;
  cloud: CloudTable;
  idCol: string;
  typed?: (r: Row) => Row;
}

export const SPECS: Spec[] = [
  {
    local: 'meta_goals',
    cloud: 'pillars',
    idCol: 'id',
    typed: (r) => ({
      name: String(r.name ?? ''),
      color: String(r.color ?? ''),
      icon: String(r.icon ?? ''),
      category: text(r.category),
      sort_order: int(r.sort_order),
      is_archived: bool(r.is_archived),
    }),
  },
  {
    local: 'objectives',
    cloud: 'objectives',
    idCol: 'id',
    typed: (r) => ({
      pillar_id: String(r.pillar_id ?? ''),
      title: String(r.title ?? ''),
      done_when: String(r.done_when ?? ''),
      deadline: day(r.deadline),
      status: ['planned', 'active', 'completed', 'dropped'].includes(String(r.status)) ? String(r.status) : 'planned',
      metric_current: num(r.metric_current),
      metric_target: num(r.metric_target),
      metric_unit: text(r.metric_unit),
      created_at: ts(r.created_at),
      closed_at: ts(r.closed_at),
      close_note: text(r.close_note),
    }),
  },
  {
    local: 'tasks',
    cloud: 'tasks',
    idCol: 'id',
    typed: (r) => ({
      objective_id: String(r.objective_id ?? ''),
      title: String(r.title ?? ''),
      estimate_minutes: int(r.estimate_minutes),
      planned_date: day(r.planned_date),
      is_done: bool(r.is_done),
      done_at: ts(r.done_at),
      sort_order: int(r.sort_order),
      created_at: ts(r.created_at),
    }),
  },
  {
    local: 'daily_actions',
    cloud: 'habits',
    idCol: 'id',
    typed: (r) => ({
      pillar_id: String(r.goal_id ?? ''),
      objective_id: text(r.objective_id),
      name: String(r.name ?? ''),
      minutes: int(r.target_minutes),
      start_time: text(r.reminder_time),
      days_mask: int(r.days_mask, 127),
      strict: r.strict === undefined || r.strict === null ? true : bool(r.strict),
      is_active: bool(r.is_active),
    }),
  },
  {
    local: 'focus_sessions',
    cloud: 'sessions',
    idCol: 'id',
    typed: (r) => ({
      pillar_id: String(r.goal_id ?? ''),
      objective_id: text(r.objective_id),
      task_id: text(r.task_id),
      habit_id: text(r.action_id),
      started_at: ts(r.started_at) ?? new Date(0).toISOString(),
      // The typed column is capped (a session can't run 16 h); `local` keeps the exact value.
      duration_seconds: Math.max(0, Math.min(57600, int(r.duration_seconds))),
      was_completed: bool(r.was_completed),
    }),
  },
  { local: 'habit_completions', cloud: 'backup_rows', idCol: 'id' },
  { local: 'habit_skips', cloud: 'backup_rows', idCol: 'id' },
  { local: 'weekly_reviews', cloud: 'backup_rows', idCol: 'id' },
  { local: 'milestones', cloud: 'backup_rows', idCol: 'id' },
  { local: 'settings', cloud: 'backup_rows', idCol: 'key' },
];

/** The cloud row for a local row: owner, id, typed columns, the whole local row. */
export function toCloud(spec: Spec, userId: string, row: Row, now: string): Row {
  const id = String(row[spec.idCol]);
  const base: Row = { user_id: userId, id, local: row, updated_at: now };
  if (spec.cloud === 'backup_rows') return { ...base, tbl: spec.local };
  return { ...base, ...spec.typed!(row) };
}

/** Back from the cloud: exactly the row the phone uploaded. */
export function fromCloud(cloudRow: Row): Row {
  return (cloudRow.local ?? {}) as Row;
}

/** Stable JSON (sorted keys) → a 53-bit hash, as hex. Same row, same hash, on every platform. */
export function stableJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  const o = v as Row;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
    .join(',')}}`;
}
export function hashRow(row: Row): string {
  const s = stableJson(row);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

const ledgerKey = (spec: Spec, id: string) => `${spec.local}|${id}`;

/** The ledger: hash of every row last uploaded, for one account. Another account starts empty. */
export interface Ledger {
  userId: string;
  hashes: Record<string, string>;
}

export function readLocal(db: LocalDb, spec: Spec): Row[] {
  const rows = db.getAllSync<Row>(`SELECT * FROM ${spec.local}`);
  return spec.local === 'settings' ? rows.filter((r) => !isDeviceSetting(String(r.key))) : rows;
}

export interface ChangeSet {
  upserts: { spec: Spec; rows: Row[] }[];
  deletes: { spec: Spec; ids: string[] }[];
  nextHashes: Record<string, string>;
  count: { upserts: number; deletes: number };
}

/** What a push must send: rows whose hash changed, and rows the phone no longer has. */
export function changeSet(db: LocalDb, ledger: Ledger | null, userId: string): ChangeSet {
  const prev = ledger && ledger.userId === userId ? ledger.hashes : {};
  const nextHashes: Record<string, string> = {};
  const upserts: ChangeSet['upserts'] = [];
  const deletes: ChangeSet['deletes'] = [];
  for (const spec of SPECS) {
    const rows = readLocal(db, spec);
    const changed: Row[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      const id = String(r[spec.idCol]);
      const k = ledgerKey(spec, id);
      const h = hashRow(r);
      seen.add(k);
      nextHashes[k] = h;
      if (prev[k] !== h) changed.push(r);
    }
    const gone = Object.keys(prev)
      .filter((k) => k.startsWith(`${spec.local}|`) && !seen.has(k))
      .map((k) => k.slice(spec.local.length + 1));
    if (changed.length) upserts.push({ spec, rows: changed });
    if (gone.length) deletes.push({ spec, ids: gone });
  }
  return {
    upserts,
    deletes,
    nextHashes,
    count: { upserts: upserts.reduce((n, u) => n + u.rows.length, 0), deletes: deletes.reduce((n, d) => n + d.ids.length, 0) },
  };
}

const CHUNK = 400;
function chunks<T>(xs: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/**
 * Upload the change set. The ledger only records what the server accepted, so a failure half-way is retried next time.
 * Returns the new ledger and the counts.
 */
export async function push(
  client: Supa,
  db: LocalDb,
  ledger: Ledger | null,
  userId: string,
  now: () => string = () => new Date().toISOString()
): Promise<{ ledger: Ledger; upserted: number; deleted: number }> {
  const cs = changeSet(db, ledger, userId);
  const kept = ledger && ledger.userId === userId ? { ...ledger.hashes } : {};
  let upserted = 0;
  let deleted = 0;
  const stamp = now();
  for (const { spec, rows } of cs.upserts) {
    for (const part of chunks(rows)) {
      const payload = part.map((r) => toCloud(spec, userId, r, stamp));
      const onConflict = spec.cloud === 'backup_rows' ? 'user_id,tbl,id' : 'user_id,id';
      const { error } = await client.from(spec.cloud as never).upsert(payload as never, { onConflict });
      if (error) throw new Error(`backup ${spec.local}: ${error.message}`);
      for (const r of part) {
        const k = ledgerKey(spec, String(r[spec.idCol]));
        kept[k] = cs.nextHashes[k]!;
      }
      upserted += part.length;
    }
  }
  for (const { spec, ids } of cs.deletes) {
    for (const part of chunks(ids)) {
      let q = client.from(spec.cloud as never).delete().eq('user_id', userId);
      if (spec.cloud === 'backup_rows') q = q.eq('tbl', spec.local);
      const { error } = await q.in('id', part);
      if (error) throw new Error(`backup delete ${spec.local}: ${error.message}`);
      for (const id of part) delete kept[ledgerKey(spec, id)];
      deleted += part.length;
    }
  }
  return { ledger: { userId, hashes: kept }, upserted, deleted };
}

/** Every cloud row of the account, per local table (paged). */
export async function pullAll(client: Supa, userId: string): Promise<Record<LocalTable, Row[]>> {
  const out = Object.fromEntries(SPECS.map((s) => [s.local, [] as Row[]])) as Record<LocalTable, Row[]>;
  const page = 1000;
  for (const cloud of ['pillars', 'objectives', 'tasks', 'habits', 'sessions', 'backup_rows'] as const) {
    for (let from = 0; ; from += page) {
      const { data, error } = await client
        .from(cloud as never)
        .select(cloud === 'backup_rows' ? 'tbl, id, local' : 'id, local')
        .eq('user_id', userId)
        .order('id')
        .range(from, from + page - 1);
      if (error) throw new Error(`restore ${cloud}: ${error.message}`);
      const rows = (data ?? []) as Row[];
      for (const r of rows) {
        const spec = cloud === 'backup_rows' ? SPECS.find((s) => s.local === r.tbl) : SPECS.find((s) => s.cloud === cloud);
        if (spec) out[spec.local].push(fromCloud(r));
      }
      if (rows.length < page) break;
    }
  }
  return out;
}

/** How much the account holds (for "Restore my data?"), and when it was last backed up. */
export async function backupInfo(client: Supa, userId: string): Promise<{ pillars: number; sessions: number; lastBackup: string | null }> {
  const count = async (t: 'pillars' | 'sessions') => {
    const { count: c, error } = await client.from(t as never).select('id', { count: 'exact', head: true }).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return c ?? 0;
  };
  const [pillars, sessions] = await Promise.all([count('pillars'), count('sessions')]);
  let lastBackup: string | null = null;
  for (const t of ['pillars', 'sessions', 'backup_rows'] as const) {
    const { data } = await client.from(t as never).select('updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
    const v = (data as { updated_at: string }[] | null)?.[0]?.updated_at ?? null;
    if (v && (!lastBackup || v > lastBackup)) lastBackup = v;
  }
  return { pillars, sessions, lastBackup };
}

/** Columns the phone's table has (native SQLite); null on the web shim, which takes any column. */
function localColumns(db: LocalDb, table: string): Set<string> | null {
  try {
    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
    return cols?.length ? new Set(cols.map((c) => c.name)) : null;
  } catch {
    return null;
  }
}

/**
 * Replace the phone's data with the account's copy. Device-only settings stay. Native runs it in one transaction.
 * `setSetting` writes settings (on web it also keeps the fast-path map in sync). Returns the ledger of what's now local.
 */
export function applyRestore(
  db: LocalDb,
  data: Record<LocalTable, Row[]>,
  userId: string,
  setSetting: (k: string, v: string) => void,
  opts: { transaction: boolean }
): { ledger: Ledger; restored: number } {
  let restored = 0;
  const hashes: Record<string, string> = {};
  if (opts.transaction) db.execSync('BEGIN');
  try {
    for (const spec of SPECS) {
      const rows = data[spec.local] ?? [];
      if (spec.local === 'settings') {
        const local = db.getAllSync<{ key: string }>('SELECT key FROM settings');
        for (const { key } of local) if (!isDeviceSetting(key)) db.runSync('DELETE FROM settings WHERE key = ?', [key]);
        for (const r of rows) {
          const key = String(r.key);
          if (isDeviceSetting(key)) continue;
          setSetting(key, String(r.value ?? ''));
          hashes[ledgerKey(spec, key)] = hashRow({ key, value: String(r.value ?? '') });
          restored += 1;
        }
        continue;
      }
      db.execSync(`DELETE FROM ${spec.local}`);
      const cols = localColumns(db, spec.local);
      for (const r of rows) {
        const keys = Object.keys(r).filter((k) => r[k] !== undefined && (!cols || cols.has(k)));
        if (!keys.length) continue;
        db.runSync(
          `INSERT OR REPLACE INTO ${spec.local} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => r[k])
        );
        hashes[ledgerKey(spec, String(r[spec.idCol]))] = hashRow(r);
        restored += 1;
      }
    }
    if (opts.transaction) db.execSync('COMMIT');
  } catch (e) {
    if (opts.transaction) db.execSync('ROLLBACK');
    throw e;
  }
  return { ledger: { userId, hashes }, restored };
}
