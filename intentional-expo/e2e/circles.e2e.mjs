/**
 * US-091 · Circles, with three accounts against the live Supabase project: A (Jules) and B (Sam) in two browser
 * contexts, C (Lou) through the API. Email sending is answered by the test (as in account.e2e); codes are real.
 *   (a) A signs in, Settings → Circles → creates "Makers" (Craft, 10 h a week) with their Craft pillar → the code.
 *   (b) B opens the invite link (?code=), picks their "Code" pillar, joins → 2 people, together 2.5 h of 10 h.
 *   (c) C joins too → 3 people, 3 h. Ranking is off: no order, no "#".
 *   (d) A turns the weekly ranking on → B sees "#1 · 1.5 h" for Sam.
 *   (e) A removes Lou (the code changes); B leaves; A deletes the circle → no circle.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { start, makeDb } from './lib.mjs';
import { loadAdminEnv } from '../scripts/supabase-env.mjs';

const loaded = loadAdminEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']);
if (loaded.missing) {
  console.log(`SKIP circles e2e: missing ${loaded.missing.join(', ')}`);
  process.exit(0);
}
const E = loaded.env;
const opts = { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } };
const admin = createClient(E.SUPABASE_URL, E.SUPABASE_SERVICE_ROLE_KEY, opts);
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8081';

const t = await start('circles');
const { page: pageA, ok, shot } = t;
const stamp = Date.now();
const emailA = `e2e-circle-a-${stamp}@test.intentional.invalid`;
const emailB = `e2e-circle-b-${stamp}@test.intentional.invalid`;
const emailC = `e2e-circle-c-${stamp}@test.intentional.invalid`;
const ids = [];

const ctxB = await pageA.context().browser().newContext({ viewport: { width: 390, height: 844 } });
const pageB = await ctxB.newPage();
pageB.setDefaultTimeout(120000);
pageB.on('dialog', (d) => void d.accept());
const shotB = (label) => pageB.screenshot({ path: new URL(`./artifacts/circles/b-${label}.png`, import.meta.url).pathname });
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
  for (let i = 0; i < 30 && !(await page.getByLabel('Account name', { exact: true }).inputValue().catch(() => '')); i++) await page.waitForTimeout(500);
}
const tapOn = async (page, label, wait = 800) => {
  await page.getByLabel(label, { exact: true }).last().click();
  await page.waitForTimeout(wait);
};
const count = (page, label) => page.getByLabel(label, { exact: true }).count();
// On = filled with ink (Surface.ink #171411); aria-selected / aria-checked when the platform exposes it.
const isOn = async (page, label) => {
  const el = page.getByLabel(label, { exact: true }).last();
  const aria = (await el.getAttribute('aria-selected')) ?? (await el.getAttribute('aria-checked'));
  const bg = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
  return aria === 'true' || bg === 'rgb(23, 20, 17)';
};

// Sessions that started 70–100 min ago, already over.
const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo).toISOString();
const sess = (id, pillar, mins, msAgo) => ({ id, action_id: null, goal_id: pillar, started_at: iso(msAgo), ended_at: iso(msAgo - mins * 60000), duration_seconds: mins * 60, note: 'Private note', was_completed: 1, task_id: null, objective_id: null });
const A = makeDb({ pillars: [['Body', '#D65A31', 'dumbbell'], ['Craft', '#A66A00', 'hammer']], name: 'Jules' });
A.db.focus_sessions = [sess('s1', 'g1', 60, 70 * 60000), sess('s2', 'g0', 45, 80 * 60000)]; // Craft 1 h, Body 45 min
const B = makeDb({ pillars: [['Body', '#D65A31', 'dumbbell'], ['Code', '#4C6FFF', 'code']], name: 'Sam' });
B.db.focus_sessions = [sess('s1', 'g1', 90, 100 * 60000)]; // Code 1.5 h

try {
  for (const e of [emailA, emailB]) {
    const { data, error } = await admin.auth.admin.createUser({ email: e, email_confirm: true });
    if (error) throw new Error(error.message);
    ids.push(data.user.id);
  }
  const pwC = `Pw-${stamp}-c!`;
  const { data: cu, error: ce } = await admin.auth.admin.createUser({ email: emailC, password: pwC, email_confirm: true });
  if (ce) throw new Error(ce.message);
  ids.push(cu.user.id);
  const cClient = createClient(E.SUPABASE_URL, E.SUPABASE_ANON_KEY, opts);
  await cClient.auth.signInWithPassword({ email: emailC, password: pwC });
  await cClient.from('profiles').insert({ id: cu.user.id, display_name: 'Lou' });
  await cClient.from('pillars').insert({ user_id: cu.user.id, id: 'g0', name: 'Craft', color: '#000', icon: 'x', local: {} });
  await cClient.from('sessions').insert({ user_id: cu.user.id, id: 's1', pillar_id: 'g0', started_at: iso(60 * 60000), duration_seconds: 1800, local: {} });

  // ─── (a) A creates a circle ───
  await t.goto('/');
  await t.wait(1500);
  await t.seed(A.db, A.settings);
  await t.goto('/account');
  await t.waitText('An account, if you want one', 30000);
  await signIn(pageA, emailA);
  await pageA.getByLabel(/^Last backup just now$/).waitFor({ timeout: 20000 });
  await t.goto('/settings');
  await pageA.getByLabel('Circles', { exact: true }).waitFor({ timeout: 20000 });
  ok((await count(pageA, 'Circles')) === 1, 'Settings → Your week shows "Circles" (signed in)');
  await tapOn(pageA, 'Circles', 1500);
  await t.waitText('No circle yet', 20000);
  ok(await t.has('No circle yet. Start one, or join with a code.'), 'no circle yet');
  await shot('empty');
  await tapOn(pageA, 'Create a circle');
  ok((await pageA.getByLabel('Create the circle', { exact: true }).getAttribute('aria-disabled')) === 'true', 'the create form opens; "Create the circle" waits for a name');
  await pageA.getByLabel('Circle name', { exact: true }).fill('Makers');
  await pageA.getByLabel('Shared pillar', { exact: true }).fill('Craft');
  await pageA.getByLabel('Weekly target hours', { exact: true }).fill('10');
  ok((await isOn(pageA, 'My pillar Craft')) && !(await isOn(pageA, 'My pillar Body')), 'the label "Craft" picks A\'s Craft pillar');
  await shot('create-form');
  await tapOn(pageA, 'Create the circle', 4000);
  const codeLabel = await pageA.getByLabel(/^Circle code /).first().getAttribute('aria-label', { timeout: 20000 });
  const code = codeLabel?.replace('Circle code ', '') ?? '';
  ok(/^[A-Z2-9]{8}$/.test(code), `the circle has an 8-character code (${code})`);
  ok(await t.has('Your circle is ready. Invite your people:'), 'A lands on the new circle, asked to invite');
  ok((await count(pageA, '1 h of 10 h to Craft this week')) === 1, 'together: 1 h of 10 h to Craft (A\'s Craft only, not Body)');
  await tapOn(pageA, 'Share the invite', 800);
  const shared = await pageA.evaluate(() => globalThis.__lastShared ?? '');
  ok(shared.includes('Jules invites you to their circle “Makers” on Intentional: 10 h a week to Craft, together.') && shared.includes(`intentional://circles?code=${code}`), 'the invite names Jules, the circle, the target, and links the code');
  await shot('created');

  // ─── (b) B joins through the link ───
  await pageB.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pageB.waitForTimeout(1500);
  await pageB.evaluate(([d, s]) => {
    localStorage.clear();
    localStorage.setItem('intentional_db_v2', JSON.stringify(d));
    localStorage.setItem('intentional_settings_v1', JSON.stringify(s));
  }, [B.db, B.settings]);
  await pageB.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' });
  await pageB.getByText('An account, if you want one').first().waitFor({ timeout: 30000 });
  await signIn(pageB, emailB);
  await pageB.getByLabel(/^Last backup just now$/).waitFor({ timeout: 20000 });
  await pageB.goto(`${BASE}/circles?code=${code}`, { waitUntil: 'domcontentloaded' });
  await pageB.getByLabel('Circle code', { exact: true }).waitFor({ timeout: 30000 });
  await pageB.waitForTimeout(1200);
  ok((await pageB.getByLabel('Circle code', { exact: true }).inputValue()).replace(' ', '') === code, 'the link opens "Join a circle" with the code in');
  await tapOn(pageB, 'My pillar Code');
  await shotB('join');
  await tapOn(pageB, 'Join', 4000);
  await pageB.getByLabel('2.5 h of 10 h to Craft this week', { exact: true }).waitFor({ timeout: 20000 });
  ok((await count(pageB, '2.5 h of 10 h to Craft this week')) === 1, 'B joined: together 2.5 h of 10 h (Jules 1 h + Sam 1.5 h on Code)');
  ok((await count(pageB, 'Sam (you), 1.5 h, Flick Spark')) === 1 && (await count(pageB, 'Jules, 1 h, Flick Spark')) === 1, 'each member: hours on their own pillar, Flick\'s stage');
  ok(await pageB.getByText('Your hours on Code count.').first().isVisible(), 'B sees which of their pillars counts');
  ok((await count(pageB, 'Weekly ranking')) === 0 && (await count(pageB, 'Delete the circle')) === 0, 'a member has no ranking switch and no delete');

  // ─── (c) C joins (API) → 3 people, no ranking ───
  const cj = await cClient.rpc('join_circle', { code, my_pillar_id: 'g0' });
  ok(!cj.error, `C (Lou) joins${cj.error ? ` (${cj.error.message})` : ''}`);
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  await pageB.getByLabel('3 h of 10 h to Craft this week', { exact: true }).waitFor({ timeout: 30000 });
  const bodyB = await pageB.innerText('body');
  ok(bodyB.includes('Everyone’s hours') && bodyB.includes('3 of 8') && !bodyB.includes('#1'), 'ranking off by default: "Everyone\'s hours", 3 of 8, no "#"');
  const order = await pageB.locator('[aria-label$="Flick Spark"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')?.split(',')[0]));
  ok(order.join('|') === 'Jules|Sam (you)|Lou', `members in the order they joined (${order.join(', ')})`);
  ok(!bodyB.includes('Private note'), 'never a note');
  await shotB('three-no-ranking');

  // ─── (d) A turns ranking on ───
  await t.goto('/circles');
  await pageA.getByLabel('Circle Makers', { exact: true }).waitFor({ timeout: 20000 });
  ok(await t.has('3 people'), 'A\'s list: Makers, 3 people');
  await shot('list');
  await tapOn(pageA, 'Circle Makers', 3000);
  await pageA.getByLabel('Weekly ranking', { exact: true }).waitFor({ timeout: 20000 });
  await tapOn(pageA, 'Weekly ranking', 3000);
  ok(await isOn(pageA, 'Weekly ranking'), 'A turns the weekly ranking on');
  await pageB.reload({ waitUntil: 'domcontentloaded' });
  await pageB.getByLabel('Sam (you), #1 · 1.5 h, Flick Spark', { exact: true }).waitFor({ timeout: 30000 });
  const order2 = await pageB.locator('[aria-label$="Flick Spark"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')?.split(',')[0]));
  ok(order2.join('|') === 'Sam (you)|Jules|Lou', `ranking on: Sam #1, Jules #2, Lou #3 (${order2.join(', ')})`);
  const bodyB2 = await pageB.innerText('body');
  ok(bodyB2.includes('This week’s ranking') && bodyB2.includes('resets Monday'), 'B sees "This week\'s ranking · resets Monday"');
  await shotB('ranking');

  // ─── (e) remove, leave, delete ───
  await tapOn(pageA, 'Remove Lou', 3000);
  await pageA.getByLabel('2.5 h of 10 h to Craft this week', { exact: true }).waitFor({ timeout: 20000 });
  const newCode = (await pageA.getByLabel(/^Circle code /).first().getAttribute('aria-label'))?.replace('Circle code ', '');
  ok(newCode && newCode !== code, 'A removed Lou: 2 left, and the code changed');
  await tapOn(pageB, 'Leave the circle', 3000);
  await pageB.getByText('No circle yet').first().waitFor({ timeout: 20000 }).catch(() => {});
  const afterLeave = await pageB.innerText('body');
  await shotB('left');
  ok(afterLeave.includes('No circle yet. Start one, or join with a code.'), `B left: back on Circles, no circle${afterLeave.includes('No circle yet') ? '' : ` (${afterLeave.slice(0, 200).replace(/\n/g, ' | ')})`}`);
  await pageA.reload({ waitUntil: 'domcontentloaded' });
  await pageA.getByLabel('1 h of 10 h to Craft this week', { exact: true }).waitFor({ timeout: 30000 });
  ok((await pageA.locator('[aria-label$="Flick Spark"]').count()) === 1, 'A is alone in Makers');
  await shot('alone');
  await tapOn(pageA, 'Delete the circle', 3000);
  await t.goto('/circles');
  await t.waitText('No circle yet', 20000);
  const left = (await admin.from('circles').select('id').eq('created_by', ids[0])).data ?? [];
  ok(left.length === 0, 'A deleted the circle: gone on the server');
} catch (e) {
  await shot('error').catch(() => {});
  await shotB('error').catch(() => {});
  console.log('BODY A:', (await t.body().catch(() => '')).slice(0, 500).replace(/\n/g, ' | '));
  console.log('BODY B:', (await pageB.innerText('body').catch(() => '')).slice(0, 500).replace(/\n/g, ' | '));
  ok(false, `circles flow threw: ${e.message}`);
} finally {
  for (const id of ids) await admin.auth.admin.deleteUser(id).catch(() => {});
  await ctxB.close();
}
await t.finish();
