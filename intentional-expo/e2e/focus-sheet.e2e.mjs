/**
 * US-099 · Focus at the centre. The tab bar is Today · Goals · [Focus] · Insights · Settings; the big round
 * Focus button opens "Start focusing":
 *  (a) what: "Up next" pre-chosen (the timed habit), its length pre-selected; block apps shown on, with the
 *      web note (no Screen Time here);
 *  (b) Change → the goal's next step and free time per pillar; choosing the step pre-selects its estimate;
 *  (c) 15 min → Start → the running session on that task, 15:00 counting down, tab bar hidden; ending it
 *      saves a session on that task;
 *  (d) "More options" opens the full Focus screen; tapping outside closes the sheet.
 */
import { start, today } from './lib.mjs';

const t = await start('focus-sheet');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const now = new Date();
const at = (h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
await page.clock.install({ time: at(17, 30) });
await page.clock.resume();
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const isOn = async (l) => {
  const el = label(l).last();
  const aria = (await el.getAttribute('aria-selected')) ?? (await el.getAttribute('aria-checked'));
  const bg = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
  return aria === 'true' || bg === 'rgb(23, 20, 17)';
};

const createdAt = new Date(Date.now() - 10 * 86400000).toISOString();
const db = {
  meta_goals: [
    { id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 },
    { id: 'g1', name: 'Craft', color: '#A66A00', icon: 'hammer', sort_order: 1, why_statement: '', is_archived: 0 },
  ],
  daily_actions: [{ id: 'run', goal_id: 'g0', name: 'Run', type: 'session', target_minutes: 30, reminder_time: '18:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 0 }],
  objectives: [{ id: 'o1', pillar_id: 'g1', title: 'Ship the site', done_when: '', deadline: today(40), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: createdAt, closed_at: null, close_note: null }],
  tasks: [{ id: 't1', objective_id: 'o1', title: 'Write the home page', estimate_minutes: 45, planned_date: null, is_done: 0, done_at: null, sort_order: 0, created_at: createdAt }],
  focus_sessions: [],
  habit_completions: [],
  habit_skips: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }, { key: 'milestones_backfilled', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', milestones_backfilled: '1', flick_stage_seen: '0' };

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);
await t.goto('/today');
await label('Focus').waitFor({ timeout: 60000 });
await t.wait(1200);

// ── the tab bar ──
const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
ok(tabs.join('|') === 'Today|Goals|Block|Progress', `four tabs around the middle (${tabs.join(', ')})`);
const fb = await label('Focus').boundingBox();
const tb = await page.getByRole('tab', { name: 'Goals' }).boundingBox();
ok(fb && tb && Math.abs(fb.x + fb.width / 2 - 195) < 6 && fb.width >= 64 && fb.y < tb.y, `a big round Focus button in the middle, raised (${fb && Math.round(fb.width)} px)`);
await shot('tab-bar');

// ── (a) the sheet ──
await label('Focus').click();
await page.getByText('Start focusing').first().waitFor({ timeout: 10000 });
await t.wait(900);
ok(await has('Start focusing') && await has('Your time goes to one pillar.'), 'the sheet: "Start focusing"');
ok(await has('Run') && await has('Body · 18:00 · 30 min'), 'what: Up next pre-chosen (Run, Body, 18:00, 30 min)');
ok(await isOn('30 minutes'), 'how long: the habit\'s 30 minutes pre-selected');
for (const m of [15, 25, 45, 60, 90]) ok((await label(`${m} minutes`).count()) === 1, `a ${m} min chip`);
ok(await isOn('Block apps') && await has('Works in the iPhone app. Here the timer runs alone.'), 'block apps: shown on, with the web note');
ok(await has('Start · 30 min'), 'one big Start button with the length');
await shot('sheet');

// ── (b) change what ──
await label('Change what to focus on').click();
await t.wait(500);
ok((await label('Focus on Write the home page').count()) === 1 && (await label('Focus on Free time for Craft').count()) === 1 && (await label('Focus on Free time for Body').count()) === 1, 'choices: the goal\'s next step and free time per pillar');
await shot('sheet-choices');
await label('Focus on Write the home page').click();
await t.wait(500);
ok(await has('Next step · Ship the site') && await isOn('45 minutes'), 'the step chosen: its 45-minute estimate pre-selected');

// ── (c) 15 min → start ──
await label('15 minutes').click();
await t.wait(300);
ok(await has('Start · 15 min'), 'Start follows the chosen length');
await label('Start focusing now').click();
await page.waitForURL(/\/focus/, { timeout: 60000, waitUntil: 'commit' });
await page.getByLabel(/^1[45]:\d\d remaining$/).first().waitFor({ timeout: 20000 });
const remaining = await page.getByLabel(/^\d\d:\d\d remaining$/).first().getAttribute('aria-label');
ok(/^1[45]:\d\d remaining$/.test(remaining ?? ''), `the session is running: 15 minutes counting down (${remaining})`);
ok(await has('Write the home page'), 'on the chosen task');
ok((await page.getByRole('tab').count()) === 0 || !(await page.getByRole('tab', { name: 'Today' }).first().isVisible()), 'the tab bar hides while focusing');
await shot('running');
await page.clock.fastForward('02:00');
await t.wait(800);
await label('End focus session').click();
await t.wait(5800); // the "Leave now?" sheet locks "End anyway" for a few seconds
await label('End session anyway').click();
await t.waitText('Session ended early', 30000);
await t.wait(1000);
const s = (await readDb()).focus_sessions || [];
ok(s.length === 1 && s[0].task_id === 't1' && s[0].goal_id === 'g1' && s[0].duration_seconds >= 60, `ending it saves a session on that task (${JSON.stringify(s.map((x) => [x.task_id, x.goal_id, x.duration_seconds]))})`);

// ── (d) more options, close ──
await t.goto('/today');
await label('Focus').waitFor({ timeout: 60000 });
await t.wait(800);
await label('Focus').click();
await page.getByText('Start focusing').first().waitFor({ timeout: 10000 });
await t.wait(600);
await label('Close Start focusing').click({ position: { x: 20, y: 20 } });
await t.wait(600);
ok(!(await has('Your time goes to one pillar.')), 'tapping outside closes the sheet');
await label('Focus').click();
await page.getByText('Start focusing').first().waitFor({ timeout: 10000 });
await t.wait(600);
await label('More focus options').click();
await t.waitText('Pick where your next hour goes.', 30000);
ok(await has('Pick where your next hour goes.'), '"More options" opens the full Focus screen');

await t.finish();
