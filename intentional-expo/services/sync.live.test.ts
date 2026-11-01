/**
 * US-089 · Live round trip against the Supabase project (opt-in: `npm run test:sync`).
 * Two throwaway users. A seeds local data → push → wipe → restore → deep-equal. B can't read A's mirror rows,
 * and B's push of the same local ids doesn't touch A's copy. Users deleted at the end.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { localDayKey, shiftDayKey } from '@/utils/dates';
import { loadAdminEnv } from '../scripts/supabase-env.mjs';

vi.mock('@/db/index', async () => import('@/db/index.web'));
vi.mock('@/db', async () => import('@/db/index.web'));

const LIVE = process.env.SYNC_LIVE === '1';
const loaded = LIVE ? loadAdminEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) : { missing: ['SYNC_LIVE'] };
const run = LIVE && !loaded.missing;

describe.skipIf(!run)('backup & restore, live (US-089)', () => {
  const E = (loaded as { env: Record<string, string> }).env;
  const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws as never } };
  const admin = run ? createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, opts) : (null as never);
  const users: { id: string; client: never }[] = [];
  const stamp = Date.now();

  async function user(tag: string) {
    const email = `sync-${tag}-${stamp}@test.intentional.invalid`;
    const password = `Pw-${stamp}-${tag}-x!`;
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    const client = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, opts);
    const s = await client.auth.signInWithPassword({ email, password });
    if (s.error) throw s.error;
    const u = { id: data.user.id, client: client as never };
    users.push(u);
    return u;
  }

  let api: typeof import('@/db/api');
  let web: typeof import('@/db/index.web');
  let sync: typeof import('./sync');
  beforeAll(async () => {
    api = await import('@/db/api');
    web = await import('@/db/index.web');
    sync = await import('./sync');
  });
  afterAll(async () => {
    for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  });

  const snapshot = () =>
    Object.fromEntries(sync.SPECS.map((s) => [s.local, sync.readLocal(web.db as never, s).sort((a, b) => String(a[s.idCol]).localeCompare(String(b[s.idCol])))]));

  it('seed → push → wipe → restore → deep-equal; RLS isolates the copies', async () => {
    api.deleteAllData();
    const body = await api.addGoal({ name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: 'Strong at 80.' });
    const o = await api.addObjective({ pillar_id: body.id, title: 'Half marathon', done_when: '', deadline: shiftDayKey(localDayKey(), 60), status: 'active', sort_order: 0, metric_current: null, metric_target: null, metric_unit: null });
    await api.addTask({ objective_id: o.id, title: 'Buy shoes' });
    const h = await api.addAction({ goal_id: body.id, name: 'Run', type: 'session', target_minutes: 30, reminder_time: '07:00', is_active: 1, sort_order: 0, objective_id: o.id, days_mask: 21 });
    for (let i = 0; i < 5; i++) {
      const at = new Date(Date.now() - (i + 1) * 86400_000).toISOString();
      await api.saveFocusSession({ action_id: h.id, goal_id: body.id, started_at: at, ended_at: at, duration_seconds: 1500 + i, note: null, was_completed: 1, task_id: null, objective_id: null });
    }
    api.saveWeeklyReview({ week_start: api.currentWeekStart(), went_well: 'Ran 5 times', improve: '', adjustments: '', goals_data: null });
    web.setSetting('user_name', 'Jules');
    const before = snapshot();

    const a = await user('a');
    const b = await user('b');
    const first = await sync.push(a.client, web.db as never, null, a.id);
    expect(first.upserted).toBe(11); // pillar, goal, task, habit, 5 sessions, review, user_name
    const again = await sync.push(a.client, web.db as never, first.ledger, a.id);
    expect(again).toMatchObject({ upserted: 0, deleted: 0 });

    // B can't read A's copy, and B pushing the same local ids makes B's own copy.
    const bRead = await (b.client as ReturnType<typeof createClient>).from('sessions').select('id').eq('user_id', a.id);
    expect(bRead.data ?? []).toHaveLength(0);
    const bPush = await sync.push(b.client, web.db as never, null, b.id);
    expect(bPush.upserted).toBe(11);
    const aCount = await admin.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', a.id);
    const bCount = await admin.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', b.id);
    expect([aCount.count, bCount.count]).toEqual([5, 5]);
    // B can't write into A's copy.
    const bWrite = await (b.client as ReturnType<typeof createClient>).from('pillars').upsert({ user_id: a.id, id: 'x', name: 'x', color: 'x', icon: 'x', local: {} } as never);
    expect(bWrite.error).toBeTruthy();

    // A's new phone.
    api.deleteAllData();
    expect(snapshot().focus_sessions).toEqual([]);
    const restored = sync.applyRestore(web.db as never, await sync.pullAll(a.client, a.id), a.id, web.setSetting, { transaction: false });
    expect(restored.restored).toBe(11);
    expect(snapshot()).toEqual(before);
    const after = await sync.push(a.client, web.db as never, restored.ledger, a.id);
    expect(after).toMatchObject({ upserted: 0, deleted: 0 });

    const info = await sync.backupInfo(a.client, a.id);
    expect(info).toMatchObject({ pillars: 1, sessions: 5 });
    expect(info.lastBackup).toBeTruthy();
  }, 60000);
});
