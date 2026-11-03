/**
 * US-087 · `npm run test:rls`: Row Level Security on the live Supabase project, with two throwaway users.
 * Owner can read/write their own rows; another user and the anon role cannot; every public table has RLS on.
 * Needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (+ SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN for
 * the RLS-on-every-table check) from the environment or ~/.config/intentional/supabase-admin.env.
 * Skips (exit 0) with a clear message when they're missing. The test users are deleted at the end, pass or fail.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { loadAdminEnv } from './supabase-env.mjs';

const loaded = loadAdminEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);
if (loaded.missing) {
  console.log(`SKIP test:rls: missing ${loaded.missing.join(', ')} (set them, or fill ~/.config/intentional/supabase-admin.env).`);
  process.exit(0);
}
const E = loaded.env;
// Node 20 has no global WebSocket: the realtime client needs `ws`.
const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } };
const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, opts);

let passed = 0;
let failed = 0;
const ok = (cond, msg) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
};

const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const users = [];
async function makeUser(tag) {
  const email = `rls-${tag}-${stamp}@test.intentional.invalid`;
  const password = `Pw-${stamp}-${Math.random().toString(36).slice(2)}!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  users.push(data.user.id);
  const client = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn ${tag}: ${e2.message}`);
  return { id: data.user.id, client };
}

/** Every owner table and how to make a row for a user. Later stories add theirs here. */
const now = new Date().toISOString();
const mirror = (table, extra, field) => ({
  table,
  key: 'user_id',
  row: (uid) => ({ user_id: uid, id: 'rls-1', local: { id: 'rls-1' }, ...extra }),
  patch: { [field]: 'Changed' },
  field,
});
const OWNER_TABLES = [
  { table: 'profiles', key: 'id', row: (uid) => ({ id: uid, display_name: 'Test' }), patch: { display_name: 'Changed' }, field: 'display_name' },
  // US-089 mirrors
  mirror('pillars', { name: 'Body', color: '#000', icon: 'x' }, 'name'),
  mirror('objectives', { pillar_id: 'p', title: 'Goal', status: 'active' }, 'title'),
  mirror('tasks', { objective_id: 'o', title: 'Task' }, 'title'),
  mirror('habits', { pillar_id: 'p', name: 'Run' }, 'name'),
  mirror('sessions', { pillar_id: 'p', started_at: now, duration_seconds: 60 }, 'pillar_id'),
  mirror('backup_rows', { tbl: 'settings' }, 'id'),
];

try {
  const a = await makeUser('a');
  const b = await makeUser('b');

  for (const t of OWNER_TABLES) {
    // Owner writes and reads their own.
    const ins = await a.client.from(t.table).insert(t.row(a.id)).select();
    ok(!ins.error && ins.data?.length === 1, `${t.table}: owner inserts own row${ins.error ? ` (${ins.error.message})` : ''}`);
    const own = await a.client.from(t.table).select('*').eq(t.key, a.id);
    ok(own.data?.length === 1, `${t.table}: owner reads own row`);
    const upd = await a.client.from(t.table).update(t.patch).eq(t.key, a.id).select();
    ok(upd.data?.length === 1 && upd.data[0][t.field] === 'Changed', `${t.table}: owner updates own row`);

    // Another user can't.
    const bRead = await b.client.from(t.table).select('*').eq(t.key, a.id);
    ok(!bRead.error && bRead.data?.length === 0, `${t.table}: another user reads nothing of the owner's`);
    const bAll = await b.client.from(t.table).select('*');
    ok((bAll.data ?? []).every((r) => r[t.key] === b.id), `${t.table}: a full select by another user returns only their own`);
    const bIns = await b.client.from(t.table).insert(t.row(a.id));
    ok(!!bIns.error, `${t.table}: another user can't insert a row as the owner`);
    await b.client.from(t.table).update({ [t.field]: 'Hacked' }).eq(t.key, a.id);
    await b.client.from(t.table).delete().eq(t.key, a.id);
    const still = await admin.from(t.table).select('*').eq(t.key, a.id);
    ok(still.data?.length === 1 && still.data[0][t.field] !== 'Hacked', `${t.table}: another user's update and delete change nothing`);

    // The anon role (no account) can't.
    const anRead = await anon.from(t.table).select('*');
    ok(!!anRead.error || anRead.data?.length === 0, `${t.table}: anon reads nothing`);
    const anIns = await anon.from(t.table).insert(t.row(b.id));
    ok(!!anIns.error, `${t.table}: anon can't insert`);

    // The owner can delete their own.
    const del = await a.client.from(t.table).delete().eq(t.key, a.id).select();
    ok(del.data?.length === 1, `${t.table}: owner deletes own row`);
  }

  // US-088: delete_my_account deletes only the caller; anon can't call it.
  {
    const anCall = await anon.rpc('delete_my_account');
    ok(!!anCall.error, 'delete_my_account: anon is refused');
    await a.client.from('profiles').insert({ id: a.id, display_name: 'A' });
    await b.client.from('profiles').insert({ id: b.id, display_name: 'B' });
    const del = await a.client.rpc('delete_my_account');
    ok(!del.error, `delete_my_account: the owner deletes their account${del.error ? ` (${del.error.message})` : ''}`);
    const aUser = await admin.auth.admin.getUserById(a.id);
    const bUser = await admin.auth.admin.getUserById(b.id);
    ok(!aUser.data?.user && !!bUser.data?.user, 'delete_my_account: only the caller is deleted');
    const rows = await admin.from('profiles').select('id').in('id', [a.id, b.id]);
    ok(rows.data?.length === 1 && rows.data[0].id === b.id, 'delete_my_account: their profile goes with them (cascade), the other stays');
  }

  // Advisors' first rule, checked directly: no public table without RLS.
  if (E.SUPABASE_PROJECT_REF && E.SUPABASE_ACCESS_TOKEN) {
    const r = await fetch(`https://api.supabase.com/v1/projects/${E.SUPABASE_PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${E.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity",
      }),
    });
    const rows = r.ok ? await r.json() : null;
    ok(Array.isArray(rows) && rows.length === 0, `every public table has RLS on${rows?.length ? ` (missing: ${rows.map((x) => x.relname).join(', ')})` : ''}`);
  } else {
    console.log('SKIP RLS-on-every-table check: no SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN');
  }
} catch (e) {
  failed += 1;
  console.log(`FAIL ${e.message}`);
} finally {
  for (const id of users) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) console.log(`WARN could not delete test user ${id}: ${error.message}`);
  }
  const left = await admin.from('profiles').select('id').in('id', users);
  ok((left.data ?? []).length === 0, 'test users and their rows are gone');
}

console.log(`RESULT test:rls: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
