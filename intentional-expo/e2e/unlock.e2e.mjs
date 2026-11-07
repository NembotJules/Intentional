/**
 * US-096 · Unlock with intention, the founder's flow, on the web (a preview: web and Expo Go have no Screen Time,
 * so nothing is unlocked; the block screen, its buttons and the timed re-block are device checks).
 *  (a) The unlock screen opens on its own route (/unlock; on iPhone the block screen leads there). US-107 removed the
 *      "Unlocking early" section from the Block tab, so the test goes straight to /unlock.
 *  (b) 1/4 Flick, in his world, asks "Do you really need this app now?" in a bubble that types itself out →
 *      No → "Good choice" (Flick proud).
 *  US-100: the flow is a full-screen scene; Flick dims on "Yes" and is worried while he shows the pillars.
 *  (c) Yes → 2/4 "Before you open it": today's minutes (Craft 25 min, Body 0 min), goals, the next step, the habit
 *      still waiting today. "You're right, keep it blocked" → "Good choice".
 *  (d) I still want to open it → 3/4 "For how long?": 5–30 min only, nothing chosen for you.
 *  (e) 4/4 "Say it": Unlock stays off until the sentence is typed word for word → "Unlocked, on purpose".
 */
import { start, today } from './lib.mjs';

const t = await start('unlock');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const disabled = async (l) => (await label(l).last().getAttribute('aria-disabled')) === 'true';
const tap = async (l, wait = 700) => {
  await label(l).last().click();
  await t.wait(wait);
};

const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const db = {
  meta_goals: [
    { id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 },
    { id: 'g1', name: 'Craft', color: '#A66A00', icon: 'hammer', sort_order: 1, why_statement: '', is_archived: 0 },
  ],
  daily_actions: [{ id: 'h_gym', goal_id: 'g0', name: 'Gym', type: 'session', target_minutes: 60, reminder_time: '23:30', is_active: 1, sort_order: 0, objective_id: 'o0', days_mask: 127, strict: 1 }],
  objectives: [
    { id: 'o0', pillar_id: 'g0', title: 'Half marathon', done_when: '', deadline: today(60), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(86400000), closed_at: null, close_note: null },
    { id: 'o1', pillar_id: 'g1', title: 'Ship the app', done_when: '', deadline: today(30), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(86400000), closed_at: null, close_note: null },
  ],
  tasks: [{ id: 't0', objective_id: 'o1', title: 'Write the onboarding', estimate_minutes: 30, planned_date: null, is_done: 0, done_at: null, sort_order: 0, created_at: iso(5000) }],
  focus_sessions: [
    // 25 min for Craft, early today (just after midnight if it's very early, so it stays "today")
    { id: 's1', action_id: null, goal_id: 'g1', started_at: iso(Math.min(40 * 60000, Date.now() - new Date(new Date().setHours(0, 1, 0, 0)).getTime())), ended_at: null, duration_seconds: 1500, note: null, was_completed: 1, task_id: 't0', objective_id: 'o1' },
  ],
  habit_completions: [],
  habit_skips: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
db.focus_sessions[0].ended_at = new Date(Date.parse(db.focus_sessions[0].started_at) + 1500 * 1000).toISOString();
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '0', milestones_backfilled: '1' };

const openUnlock = async () => {
  await t.goto('/unlock');
  await page.getByText('Do you really need this app now?').last().waitFor({ timeout: 30000 });
};

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// ── (a) the entry ──
await t.goto('/block');
await t.waitText('Blocking now', 30000);
ok(!(await has('Unlocking early')) && !(await has('Try the unlock screen')), 'the Block tab has no "Unlocking early" section (US-107)');
// The question types itself out: sample the bubble while it types.
await t.goto('/unlock');
const q = 'Do you really need this app now?';
const seen = new Set();
for (let k = 0; k < 80; k++) {
  // The bubble's first line is what Flick has typed so far (its small second line comes after).
  const txt = ((await page.getByRole('heading', { name: `Flick asks: ${q}` }).last().innerText().catch(() => '')) || '').split('\n')[0].trim();
  if (txt) seen.add(txt);
  if (txt === q) break;
  await new Promise((r) => setTimeout(r, 40));
}
ok([...seen].some((x) => x.length > 0 && x.length < q.length && q.startsWith(x)) && seen.has(q), `Flick's question types itself out (${seen.size} steps seen)`);
await openUnlock();

