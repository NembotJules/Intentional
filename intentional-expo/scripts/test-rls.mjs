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

  // US-091: circles. Closed tables; members-only RPCs; max 8; ranking only when the owner turns it on; honest minutes.
  {
    const c = await makeUser('c2');
    const monday = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      return d.toISOString().slice(0, 10);
    })();
    await a.client.from('profiles').upsert({ id: a.id, display_name: 'A' });
    await b.client.from('profiles').upsert({ id: b.id, display_name: 'B' });
    await a.client.from('pillars').upsert({ user_id: a.id, id: 'p1', name: 'Craft', color: '#000', icon: 'x', local: {} });
    await b.client.from('pillars').upsert({ user_id: b.id, id: 'p2', name: 'Work', color: '#000', icon: 'x', local: {} });
    const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
    const s = (uid, id, pillar, startMinAgo, secs) => ({ user_id: uid, id, pillar_id: pillar, started_at: ago(startMinAgo), duration_seconds: secs, local: { note: 'secret' } });
    await admin.from('sessions').insert([
      s(a.id, 'c1', 'p1', 100, 1800), // 30 min
      s(a.id, 'c2', 'p1', 85, 1800), // overlaps the first by 15 min → together 45 min
      s(a.id, 'c3', 'p1', 50, 30), // 30 s: too short
      s(a.id, 'c4', 'p1', 400, 5 * 3600), // 5 h: too long
      s(a.id, 'c5', 'p1', -60, 1800), // in the future
      s(a.id, 'c6', 'other', 30, 1200), // another pillar: not mapped
      s(b.id, 'c1', 'p2', 120, 3600), // 60 min
    ]);

    const anCreate = await anon.rpc('create_circle', { name: 'X', pillar_label: 'Craft', weekly_target_minutes: 600, my_pillar_id: 'p1' });
    ok(!!anCreate.error, 'circles: anon can\'t create');
    const noPillar = await a.client.rpc('create_circle', { name: 'X', pillar_label: 'Craft', weekly_target_minutes: 600, my_pillar_id: 'nope' });
    ok(!!noPillar.error, 'circles: you map one of your own (backed-up) pillars');
    const made = await a.client.rpc('create_circle', { name: 'Makers', pillar_label: 'Craft', weekly_target_minutes: 3000, my_pillar_id: 'p1' });
    const cid = made.data?.id;
    const code = made.data?.invite_code;
    ok(!made.error && /^[A-Z2-9]{8}$/.test(code ?? ''), `circles: created with an 8-character code${made.error ? ` (${made.error.message})` : ''}`);
    const direct = await a.client.from('circles').select('*');
    const directM = await a.client.from('circle_members').select('*');
    ok((!!direct.error || direct.data?.length === 0) && (!!directM.error || directM.data?.length === 0), 'circles: tables are closed, even to members (RPCs only)');
    const forge = await b.client.from('circle_members').insert({ circle_id: cid, user_id: b.id, pillar_id: 'p2' });
    ok(!!forge.error, 'circles: nobody joins by writing the table');
    const wrongPillar = await b.client.rpc('join_circle', { code, my_pillar_id: 'p1' });
    ok(!!wrongPillar.error, 'join_circle: refused with someone else\'s pillar');
    const join = await b.client.rpc('join_circle', { code: code.toLowerCase(), my_pillar_id: 'p2' });
    ok(!join.error && join.data === cid, `join_circle: B joins (code case doesn't matter)${join.error ? ` (${join.error.message})` : ''}`);

    const cWeek = await c.client.rpc('circle_week', { circle_id: cid, week_start: monday });
    ok(!!cWeek.error, 'circle_week: refused for a non-member');
    const anWeek = await anon.rpc('circle_week', { circle_id: cid, week_start: monday });
    ok(!!anWeek.error, 'circle_week: refused for anon');
    const cList = await c.client.rpc('my_circles', { week_start: monday });
    ok(!cList.error && Array.isArray(cList.data) && cList.data.length === 0, 'my_circles: a non-member sees none');

    const wk = await b.client.rpc('circle_week', { circle_id: cid, week_start: monday });
    const m = wk.data?.members ?? [];
    const byName = Object.fromEntries(m.map((x) => [x.display_name, x]));
    ok(!wk.error && m.length === 2, `circle_week: a member sees 2 members${wk.error ? ` (${wk.error.message})` : ''}`);
    ok(byName.A?.minutes === 45, `honest minutes: overlap counted once, too short / too long / future / other pillar left out (A ${byName.A?.minutes} = 45)`);
    ok(byName.B?.minutes === 60 && wk.data?.total_minutes === 105, `circle_week: B 60, total 105 (${wk.data?.total_minutes})`);
    ok(wk.data?.ranking_enabled === false && m.every((x) => x.rank === null) && m[0]?.display_name === 'A', 'ranking off by default: no ranks, members in joining order');
    ok(!JSON.stringify(wk.data ?? {}).includes('secret'), 'circle_week: no notes in the answer');
    ok(byName.A?.pillar_id === null && byName.B?.pillar_id === 'p2', 'circle_week: you see only your own pillar id');
    const list = await b.client.rpc('my_circles', { week_start: monday });
    ok(list.data?.length === 1 && list.data[0].total_minutes === 105 && list.data[0].member_count === 2 && list.data[0].my_role === 'member', 'my_circles: B sees the circle, total 105, 2 members');

    const bRank = await b.client.rpc('set_circle_ranking', { circle_id: cid, enabled: true });
    ok(!!bRank.error, 'set_circle_ranking: a member can\'t');
    const aRank = await a.client.rpc('set_circle_ranking', { circle_id: cid, enabled: true });
    const wk2 = await b.client.rpc('circle_week', { circle_id: cid, week_start: monday });
    const m2 = wk2.data?.members ?? [];
    ok(!aRank.error && m2[0]?.display_name === 'B' && m2[0]?.rank === 1 && m2[1]?.rank === 2, 'ranking on (owner): B #1, A #2');
    const lastWeek = new Date(Date.parse(`${monday}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10);
    const wkPrev = await b.client.rpc('circle_week', { circle_id: cid, week_start: lastWeek });
    ok(wkPrev.data?.total_minutes === 0, 'the ranking resets: last week starts from 0');

    // 8 members max: fill with throwaway users (admin), then C is refused.
    for (let i = 0; i < 6; i++) {
      const { data } = await admin.auth.admin.createUser({ email: `rls-fill${i}-${stamp}@test.intentional.invalid`, email_confirm: true });
      users.push(data.user.id);
      await admin.from('circle_members').insert({ circle_id: cid, user_id: data.user.id, pillar_id: 'x' });
    }
    await c.client.from('pillars').upsert({ user_id: c.id, id: 'p3', name: 'Art', color: '#000', icon: 'x', local: {} });
    const full = await c.client.rpc('join_circle', { code, my_pillar_id: 'p3' });
    ok(!!full.error && /full/.test(full.error.message), `join_circle: refused at 8 members${full.error ? ` (${full.error.message})` : ''}`);

    // Remove (owner only); the code changes.
    const filler = users[users.length - 1];
    const bRemove = await b.client.rpc('remove_circle_member', { circle_id: cid, member_id: filler });
    ok(!!bRemove.error, 'remove_circle_member: a member can\'t');
    const aRemove = await a.client.rpc('remove_circle_member', { circle_id: cid, member_id: filler });
    const after = await a.client.rpc('circle_week', { circle_id: cid, week_start: monday });
    ok(!aRemove.error && after.data?.members?.length === 7 && after.data?.invite_code !== code, 'remove_circle_member: the owner removes; the invite code changes');
    const oldCode = await c.client.rpc('join_circle', { code, my_pillar_id: 'p3' });
    ok(!!oldCode.error, 'join_circle: the old code no longer works');

    // Leave: the owner hands over to the longest-standing member (B).
    const aLeave = await a.client.rpc('leave_circle', { circle_id: cid });
    const roles = (await admin.from('circle_members').select('user_id, role').eq('circle_id', cid)).data ?? [];
    ok(!aLeave.error && !roles.some((r) => r.user_id === a.id) && roles.find((r) => r.role === 'owner')?.user_id === b.id, 'leave_circle: the owner leaves, B becomes owner');
    const aGone = await a.client.rpc('circle_week', { circle_id: cid, week_start: monday });
    ok(!!aGone.error, 'circle_week: refused once you left');

    // Delete: only the owner.
    const cDel = await c.client.rpc('delete_circle', { circle_id: cid });
    ok(!!cDel.error, 'delete_circle: a non-member can\'t');
    const bDel = await b.client.rpc('delete_circle', { circle_id: cid });
    const gone = (await admin.from('circles').select('id').eq('id', cid)).data ?? [];
    const goneM = (await admin.from('circle_members').select('user_id').eq('circle_id', cid)).data ?? [];
    ok(!bDel.error && gone.length === 0 && goneM.length === 0, 'delete_circle: the owner deletes it, members go with it');

    // A lone owner leaving deletes the circle.
    const solo = await a.client.rpc('create_circle', { name: 'Solo', pillar_label: 'Craft', weekly_target_minutes: 600, my_pillar_id: 'p1' });
    await a.client.rpc('leave_circle', { circle_id: solo.data?.id });
    ok(((await admin.from('circles').select('id').eq('id', solo.data?.id)).data ?? []).length === 0, 'leave_circle: alone, the circle is deleted');

    // 16 h a day at most (fixed day last week, five 4 h sessions = 20 h).
    const day = `${lastWeek}T`;
    await admin.from('sessions').insert([0, 4, 8, 12, 16].map((h, i) => ({ user_id: c.id, id: `cap${i}`, pillar_id: 'cap', started_at: `${day}${String(h).padStart(2, '0')}:00:00Z`, duration_seconds: 14400, local: {} })));
    if (E.SUPABASE_PROJECT_REF && E.SUPABASE_ACCESS_TOKEN) {
      const r = await fetch(`https://api.supabase.com/v1/projects/${E.SUPABASE_PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `select public._social_minutes('${c.id}', 'cap', '${lastWeek}T00:00:00Z', '${monday}T00:00:00Z', 'UTC') as m` }),
      });
      const rows = r.ok ? await r.json() : null;
      ok(rows?.[0]?.m === 960, `honest minutes: 20 h in one day counts as 16 h (${rows?.[0]?.m} = 960)`);
      const helper = await a.client.rpc('_social_minutes', { uid: c.id, pillar: 'cap', from_ts: `${lastWeek}T00:00:00Z`, to_ts: `${monday}T00:00:00Z`, tz: 'UTC' });
      ok(!!helper.error, 'internal helpers can\'t be called by clients');
    }
    for (const uid of [a.id, b.id, c.id]) {
      await admin.from('sessions').delete().eq('user_id', uid);
      await admin.from('pillars').delete().eq('user_id', uid);
    }
    await admin.from('profiles').delete().in('id', [a.id, b.id]);
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
