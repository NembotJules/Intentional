/**
 * US-090 · A witness, with two accounts in two browser contexts, against the live Supabase project.
 * Email sending is answered by the test (as in account.e2e); codes are real and verified by Supabase.
 *   (a) A (Jules) signs in (first backup), invites a witness → a code + the invite text.
 *   (b) B (Sam), another browser, opens the invite link (?code=) → Accept → "You witness: Jules".
 *   (c) B sees Jules's week: Flick's stage, the pledge, hours per pillar this week (last week's session left out),
 *       the goal with progress and pace — and never a task name or a note.
 *   (d) A sees "Sam is your witness". B stops witnessing → A can invite again.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { start, makeDb, today } from './lib.mjs';
import { loadAdminEnv, } from '../scripts/supabase-env.mjs';

const loaded = loadAdminEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
if (loaded.missing) {
  console.log(`SKIP witness e2e: missing ${loaded.missing.join(', ')}`);
  process.exit(0);
}
const admin = createClient(loaded.env.SUPABASE_URL, loaded.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } });

const t = await start('witness');
const { page: pageA, ok, shot } = t;
const stamp = Date.now();
const emailA = `e2e-witness-a-${stamp}@test.intentional.invalid`;
const emailB = `e2e-witness-b-${stamp}@test.intentional.invalid`;
const ids = [];

// B: a second browser (its own storage), seeded like a phone that finished onboarding.
const ctxB = await pageA.context().browser().newContext({ viewport: { width: 390, height: 844 } });
const pageB = await ctxB.newPage();
pageB.setDefaultTimeout(120000);
pageB.on('dialog', (d) => void d.accept());
const shotB = (label) => pageB.screenshot({ path: new URL(`./artifacts/witness/b-${label}.png`, import.meta.url).pathname });

for (const p of [pageA, pageB]) await p.route('**/auth/v1/otp**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

async function signIn(page, email) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Send me a code', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(error.message);
  await page.getByLabel('Code', { exact: true }).fill(data.properties.email_otp);
  await page.getByLabel('Sign in', { exact: true }).last().click();
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 20000 });
  // The profile is saved once the name field shows it.
  for (let i = 0; i < 30 && !(await page.getByLabel('Account name', { exact: true }).inputValue().catch(() => '')); i++) await page.waitForTimeout(500);
}
const tapOn = async (page, label, wait = 800) => {
  await page.getByLabel(label, { exact: true }).last().click();
  await page.waitForTimeout(wait);
};

// A's phone: two pillars, a goal with 3 steps (1 done), sessions this week and one last week, a note.
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const sess = (id, pillar, mins, msAgo, extra = {}) => ({ id, action_id: null, goal_id: pillar, started_at: iso(msAgo), ended_at: iso(msAgo - mins * 60000), duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: null, ...extra });
const A = makeDb({ pillars: [['Body', '#D65A31', 'dumbbell'], ['Craft', '#A66A00', 'hammer']], name: 'Jules' });
A.db.objectives = [{ id: 'o0', pillar_id: 'g0', title: 'Half marathon', done_when: '', deadline: today(60), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(10 * 86400000), closed_at: null, close_note: null }];
const task = (id, title, done) => ({ id, objective_id: 'o0', title, estimate_minutes: 30, planned_date: null, is_done: done, done_at: done ? iso(1000) : null, sort_order: 0, created_at: iso(5000) });
A.db.tasks = [task('t0', 'Secret step name', 1), task('t1', 'Buy shoes', 0), task('t2', 'Book race', 0)];
A.db.focus_sessions = [
  sess('s1', 'g0', 60, 2 * 3600000, { objective_id: 'o0', task_id: 't0', note: 'Private note about my knee' }),
  sess('s2', 'g1', 30, 3600000),
  sess('s3', 'g0', 120, 9 * 86400000), // last week
];
const B = makeDb({ pillars: [['Mind', '#4C6FFF', 'book']], name: 'Sam' });

