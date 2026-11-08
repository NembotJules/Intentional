/**
 * US-089 · Backup & restore, against the live Supabase project (web).
 * Email sending is answered by the test (as in account.e2e); codes are real (admin generateLink) and verified by Supabase.
 *   (a) sign in on a phone with data, account empty → the first backup runs by itself (rows checked on the server).
 *   (b) a session ends → backed up a few seconds later (auto backup).
 *   (c) a new phone (storage wiped) → welcome screen "I already use Intentional" → sign in → "Restore my data" →
 *       Today shows the pillars; the local DB holds the same sessions.
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { start, makeDb } from './lib.mjs';
import { loadAdminEnv } from '../scripts/supabase-env.mjs';

const loaded = loadAdminEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
if (loaded.missing) {
  console.log(`SKIP backup e2e: missing ${loaded.missing.join(', ')}`);
  process.exit(0);
}
const admin = createClient(loaded.env.SUPABASE_URL, loaded.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { transport: ws } });

const t = await start('backup');
const { page, ok, shot } = t;
const email = `e2e-backup-${Date.now()}@test.intentional.invalid`;
let userId = null;

const past = (daysAgo, mins, id) => {
  const d = new Date(Date.now() - daysAgo * 86400_000).toISOString();
  return { id, action_id: null, goal_id: 'g0', started_at: d, ended_at: d, duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: null };
};
const { db, settings } = makeDb({
  pillars: [['Body', '#D65A31', 'dumbbell'], ['Craft', '#A66A00', 'hammer']],
  sessions: [past(3, 30, 's1'), past(2, 45, 's2'), past(1, 25, 's3')],
  name: 'Jules',
});
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const serverCount = async (table) => (await admin.from(table).select('id', { count: 'exact', head: true }).eq('user_id', userId)).count;

await page.route('**/auth/v1/otp**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
async function signIn() {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await t.tap('Send me a code', 1500);
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(error.message);
  await page.getByLabel('Code', { exact: true }).fill(data.properties.email_otp);
  await t.tap('Sign in', 3000);
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 20000 });
}

try {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  userId = created.data.user.id;

  await t.goto('/');
  await t.wait(1500);
  await t.seed(db, settings);

  // ─── (a) first backup ───
  await t.goto('/account');
  await t.waitText('An account, if you want one', 30000);
  await signIn();
  await page.getByLabel(/^Last backup just now$/).waitFor({ timeout: 20000 });
  ok((await page.getByLabel('Last backup just now', { exact: true }).count()) === 1, 'a new account: the first backup ran by itself ("Last backup: just now")');
  ok((await serverCount('pillars')) === 2 && (await serverCount('sessions')) === 3, 'server holds 2 pillars and 3 sessions');
  const names = (await admin.from('backup_rows').select('id').eq('user_id', userId).eq('tbl', 'settings')).data?.map((r) => r.id) ?? [];
  ok(names.includes('user_name') && !names.includes('db_schema_version'), `settings backed up, device ones not (${names.join(',')})`);
  await t.wait(1200);
  ok(await t.has('On your account: 2 pillars, 3 sessions.'), 'the card shows what the account holds');
  await shot('backed-up');

  // ─── (b) a session → auto backup ───
  await t.goto('/focus?goalId=g0');
  await t.waitText('Free time · Body', 30000);
  await t.wait(600);
  await t.pick('Start focus', 1500);
  await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 15000 });
  await t.wait(2000);
  await t.tap('End focus session', 300);
  await t.wait(5500);
  await t.tap('End session', 1500);
  await t.waitText('Session ended early');
  let n = 0;
  for (let i = 0; i < 20 && n !== 4; i++) {
    await t.wait(1000);
    n = await serverCount('sessions');
  }
  ok(n === 4, `the session was backed up a few seconds later (server sessions: ${n})`);

  // ─── (c) a new phone ───
  const localSessions = (await readDb()).focus_sessions.length;
  await page.evaluate(() => localStorage.clear());
  await t.goto('/');
  await t.waitText('I already use Intentional', 30000);
  ok((await page.getByLabel('I already use Intentional', { exact: true }).count()) === 1, 'welcome screen: "I already use Intentional"');
  await shot('welcome-restore-link');
  await t.tap('I already use Intentional', 1500);
  await t.waitText('An account, if you want one', 20000);
  await signIn();
  await t.waitText('Your account has a backup: 2 pillars, 4 sessions.', 20000);
  ok(await t.has('Your account has a backup: 2 pillars, 4 sessions.'), 'new phone: the account offers its backup first');
  await shot('offer-restore');
  await t.tap('Restore my data', 4000);
  await t.waitText('Body', 20000);
  const d = await readDb();
  ok(d.meta_goals?.length === 2 && d.focus_sessions?.length === localSessions, `restored: 2 pillars, ${d.focus_sessions?.length}/${localSessions} sessions`);
  ok(page.url().includes('/today'), `restored: Today opens (${page.url()})`);
  const b = await t.body();
  ok(b.includes('Jules') && b.includes('Body'), 'Today greets Jules and shows Body (one "no goal yet" card at a time)');
  ok(b.includes('9h to Flame'), 'the restored lifetime hours (1h 40m) set Flick\'s stage line: "9h to Flame"');
  ok(!b.includes('Get started'), 'restored: no onboarding');
  await shot('restored-today');
} catch (e) {
  await shot('error').catch(() => {});
  console.log('BODY:', (await t.body().catch(() => '')).slice(0, 500).replace(/\n/g, ' | '));
  ok(false, `backup flow threw: ${e.message}`);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}
await t.finish();
