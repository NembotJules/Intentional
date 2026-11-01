import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localDayKey, shiftDayKey } from '@/utils/dates';

vi.mock('@/db/index', async () => import('@/db/index.web'));
vi.mock('@/db', async () => import('@/db/index.web'));
vi.mock('../db/index', async () => import('../db/index.web'));

const api = await import('@/db/api');
const { db, setSetting, getSetting } = await import('@/db/index.web');
const sync = await import('./sync');
type Row = Record<string, unknown>;

/** In-memory Supabase: just the calls sync.ts makes. `fail` makes the n-th upsert fail. */
function fakeCloud(opts: { failUpsertOn?: number } = {}) {
  const store: Record<string, Row[]> = {};
  let upserts = 0;
  const keyOf = (t: string, r: Row) => (t === 'backup_rows' ? `${r.user_id}|${r.tbl}|${r.id}` : `${r.user_id}|${r.id}`);
  const from = (t: string) => {
    const rows = (store[t] ??= []);
    const filters: [string, unknown][] = [];
    let inFilter: [string, unknown[]] | null = null;
    let mode: 'select' | 'delete' = 'select';
    let head = false;
    let range: [number, number] | null = null;
    const match = (r: Row) => filters.every(([c, v]) => r[c] === v) && (!inFilter || inFilter[1].includes(r[inFilter[0]]));
    const run = () => {
      if (mode === 'delete') {
        for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i]!)) rows.splice(i, 1);
        return { error: null };
      }
      let out = rows.filter(match).sort((a, b) => String(a.id).localeCompare(String(b.id)));
      if (head) return { count: out.length, error: null, data: null };
      if (range) out = out.slice(range[0], range[1] + 1);
      return { data: out.map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      upsert: async (payload: Row[]) => {
        upserts += 1;
        if (opts.failUpsertOn === upserts) return { error: { message: 'network down' } };
        for (const p of payload) {
          const i = rows.findIndex((r) => keyOf(t, r) === keyOf(t, p));
          if (i >= 0) rows[i] = { ...p };
          else rows.push({ ...p });
        }
        return { error: null };
      },
      delete: () => ((mode = 'delete'), q),
      select: (_c: string, o?: { head?: boolean }) => ((head = !!o?.head), q),
      eq: (c: string, v: unknown) => (filters.push([c, v]), q),
      in: (c: string, v: unknown[]) => ((inFilter = [c, v]), Promise.resolve(run())),
      order: () => q,
      limit: () => Promise.resolve(run()),
      range: (a: number, b: number) => ((range = [a, b]), Promise.resolve(run())),
      then: (res: (v: unknown) => void) => res(run()),
    };
    return q;
  };
  return { client: { from } as never, store, upsertCalls: () => upserts };
}

const U = 'user-a';
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
async function seed() {
  const body = await api.addGoal({ name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: 'Strong at 80.' });
  const o = await api.addObjective({ pillar_id: body.id, title: 'Half marathon', done_when: 'Finish', deadline: shiftDayKey(localDayKey(), 60), status: 'active', sort_order: 0, metric_current: null, metric_target: null, metric_unit: null });
  const t = await api.addTask({ objective_id: o.id, title: 'Buy shoes' });
  await api.setTaskDone(t.id, true);
  const h = await api.addAction({ goal_id: body.id, name: 'Run', type: 'session', target_minutes: 30, reminder_time: '07:00', is_active: 1, sort_order: 0, objective_id: o.id, days_mask: 21 });
  await api.saveFocusSession({ action_id: h.id, goal_id: body.id, started_at: ago(30), ended_at: ago(29.5), duration_seconds: 1800, note: 'Felt good', was_completed: 1, task_id: null, objective_id: null });
  setSetting('user_name', 'Jules');
  setSetting('fc_selection', 'device-token'); // device-only
  return { body, o, t, h };
}
const snapshot = () =>
  Object.fromEntries(
    sync.SPECS.map((s) => [s.local, sync.readLocal(db as never, s).sort((a, b) => String(a[s.idCol]).localeCompare(String(b[s.idCol])))])
  );

beforeEach(() => api.deleteAllData());

describe('mapping local ↔ cloud (US-089)', () => {
  it('a habit: typed columns from the local names; the whole local row kept', () => {
    const spec = sync.SPECS.find((s) => s.local === 'daily_actions')!;
    const local = { id: 'h1', goal_id: 'p1', name: 'Run', type: 'session', target_minutes: 30, reminder_time: '07:00', is_active: 1, sort_order: 0, objective_id: 'o1', days_mask: 21, strict: 0 };
    const c = sync.toCloud(spec, U, local, 'NOW');
    expect(c).toMatchObject({ user_id: U, id: 'h1', pillar_id: 'p1', minutes: 30, start_time: '07:00', days_mask: 21, strict: false, is_active: true, updated_at: 'NOW' });
    expect(sync.fromCloud(c)).toEqual(local);
  });
  it('a session longer than 16 h is capped in the typed column only', () => {
    const spec = sync.SPECS.find((s) => s.local === 'focus_sessions')!;
    const c = sync.toCloud(spec, U, { id: 's', goal_id: 'p', started_at: ago(1), duration_seconds: 99999, was_completed: 1 }, 'NOW');
    expect(c.duration_seconds).toBe(57600);
    expect((c.local as Row).duration_seconds).toBe(99999);
  });
  it('bad dates become null in typed columns (never a failed upload)', () => {
    const spec = sync.SPECS.find((s) => s.local === 'tasks')!;
    const c = sync.toCloud(spec, U, { id: 't', objective_id: 'o', title: 'x', planned_date: '', done_at: 'garbage', created_at: ago(1) }, 'NOW');
    expect(c.planned_date).toBeNull();
    expect(c.done_at).toBeNull();
  });
  it('other tables go to backup_rows with their table name; settings keyed by key', () => {
    const spec = sync.SPECS.find((s) => s.local === 'settings')!;
    expect(sync.toCloud(spec, U, { key: 'user_name', value: 'Jules' }, 'NOW')).toEqual({ user_id: U, id: 'user_name', tbl: 'settings', local: { key: 'user_name', value: 'Jules' }, updated_at: 'NOW' });
  });
  it('device-only settings are never part of a backup', () => {
    expect(sync.isDeviceSetting('fc_selection')).toBe(true);
    expect(sync.isDeviceSetting('snooze:a1:2026-11-01')).toBe(true);
    expect(sync.isDeviceSetting('db_schema_version')).toBe(true);
    expect(sync.isDeviceSetting('user_name')).toBe(false);
  });
  it('hash: key order does not matter; any value change does', () => {
    expect(sync.hashRow({ a: 1, b: 'x' })).toBe(sync.hashRow({ b: 'x', a: 1 }));
    expect(sync.hashRow({ a: 1, b: 'x' })).not.toBe(sync.hashRow({ a: 1, b: 'y' }));
    expect(sync.hashRow({ a: 1 })).not.toBe(sync.hashRow({ a: '1' }));
  });
});

