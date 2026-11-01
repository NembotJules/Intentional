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

  // US-090: witnesses. Only the two sides read the link; witness_summary answers only the active witness.
  {
    const c = await makeUser('c');
    await a.client.from('profiles').insert({ id: a.id, display_name: 'A' });
    await b.client.from('profiles').insert({ id: b.id, display_name: 'B' });
    await a.client.from('pillars').insert({ user_id: a.id, id: 'p1', name: 'Body', color: '#000', icon: 'x', local: {} });
    await a.client.from('sessions').insert({ user_id: a.id, id: 's1', pillar_id: 'p1', started_at: new Date().toISOString(), duration_seconds: 1800, local: { note: 'secret' } });
    const monday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();

    const first = await a.client.rpc('create_witness_invite');
    const inv = await a.client.rpc('create_witness_invite');
    ok(!first.error && !inv.error && /^[A-Z2-9]{8}$/.test(inv.data), 'witness: an 8-character invite code');
    const open = await admin.from('witnesses').select('status').eq('owner_id', a.id);
    ok(open.data?.filter((r) => r.status === 'pending').length === 1, 'witness: a new invite replaces the pending one (one at a time)');
    const cSees = await c.client.from('witnesses').select('*').eq('owner_id', a.id);
    ok((cSees.data ?? []).length === 0, 'witness: a stranger reads no link');
    const direct = await b.client.from('witnesses').insert({ owner_id: a.id, witness_id: b.id, invite_code: 'HACKHACK', status: 'active' });
    ok(!!direct.error, 'witness: nobody writes links directly (RPCs only)');
    const own = await a.client.rpc('accept_witness', { code: inv.data });
    ok(!!own.error, 'witness: you can\'t accept your own invite');
    const preSummary = await b.client.rpc('witness_summary', { owner: a.id, week_start: monday });
    ok(!!preSummary.error, 'witness_summary: refused before accepting');
    const acc = await b.client.rpc('accept_witness', { code: inv.data.toLowerCase() });
    ok(!acc.error, `witness: B accepts (code case doesn't matter)${acc.error ? ` (${acc.error.message})` : ''}`);
    const again = await c.client.rpc('accept_witness', { code: inv.data });
    ok(!!again.error, 'witness: an accepted code can\'t be used again');
    const sum = await b.client.rpc('witness_summary', { owner: a.id, week_start: monday });
    ok(!sum.error && sum.data?.pillars?.[0]?.minutes === 30 && sum.data?.display_name === 'A', `witness_summary: the witness gets aggregates (Body 30 min)${sum.error ? ` (${sum.error.message})` : ''}`);
    ok(!JSON.stringify(sum.data ?? {}).includes('secret'), 'witness_summary: no notes in the answer');
    const cSum = await c.client.rpc('witness_summary', { owner: a.id, week_start: monday });
    ok(!!cSum.error, 'witness_summary: refused for a stranger');
    const anSum = await anon.rpc('witness_summary', { owner: a.id, week_start: monday });
    ok(!!anSum.error, 'witness_summary: refused for anon');
    const links = await b.client.rpc('witness_links');
    ok(links.data?.length === 1 && links.data[0].role === 'witness' && links.data[0].other_name === 'A' && links.data[0].invite_code === null, 'witness_links: B sees "A", role witness, no code');
    const cEnd = await c.client.rpc('end_witness', { link_id: links.data?.[0]?.id });
    ok(!!cEnd.error, 'end_witness: a stranger can\'t end it');
    const bEnd = await b.client.rpc('end_witness', { link_id: links.data?.[0]?.id });
    ok(!bEnd.error, 'end_witness: the witness ends it');
    const after = await b.client.rpc('witness_summary', { owner: a.id, week_start: monday });
    ok(!!after.error, 'witness_summary: refused once ended');
    await admin.from('profiles').delete().in('id', [a.id, b.id]);
    await admin.from('pillars').delete().eq('user_id', a.id);
    await admin.from('sessions').delete().eq('user_id', a.id);
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
