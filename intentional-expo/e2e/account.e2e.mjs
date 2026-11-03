/**
 * US-088 · Accounts, against the live Supabase project (web).
 * The email itself can't be read here, so only the "send the email" request (POST /auth/v1/otp) is answered by the test;
 * the code is a real one from the admin API (generateLink → email_otp) and the app verifies it against Supabase.
 *   (a) Settings → Account → email → code → signed in; the profile row is created from the onboarding name (server).
 *   (b) the session survives a reload; renaming updates the profile.
 *   (c) a wrong code shows plain words; sign out keeps local data and the server account; signing in again keeps the name.
 *   (d) Delete account removes the auth user and the profile; local data stays.
 * Skips with a message when the Supabase admin env is missing (the app's own .env must be set for the dev server).
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { start, makeDb } from './lib.mjs';
import { loadAdminEnv } from '../scripts/supabase-env.mjs';

const loaded = loadAdminEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
if (loaded.missing) {
  console.log(`SKIP account e2e: missing ${loaded.missing.join(', ')}`);
  console.log('RESULT account: 0 passed, 0 failed (skipped)');
  process.exit(0);
}
const admin = createClient(loaded.env.SUPABASE_URL, loaded.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const t = await start('account');
const { page, ok, shot } = t;
const email = `e2e-account-${Date.now()}@test.intentional.invalid`;
let userId = null;

const { db, settings } = makeDb({ pillars: [['Body', '#D65A31', 'dumbbell'], ['Craft', '#A66A00', 'hammer']], name: 'Jules' });
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const profile = async () => (userId ? (await admin.from('profiles').select('*').eq('id', userId).maybeSingle()).data : null);

// Answer only the "email me a code" request; record what the app asked for.
const otpRequests = [];
await page.route('**/auth/v1/otp**', async (route) => {
  otpRequests.push(JSON.parse(route.request().postData() || '{}'));
  await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
async function realCode() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  userId = data.user.id;
  return data.properties.email_otp;
}

try {
  // The account exists server-side (what signInWithOtp would have created); confirmed, no password.
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(`createUser: ${created.error.message}`);
  userId = created.data.user.id;

  await t.goto('/');
  await t.wait(1500);
  await t.seed(db, settings);

  // ─── (a) sign in from Settings ───
  await t.goto('/settings');
  await page.getByLabel('Account', { exact: true }).waitFor({ timeout: 30000 });
  ok((await page.getByLabel('Account', { exact: true }).count()) === 1 && (await t.has('Optional. Sign in with your email.')), 'Settings shows the Account row, signed out (cloud configured)');
  await t.tap('Account', 1200);
  await t.waitText('An account, if you want one');
  await shot('signed-out');
  ok((await page.getByLabel('Send me a code', { exact: true }).getAttribute('aria-disabled')) === 'true', 'Send is disabled before an email');
  await page.getByLabel('Email', { exact: true }).fill(`  ${email.toUpperCase()} `);
  await t.tap('Send me a code', 1500);
  ok(otpRequests.length === 1 && otpRequests[0].email === email, `the app asked Supabase for a code for the normalized email (${otpRequests[0]?.email})`);
  ok(await t.has(`We sent a code to ${email}.`), 'code step: "We sent a code to …"');
  await shot('code-step');

  // Wrong code first.
  await page.getByLabel('Code', { exact: true }).fill('0000 0000');
  await t.tap('Sign in', 2500);
  ok(await t.has('That code didn’t work. Check it, or send a new one.'), 'a wrong code: plain words');
  ok(!(await t.has('Signed in as')), 'a wrong code: still signed out');

  const code = await realCode();
  ok(/^\d{8}$/.test(code), 'the project sends 8-digit codes');
  await page.getByLabel('Code', { exact: true }).fill(code);
  await t.tap('Sign in', 3000);
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 15000 });
  ok((await page.getByLabel(`Signed in as ${email}`, { exact: true }).count()) === 1, 'signed in as the email');
  await t.wait(1500);
  let p = await profile();
  ok(p?.display_name === 'Jules', `profile created on the server from the onboarding name (${p?.display_name})`);
  ok(p?.flick_stage === 0, 'profile carries Flick\'s stage (Spark, 0)');
  ok((await page.getByLabel('Account name', { exact: true }).inputValue()) === 'Jules', 'right after the first sign-in the name field shows "Jules"');
  await shot('signed-in');
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw <= iw, `account: no horizontal scroll (${sw}/${iw})`);

  // ─── (b) reload keeps the session; rename ───
  await t.goto('/account');
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 20000 });
  ok(await t.has(email), 'the session survives a reload');
  await t.wait(1200);
  ok((await page.getByLabel('Account name', { exact: true }).inputValue()) === 'Jules', 'the name field shows the profile name');
  await page.getByLabel('Account name', { exact: true }).fill('Jules N.');
  await page.getByLabel('Account name', { exact: true }).press('Enter');
  await t.wait(2000);
  p = await profile();
  ok(p?.display_name === 'Jules N.', `rename saved on the server (${p?.display_name})`);
  await t.goto('/settings');
  await page.getByLabel('Account', { exact: true }).waitFor({ timeout: 20000 });
  ok(await t.has(email), 'Settings shows who is signed in');
  await shot('settings-signed-in');

  // ─── (c) sign out keeps local data and the account; signing in again keeps the name ───
  await t.tap('Account', 1500);
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 15000 });
  await t.tap('Sign out', 2500);
  await t.waitText('An account, if you want one', 15000);
  let d = await readDb();
  ok(d.meta_goals?.length === 2, `sign out: local pillars still here (${d.meta_goals?.length})`);
  const still = await admin.auth.admin.getUserById(userId);
  ok(!!still.data?.user, 'sign out: the server account still exists');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await t.tap('Send me a code', 1500);
  await page.getByLabel('Code', { exact: true }).fill(await realCode());
  await t.tap('Sign in', 3000);
  await page.getByLabel(/^Signed in as /).first().waitFor({ timeout: 15000 });
  await t.wait(1200);
  p = await profile();
  ok(p?.display_name === 'Jules N.', `signing in again keeps the chosen name (${p?.display_name})`);

  // ─── (d) delete account ───
  await t.tap('Delete account', 3500);
  await t.waitText('Your account is deleted. Everything on this phone is still here.', 15000);
  ok(await t.has('An account, if you want one'), 'after delete: signed out');
  await shot('deleted');
  const gone = await admin.auth.admin.getUserById(userId);
  ok(!gone.data?.user, 'delete: the auth user is gone');
  ok((await profile()) === null, 'delete: the profile row is gone (cascade)');
  d = await readDb();
  ok(d.meta_goals?.length === 2 && (d.settings ?? []).some((s) => s.key === 'user_name'), 'delete: local data stays');
} catch (e) {
  await shot('error').catch(() => {});
  console.log('BODY:', (await t.body().catch(() => '')).slice(0, 600).replace(/\n/g, ' | '));
  ok(false, `account flow threw: ${e.message}`);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {});
}

await t.finish();