describe('push and restore (US-089)', () => {
  it('first push uploads everything except device settings; a second push uploads nothing (idempotent)', async () => {
    await seed();
    const cloud = fakeCloud();
    const first = await sync.push(cloud.client, db as never, null, U);
    expect(first.upserted).toBeGreaterThanOrEqual(6);
    expect(cloud.store.pillars).toHaveLength(1);
    expect(cloud.store.sessions![0]).toMatchObject({ user_id: U, duration_seconds: 1800, habit_id: expect.any(String), objective_id: expect.any(String) });
    expect(cloud.store.backup_rows!.some((r) => r.id === 'user_name')).toBe(true);
    expect(cloud.store.backup_rows!.some((r) => r.id === 'fc_selection')).toBe(false);
    const calls = cloud.upsertCalls();
    const again = await sync.push(cloud.client, db as never, first.ledger, U);
    expect(again).toMatchObject({ upserted: 0, deleted: 0 });
    expect(cloud.upsertCalls()).toBe(calls);
  });

  it('only changed rows go up; a deleted row is deleted from the copy', async () => {
    const { t } = await seed();
    const cloud = fakeCloud();
    const first = await sync.push(cloud.client, db as never, null, U);
    await api.updateTask(t.id, { title: 'Buy trail shoes' });
    await api.deleteTask(t.id);
    const b2 = await api.addGoal({ name: 'Craft', color: '#A66A00', icon: 'hammer', sort_order: 1, why_statement: '' });
    const next = await sync.push(cloud.client, db as never, first.ledger, U);
    expect(next.upserted).toBe(1); // the new pillar
    expect(next.deleted).toBe(1); // the task
    expect(cloud.store.tasks).toHaveLength(0);
    expect(cloud.store.pillars!.map((p) => p.id).sort()).toEqual([b2.id, (cloud.store.pillars!.find((p) => p.name === 'Body') as Row).id].sort());
  });

  it('a failure half-way keeps only what the server accepted; the next push sends the rest', async () => {
    await seed();
    const cloud = fakeCloud({ failUpsertOn: 2 });
    await expect(sync.push(cloud.client, db as never, null, U)).rejects.toThrow('network down');
    const retry = await sync.push(cloud.client, db as never, null, U);
    expect(retry.upserted).toBeGreaterThan(0);
    expect(cloud.store.sessions).toHaveLength(1);
  });

  it('another account starts from an empty ledger (uploads everything again)', async () => {
    await seed();
    const cloud = fakeCloud();
    const a = await sync.push(cloud.client, db as never, null, U);
    const b = await sync.push(cloud.client, db as never, a.ledger, 'user-b');
    expect(b.upserted).toBe(a.upserted);
  });

  it('seed → push → wipe → restore → deep-equal, device settings kept, nothing to upload after', async () => {
    await seed();
    const before = snapshot();
    const cloud = fakeCloud();
    await sync.push(cloud.client, db as never, null, U);

    api.deleteAllData();
    setSetting('fc_selection', 'new-phone-token');
    expect(snapshot().meta_goals).toEqual([]);

    const data = await sync.pullAll(cloud.client, U);
    const { ledger, restored } = sync.applyRestore(db as never, data, U, setSetting, { transaction: false });
    expect(restored).toBe(6); // pillar, goal, task, habit, session, user_name
    expect(snapshot()).toEqual(before);
    expect(getSetting('fc_selection')).toBe('new-phone-token');
    expect(api.getLifetimeMinutes()).toBe(30);
    const after = await sync.push(cloud.client, db as never, ledger, U);
    expect(after).toMatchObject({ upserted: 0, deleted: 0 });
  });

  it('restore replaces what was on the phone (no mixing)', async () => {
    await seed();
    const cloud = fakeCloud();
    await sync.push(cloud.client, db as never, null, U);
    await api.addGoal({ name: 'Local only', color: '#000', icon: 'book', sort_order: 5, why_statement: '' });
    sync.applyRestore(db as never, await sync.pullAll(cloud.client, U), U, setSetting, { transaction: false });
    expect(snapshot().meta_goals.map((g) => g.name)).toEqual(['Body']);
  });
});
