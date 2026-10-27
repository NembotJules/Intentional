/**
 * Year in Hours (US-086).
 *
 *  (a) Dec 20 of this year (browser clock): Today offers "Your <year> in hours"; the story runs through every slide
 *      (intro, total, where it went, best month, longest streak, goals, Flick's path, the card), shares, and is marked seen.
 *  (b) Jan 10 of next year: still the same year's story (Dec 1 → Jan 15 window).
 *  (c) Any other day: Insights offers "Your year so far".
 * All dates come from the current year, so the suite never expires.
 */
import { start } from './lib.mjs';

const t = await start('year');
const { page, ok, has, shot } = t;

const Y = new Date().getFullYear();
const at = (year, m, d, h = 9) => new Date(year, m, d, h, 0, 0).toISOString();
const pillars = [
  ['g0', 'Body', '#D65A31', 'body'],
  ['g1', 'Craft', '#A66A00', 'craft'],
  ['g2', 'Mind', '#4C6FFF', 'mind'],
];
const session = (id, goal, mins, startedAt, objective = null) => ({ id, action_id: null, goal_id: goal, started_at: startedAt, ended_at: startedAt, duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: objective });

// Last year: 12h (Flick starts the year as a Flame).
const sessions = [0, 1, 2, 3, 4, 5].map((k) => session('old' + k, 'g0', 120, at(Y - 1, 6, 1 + k)));
// This year: Body every day Mar 1 → Mar 21 (21-day run, 2h each = 42h), Craft 3h × 10 in October (30h, best month is March),
// Mind 1h × 5 in June, and Dec 31 23:30 last year doesn't count. Total = 42 + 30 + 5 = 77h → lifetime 89h = Torch.
for (let d = 1; d <= 21; d++) sessions.push(session('b' + d, 'g0', 120, at(Y, 2, d, 7)));
for (let k = 0; k < 10; k++) sessions.push(session('c' + k, 'g1', 180, at(Y, 9, 2 + k * 2, 14), 'o1'));
for (let k = 0; k < 5; k++) sessions.push(session('m' + k, 'g2', 60, at(Y, 5, 3 + k * 4, 21)));
sessions.push(session('nye', 'g2', 60, new Date(Y - 1, 11, 31, 23, 30).toISOString()));

const db = {
  meta_goals: pillars.map(([id, name, color, icon], k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 })),
  daily_actions: [],
  focus_sessions: sessions,
  habit_completions: [],
  habit_skips: [],
  objectives: [
    { id: 'o1', pillar_id: 'g1', title: 'Ship the portfolio site', done_when: '', deadline: `${Y}-12-31`, status: 'completed', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: at(Y, 8, 1), closed_at: at(Y, 9, 25), close_note: null },
  ],
  tasks: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
// Stage already seen and milestones never checked (silent backfill), so no celebration covers the story.
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '2' }; // milestones: first check backfills silently
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const cont = async () => {
  await t.tap('Continue', 1600);
};

// ── (a) December 20: the year's story ──
await page.clock.install({ time: new Date(Y, 11, 20, 10, 0, 0) });
await page.clock.resume();
await t.goto('/');
await page.waitForTimeout(2000);
await t.seed(db, settings);
await t.goto('/today');
await t.waitText(`Your ${Y} in hours`, 240000);
await page.waitForTimeout(1200);
ok(await has(`Your ${Y} in hours`) && await has('77h given this year'), `Today: "Your ${Y} in hours" card with the total`);
await shot('today-card');
await t.tap(`Open your ${Y} in hours`, 2500);

ok(await has(`${Y}`) && await has('Show me'), 'intro: the year and "Show me"');
await page.waitForTimeout(1500);
ok(await has(`Alex, this is your ${Y} in hours.`), 'intro: typed line with the name');
await shot('1-intro');
await t.tap('Show me', 1600);

ok(await has(`In ${Y} you gave`) && await has('77h') && await has('to the life you chose'), 'total: 77h (last year and Dec 31 of last year excluded)');
await page.waitForTimeout(1500);
ok(await has('36 sessions, on 36 days.'), 'total: sessions and days');
ok(await has('Your biggest day: Oct 2, 3h.'), 'total: biggest day (first of the 3h October days)');
await shot('2-total');
await cont();

await page.waitForTimeout(1200);
ok(await has('Most of it went to Body.') && await has('42h · 55% of your year'), 'pillars: Body first, 42h · 55%');
ok(await has('Craft') && await has('30h') && await has('Mind') && await has('5h'), 'pillars: every pillar with its hours');
await shot('3-pillars');
await cont();

await page.waitForTimeout(1200);
ok(await has('March was your biggest month.') && await has('42h that month'), 'months: March is the best month');
await shot('4-months');
await cont();

await page.waitForTimeout(1500);
ok(await has('Your longest run') && await has('21') && await has('days in a row with time for your life.'), 'streak: 21 days');
ok(await has('Mar 1 – Mar 21'), 'streak: its dates');
await shot('5-streak');
await cont();

await page.waitForTimeout(1200);
ok(await has('You achieved a goal.') && await has('Ship the portfolio site') && await has('30h given'), 'goals: the achieved goal with its hours');
await shot('6-goals');
await cont();

await page.waitForTimeout(2200);
ok(await has('Flick grew from a Flame to a Torch.'), "flick: grew from a Flame to a Torch (12h → 89h)");
await shot('7-flick');
await cont();

ok(await has(`Your ${Y} in hours`) && await has('given to the life I chose') && await has(`${Y} in hours`), 'card: the year card');
ok(await has('Flick: Torch') && await has('Best month: March') && await has("Alex's year"), 'card: stage, best month, name');
await shot('8-card');
const w = await page.evaluate(() => document.documentElement.scrollWidth);
ok(w <= 390, `card: no horizontal overflow (${w})`);
await t.tap('Share your year', 1200);
ok(await has('Share your year') && await has('Hours only. No task names.'), 'share sheet opens with the card');
await shot('9-share');
await t.tap('Close share', 800);
ok((await readSettings())[`year_story_seen:${Y}`] === '1', 'story marked seen for the year');
await t.tap('Done', 1500);

await t.goto('/today');
await t.waitText('Good', 240000);
await page.waitForTimeout(1500);
ok(!(await has(`Open your ${Y} in hours`)), 'Today: the card is gone once seen');

// ── (b) January 10 next year: still that year's story ──
const ctxPage = page;
await ctxPage.clock.setSystemTime(new Date(Y + 1, 0, 10, 10, 0, 0));
await t.goto('/insights');
await t.waitText(`Your ${Y} in hours`, 240000);
ok(await has(`Your ${Y} in hours`), `Jan 10: Insights offers "Your ${Y} in hours"`);
await t.tap(`Open your ${Y} in hours`, 2500);
await t.tap('Show me', 1600);
ok(await has(`In ${Y} you gave`) && await has('77h'), `Jan 10: the story is about ${Y}`);

// ── (c) Any other day: "Your year so far" ──
await ctxPage.clock.setSystemTime(new Date(Y, 10, 5, 10, 0, 0));
await t.goto('/insights');
await t.waitText('Your year so far', 240000);
await shot('insights-so-far');
await t.tap('Open your year so far', 2500);
await page.waitForTimeout(1500);
ok(await has('Alex, this is your year so far.'), 'Nov 5: "Your year so far" story');
await t.tap('Show me', 1600);
ok(await has('This year you gave') && await has('77h'), 'Nov 5: "This year you gave" 77h (every session is before Nov 5)');

await t.finish();