try {
  for (const e of [emailA, emailB]) {
    const { data, error } = await admin.auth.admin.createUser({ email: e, email_confirm: true });
    if (error) throw new Error(error.message);
    ids.push(data.user.id);
  }

  // ─── (a) A signs in and invites ───
  await t.goto('/');
  await t.wait(1500);
  await t.seed(A.db, A.settings);
  await t.goto('/account');
  await t.waitText('An account, if you want one', 30000);
  await signIn(pageA, emailA);
  await pageA.getByLabel(/^Last backup just now$/).waitFor({ timeout: 20000 });
  await t.goto('/settings');
  await pageA.getByLabel('Witness', { exact: true }).waitFor({ timeout: 20000 });
  ok((await pageA.getByLabel('Witness', { exact: true }).count()) === 1, 'Settings → Your week shows "Witness" (signed in)');
  await tapOn(pageA, 'Witness', 1500);
  await t.waitText('Invite a witness', 20000);
  await tapOn(pageA, 'Invite a witness', 3000);
  const codeLabel = await pageA.getByLabel(/^Invite code /).first().getAttribute('aria-label', { timeout: 20000 });
  const code = codeLabel?.replace('Invite code ', '') ?? '';
  ok(/^[A-Z2-9]{8}$/.test(code), `A has an 8-character invite code (${code})`);
  const shared = await pageA.evaluate(() => globalThis.__lastShared ?? '');
  ok(shared.includes('Jules would like you to be their witness on Intentional, for Body and Craft.') && shared.includes(`intentional://witness?code=${code}`), 'the invite text names Jules, the pillars, and links the code');
  ok(!shared.includes('Secret step name'), 'the invite text has no task names');
  await shot('a-invite');

  // ─── (b) B accepts in another browser ───
  await pageB.goto(`${process.env.E2E_BASE_URL ?? 'http://localhost:8081'}/`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(1500);
  await pageB.evaluate(([d, s]) => {
    localStorage.clear();
    localStorage.setItem('intentional_db_v2', JSON.stringify(d));
    localStorage.setItem('intentional_settings_v1', JSON.stringify(s));
  }, [B.db, B.settings]);
  await pageB.goto(`${process.env.E2E_BASE_URL ?? 'http://localhost:8081'}/account`, { waitUntil: 'domcontentloaded' });
  await pageB.getByText('An account, if you want one').first().waitFor({ timeout: 30000 });
  await signIn(pageB, emailB);
  await pageB.goto(`${process.env.E2E_BASE_URL ?? 'http://localhost:8081'}/witness?code=${code}`, { waitUntil: 'domcontentloaded' });
  await pageB.getByLabel('Witness code', { exact: true }).waitFor({ timeout: 30000 });
  await pageB.waitForTimeout(1200);
  ok((await pageB.getByLabel('Witness code', { exact: true }).inputValue()).replace(' ', '') === code, 'the link fills the code in');
  await tapOn(pageB, 'Accept', 3000);
  await pageB.getByLabel('See Jules week', { exact: true }).waitFor({ timeout: 20000 });
  ok((await pageB.getByLabel('See Jules week', { exact: true }).count()) === 1 && (await pageB.innerText('body')).includes('You’re their witness now.'), 'B accepted: "You witness: Jules"');
  const open = (await admin.from('witnesses').select('status, witness_id').eq('owner_id', ids[0])).data ?? [];
  ok(open.length === 1 && open[0].status === 'active' && open[0].witness_id === ids[1], 'stored: active, witness = B');
  await shotB('accepted');

  // ─── (c) what B sees ───
  await tapOn(pageB, 'See Jules week', 3000);
  await pageB.getByLabel(/^This week /).first().waitFor({ timeout: 20000 });
  const bodyB = await pageB.innerText('body');
  ok(bodyB.includes('Jules'), 'B sees Jules');
  ok((await pageB.getByLabel('This week 1h 30m', { exact: true }).count()) === 1, 'this week: 1h 30m (last week\'s 2 h left out)');
  ok((await pageB.getByLabel('Body 1h', { exact: true }).count()) === 1 && (await pageB.getByLabel('Craft 30m', { exact: true }).count()) === 1, 'hours per pillar: Body 1h, Craft 30m');
  ok(bodyB.includes('Their hours go to Body and Craft.'), 'the pledge: hours go to Body and Craft');
  ok((await pageB.getByLabel(/^Goal Half marathon, .+, 33%$/).count()) === 1, 'the goal: Half marathon, its pace, 33%');
  ok(bodyB.includes('Flick is a Spark'), 'Flick\'s stage');
  ok(!bodyB.includes('Secret step name') && !bodyB.includes('Buy shoes') && !bodyB.includes('Private note'), 'never a task name or a note');
  await shotB('witnessing');

  // ─── (d) A sees the witness; B ends it ───
  await t.goto('/witness');
  await pageA.getByLabel('Your witness: Sam', { exact: true }).waitFor({ timeout: 20000 });
  ok(await t.has('Sam is your witness'), 'A: "Sam is your witness"');
  await shot('a-has-witness');
  await tapOn(pageB, 'Stop witnessing', 3000);
  await pageB.getByText('Nobody yet.').first().waitFor({ timeout: 20000 });
  ok((await pageB.getByLabel('See Jules week', { exact: true }).count()) === 0, 'B stopped witnessing: Jules is gone from "You witness"');
  await t.goto('/witness');
  await t.waitText('Invite a witness', 20000);
  ok(await t.has('Invite a witness'), 'after B ends it, A can invite again');
  const rows = (await admin.from('witnesses').select('status').eq('owner_id', ids[0])).data ?? [];
  ok(rows.length === 1 && rows[0].status === 'ended', `the link is stored as ended (${rows.map((r) => r.status)})`);
} catch (e) {
  await shot('error').catch(() => {});
  await shotB('error').catch(() => {});
  console.log('BODY A:', (await t.body().catch(() => '')).slice(0, 400).replace(/\n/g, ' | '));
  console.log('BODY B:', (await pageB.innerText('body').catch(() => '')).slice(0, 400).replace(/\n/g, ' | '));
  ok(false, `witness flow threw: ${e.message}`);
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
  await ctxB.close();
}
await t.finish();