// ── (b) step 1, No ──
ok((await page.getByLabel(/^Flick's world on the full screen, /).count()) === 1, 'the flow is a scene in Flick\'s world');
ok((await page.getByRole('heading', { name: 'Flick asks: Do you really need this app now?' }).count()) === 1, 'Flick asks the question in his bubble');
ok((await label('Step 1 of 4').count()) === 1 && (await has('Preview: on our iPhone build')), 'step 1 of 4, with the preview notice');
ok((await label('No, keep it blocked').count()) === 1 && (await label('Yes, I need it').count()) === 1, 'two answers: "No, keep it blocked" and "Yes, I need it"');
ok(!(await has('For how long?')) && (await label('Unlock for 5 minutes').count()) === 0, 'the time isn\'t offered yet');
await shot('ask');
await tap('No, keep it blocked', 300);
await page.getByText('Your hours stay where you chose.').last().waitFor({ timeout: 10000 });
ok(await has('Good choice') && (await has('Your hours stay where you chose.')), 'No → "Good choice"');
ok((await label('Flick, proud').count()) === 1, 'Flick is proud');
await shot('kept');

// ── (c) step 2, the pillars ──
await openUnlock();
await tap('Yes, I need it', 120);
ok((await label('Flick, sad').count()) === 1, '"Yes" → Flick dims, a little sad, for a beat');
await page.getByText('Today you gave your pillars 25 min.').last().waitFor({ timeout: 10000 });
ok((await label('Flick, worried').count()) === 1, 'then he\'s worried while he shows the pillars');
ok((await label('Step 2 of 4').count()) === 1 && (await has('Before you open it')), 'Yes → step 2 of 4, "Before you open it"');
ok(await has('Today you gave your pillars 25 min.'), 'the headline: what today got (25 min)');
ok((await label('Body: 0 min today').count()) === 1 && (await label('Craft: 25 min today').count()) === 1, 'each pillar\'s minutes today: Body 0 min, Craft 25 min');
const body2 = await t.body();
ok(body2.includes('Half marathon') && body2.includes('Ship the app'), 'each pillar\'s goal');
ok(body2.includes('Next step: Write the onboarding'), 'the next step of the goal');
ok(body2.includes('Still waiting today: Gym (23:30)'), 'the habit still waiting today');
ok(!(await has('For how long?')), 'still no time offered');
await shot('remind');
await tap('You’re right, keep it blocked', 300);
await page.getByText('Good choice!').last().waitFor({ timeout: 10000 });
ok(await has('Good choice'), '"You\'re right, keep it blocked" → "Good choice"');

// ── (d) step 3, how long ──
await openUnlock();
await tap('Yes, I need it', 300);
await page.getByText('Today you gave your pillars 25 min.').last().waitFor({ timeout: 10000 });
await tap('I still want to open it', 1200);
await page.getByText('For how long?').last().waitFor({ timeout: 10000 });
ok((await label('Step 3 of 4').count()) === 1 && (await has('30 minutes at most')), 'step 3 of 4: "For how long?", 30 minutes at most');
for (const m of [5, 10, 15, 20, 30]) ok((await label(`Unlock for ${m} minutes`).count()) === 1, `a ${m} min choice`);
ok((await label('Unlock for 45 minutes').count()) === 0 && (await label('Unlock for 60 minutes').count()) === 0, 'nothing longer than 30 min');
ok(await disabled('Choose a time first'), 'nothing chosen for you: Continue waits');
await tap('Unlock for 30 minutes', 500);
ok(!(await disabled('Continue with 30 min')), 'choosing 30 min → "Continue with 30 min"');
await shot('duration');
await tap('Continue with 30 min', 1200);

// ── (e) step 4, say it ──
await page.getByText('Say it').last().waitFor({ timeout: 10000 });
ok((await label('Step 4 of 4').count()) === 1, 'step 4 of 4: "Say it"');
ok((await label('Sentence: I choose my phone over Body for 30 minutes.').count()) === 1, 'the sentence names the pillar and the 30 minutes');
ok(await disabled('Unlock for 30 min'), 'empty: Unlock is off');
await label('Type the sentence').fill('I choose my phone over Craft for 30 minutes.');
await t.wait(300);
ok(await disabled('Unlock for 30 min') && (await has('Not quite: check the words.')), 'a wrong word: Unlock stays off, "Not quite"');
await label('Type the sentence').fill('i choose my phone over body for 30 minutes');
await t.wait(300);
ok(!(await disabled('Unlock for 30 min')) && (await has('That’s it.')), 'typed right (any case, no full stop): Unlock is on');
await shot('typed');
await tap('Unlock for 30 min', 1200);
await page.getByText('then block again on their own').last().waitFor({ timeout: 10000 });
ok(await has('Unlocked, on purpose'), '"Unlocked, on purpose"');
ok(await has('your apps would open now for 30 minutes, then block again on their own'), 'preview: the apps would open for 30 minutes, then block again');
await shot('unlocked');

await t.finish();
