/**
 * Today, built around the goals model (US-065 · US-067 · US-069 · US-070 · US-074), in the US-098 layout
 * (pillar rows that open; one "Up next" card):
 * goal line inside its pillar row (tasks stay inside the goal: founder 2026-10-30), one shared N-of-M definition
 * (habits only: the "Habits done" tile = the sum of the rows), schedule-aware habits with "7:00 · 30 min", a single
 * "in X min", "Up next" (the next habit by time → focus), the free-session pillar picker, and "Set a goal" inside
 * the rows of goal-less pillars (no separate nudge on Today).
 * Every check reads the screen or the web DB (localStorage intentional_db_v2).
 */
import { start, today } from './lib.mjs';

const t = await start('today-plan');
const { page, ok, shot } = t;

const DAY = today(0);
const weekdayShort = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
};
// days_mask bit 0 = Monday … bit 6 = Sunday
const bitFor = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return 1 << (dow === 0 ? 6 : dow - 1);
};
const pad = (x) => String(x).padStart(2, '0');
const hhmmIn = (mins) => {
  const d = new Date(Date.now() + mins * 60000);
  return { key: today(0) === `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, hhmm: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
const soon1 = hhmmIn(30);
const soon2 = hhmmIn(60);
const soonFeasible = soon1.key && soon2.key; // both still today (not crossing midnight)

const createdAt = new Date(Date.now() - 30 * 86400000).toISOString();
const yesterdayIso = new Date(Date.now() - 86400000).toISOString();

const pillar = (id, name, color, icon, k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 });
const habit = (id, goal, name, extra = {}) => ({
  id, goal_id: goal, name, type: 'session', target_minutes: 30, reminder_time: null, is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, ...extra,
});
const task = (id, title, sort, extra = {}) => ({
  id, objective_id: 'o1', title, estimate_minutes: 45, planned_date: null, is_done: 0, done_at: null, sort_order: sort, created_at: createdAt, ...extra,
});

const db = {
  meta_goals: [
    pillar('g0', 'Family', '#E5484D', 'heart', 0), // maintenance: never nudged
    pillar('g1', 'Body', '#D65A31', 'dumbbell', 1), // active goal
    pillar('g2', 'Craft', '#A66A00', 'hammer', 2), // first nudge
    pillar('g3', 'Mind', '#4C6FFF', 'brain', 3), // next nudge after "Not now"
  ],
  objectives: [
    {
      id: 'o1', pillar_id: 'g1', title: 'Half marathon', done_when: 'I finish 21 km', deadline: today(38), status: 'active',
      metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: createdAt, closed_at: null, close_note: null,
    },
  ],
  tasks: [
    task('t1', 'Buy running shoes', 0),
    task('t2', 'Sign up for the race', 1),
    task('t3', 'Old finished errand', 2, { is_done: 1, planned_date: today(-1), done_at: yesterdayIso }),
    task('t4', 'Plan the long route', 3, { planned_date: today(-2) }),
  ],
  daily_actions: [
    habit('h1', 'g1', 'Run 30 min', { reminder_time: '07:00', sort_order: 0 }),
    habit('h2', 'g1', 'Stretch', { type: 'habit', target_minutes: 10, sort_order: 1 }),
    habit('h3', 'g1', 'Swim on another day', { days_mask: bitFor(today(1)), sort_order: 2 }),
    habit('h4', 'g2', 'Write later', { reminder_time: soon2.hhmm, target_minutes: 20, sort_order: 0 }),
    habit('h5', 'g2', 'Sketch soon', { reminder_time: soon1.hhmm, target_minutes: 20, sort_order: 1 }),
    habit('h6', 'g0', 'Call home', { type: 'habit', target_minutes: 15 }),
    habit('h7', 'g3', 'Read', { target_minutes: 20 }),
  ],
  habit_completions: [{ id: 'c1', action_id: 'h2', date: DAY, completed: 1 }],
  focus_sessions: [],
  weekly_reviews: [],
  settings: [
    { key: 'user_name', value: 'Alex' },
    { key: 'hasCompletedOnboarding', value: '1' },
    { key: 'maintenance_pillars', value: JSON.stringify(['g0']) },
  ],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1' };

// Focus / goal detail consume their params and clear them (router.setParams), so record every URL visited.
const visited = [];
page.on('framenavigated', (f) => {
  if (f === page.mainFrame()) visited.push(f.url());
});
const sawUrl = (re) => visited.some((u) => re.test(u));

const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const taskRow = async (id) => ((await readDb()).tasks || []).find((x) => x.id === id);
const headerCounts = () =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label]')) {
      const m = /^Habits done: (\d+) of (\d+)$/.exec(el.getAttribute('aria-label'));
      if (m) return [Number(m[1]), Number(m[2])];
    }
    return null;
  });
/** US-098: pillar rows start closed; open one by its "Body, 1 of 2 done" label (or its bare name). */
const openRow = async (re) => {
  const el = page.getByLabel(re).first();
  if ((await el.getAttribute('aria-expanded')) !== 'true') await el.click();
  await t.wait(500);
};
/** Sum of the per-pillar badges, read from their "Body, 1 of 4 done" labels. */
const badgeSum = () =>
  page.evaluate(() => {
    let d = 0;
    let n = 0;
    for (const el of document.querySelectorAll('[aria-label]')) {
      const m = /^(.+), (\d+) of (\d+) done$/.exec(el.getAttribute('aria-label'));
      if (m) {
        d += Number(m[2]);
        n += Number(m[3]);
      }
    }
    return [d, n];
  });
const countText = (re) => t.body().then((b) => (b.match(re) || []).length);
const nextCardText = () => page.getByText('NEXT', { exact: true }).first().locator('xpath=../..').innerText();

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);
await t.goto('/today');
await page.getByLabel(/^Body, \d+ of \d+ done$/).first().waitFor({ timeout: 60000 });
await t.wait(1200);
await shot('top');
ok((await page.getByText('Half marathon').count()) === 0, 'closed rows: the goal line waits inside Body');
for (const re of [/^Body, /, /^Craft, /, /^Family, /, /^Mind, /]) await openRow(re);
await page.getByText('Half marathon').first().waitFor();

const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(sw <= iw, `no horizontal scroll (${sw}/${iw})`);

// ── US-065 goal line ─────────────────────────────────────────────────
let b = await t.body();
ok(b.includes('Half marathon'), 'goal line shows the goal title');
ok(b.includes('38 days left'), 'goal line shows "38 days left"');
ok(/\bbehind\b/.test(b), 'goal line shows the pace word ("behind": 1 of 4 tasks after 30 of 68 days)');
ok(!/unknown/i.test(b) && !/overdue/i.test(b), 'no "unknown" pace and no "overdue" wording');
const paceColor = await page.getByText('behind', { exact: true }).first().evaluate((el) => getComputedStyle(el).color);
ok(paceColor === 'rgb(185, 138, 62)', `"behind" uses Accent.amber (${paceColor})`);

// ── tasks stay inside the goal (spec change 2026-10-30: no task cards on Today) ──
ok(!b.includes('Buy running shoes') && !b.includes('Sign up for the race') && !b.includes('Plan the long route'), 'no task appears on Today');
ok((await page.getByLabel('Start Buy running shoes', { exact: true }).count()) === 0 && (await page.getByLabel(/^Up next: Buy running shoes/).count()) === 0, 'no task ▶ and the task is not "Up next" while habits are due');
ok(b.includes('3 steps'), 'the goal line says "3 steps" (open tasks inside the goal)');
await page.getByText('Half marathon').first().scrollIntoViewIfNeeded();
await page.mouse.wheel(0, 200);
await t.wait(500);
await shot('goal-line');
await page.mouse.wheel(0, -3000);
await t.wait(300);

// ── US-069 habits ────────────────────────────────────────────────────
ok(b.includes('7:00 · 30 min'), 'timed habit shows "7:00 · 30 min"');
ok(b.includes('Anytime · 20 min'), 'habit with no start time shows "Anytime · 20 min"');
ok(!b.includes('Swim on another day'), 'habit scheduled only on another weekday is hidden');
const inCount = await countText(/· in \d+ min/g);
if (soonFeasible) {
  ok(inCount === 1, `exactly one "in X min" label (found ${inCount})`);
  // The next upcoming habit is the earliest start still ahead (07:00 Run may beat "Sketch soon").
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const cands = [['Run 30 min', '07:00'], ['Sketch soon', soon1.hhmm], ['Write later', soon2.hhmm]]
    .map(([n, s]) => [n, toMin(s) - nowMin])
    .filter(([, d]) => d > 0 && d <= 120)
    .sort((a, b) => a[1] - b[1]);
  const expected = cands[0][0];
  const row = await page.getByLabel(`Start ${expected}`, { exact: true }).innerText();
  ok(/· in \d+ min/.test(row), `"in X min" sits on the next upcoming habit ("${expected}"): ${row.replace(/\n/g, ' ')}`);
} else {
  ok(inCount <= 1, `near midnight: at most one "in X min" label (found ${inCount})`);
}
const craftText = await page.getByLabel('Start Write later', { exact: true }).innerText();
ok(!/in \d+ min/.test(craftText), 'the later habit ("Write later", +60 min) does not get its own "in X min"');

// ── US-098 Up next: the next habit by start time, one tap to focus ──
if (soonFeasible) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const toMin = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const upNames = [['Run 30 min', '07:00'], ['Sketch soon', soon1.hhmm], ['Write later', soon2.hhmm]]
    .map(([n, s]) => [n, toMin(s)])
    .filter(([, m]) => m >= nowMin - 30)
    .sort((a, b) => a[1] - b[1]);
  const expectedUp = upNames[0][0];
  ok((await page.getByLabel(new RegExp(`^Up next: ${expectedUp}, `)).count()) === 1, `"Up next" is the next habit by time ("${expectedUp}")`);
}

// ── US-065/069 one N-of-M definition (habits only) ──────────────────
// Body: Run + Stretch(done) = 1/2 · Craft 0/2 · Family 0/1 · Mind 0/1
let hc = await headerCounts();
let bs = await badgeSum();
ok(hc && hc[0] === 1 && hc[1] === 6, `"Habits done" tile reads 1 of 6 (got ${hc})`);
ok(hc && bs[0] === hc[0] && bs[1] === hc[1], `the tile equals the sum of pillar row badges (${bs})`);
ok(await page.getByLabel('Body, 1 of 2 done', { exact: true }).count() === 1, 'Body badge 1/2 (unscheduled Swim and tasks not counted)');

// ── every habit belongs to a goal (founder 2026-10-30) ──────────────
// Run had no goal: it joined Body's active goal on load; Craft, Family and Mind have no goal, so their habits wait in a card.
b = await t.body();
ok((((await readDb()).daily_actions || []).find((a) => a.id === 'h1') || {}).objective_id === 'o1', 'a habit with no goal joins its pillar\'s active goal (DB)');
ok(!b.includes('Also for') && !b.includes('count toward Half marathon?'), 'no "Also for" list and no "does it count?" question');
ok((b.match(/No goal running\. These habits wait for one\./g) || []).length === 3, 'Craft, Family and Mind (opened): their habits wait for a goal, said once inside each row');
await page.getByText('Half marathon').first().scrollIntoViewIfNeeded();
await page.mouse.wheel(0, 200);
await t.wait(500);
await shot('goal-card-with-habit');
await page.mouse.wheel(0, -3000);
await t.wait(300);

// ── the goal line opens the goal, where the tasks are ────────────────
await page.getByLabel('Goal: Half marathon, 38 days left, behind, 3 steps left', { exact: true }).click();
await page.waitForURL(/\/objective\/o1/, { timeout: 60000, waitUntil: 'commit' });
await page.getByText('Buy running shoes').first().waitFor({ timeout: 60000 });
await t.wait(800);
await shot('goal-from-today');
b = await t.body();
ok(b.includes('Buy running shoes') && b.includes('Plan the long route'), 'the goal screen lists its tasks');
await t.goto('/today');
await page.getByLabel(/^Body, \d+ of \d+ done$/).first().waitFor({ timeout: 60000 });
await t.wait(1200);
for (const re of [/^Body, /, /^Craft, /, /^Family, /, /^Mind, /]) await openRow(re);
await page.getByText('Half marathon').first().waitFor();

// ── US-074: goal-less pillars ask inside their own row (no separate nudge) ──
b = await t.body();
ok(!b.includes('has no goal yet. What would winning look like?'), 'no separate nudge on Today (goal nudges live on the Goals tab)');
ok(await page.getByLabel('Set a goal for Family', { exact: true }).count() === 1, 'Family (was "runs on habits") is asked too');
await page.getByText('Craft', { exact: true }).last().scrollIntoViewIfNeeded();
await shot('nudge');

// ── US-070 free session picker ───────────────────────────────────────
await page.mouse.wheel(0, -3000);
await t.wait(300);
await page.getByLabel('Free session', { exact: true }).click();
await page.getByText('Give time to which pillar?').waitFor();
await t.wait(400);
await shot('free-session-picker');
ok(await page.getByLabel('Free session for Craft', { exact: true }).count() === 1 && (await page.getByLabel('Free session for Family', { exact: true }).count()) === 1, 'picker lists the pillars');
await page.getByLabel('Free session for Craft', { exact: true }).click();
await page.waitForURL(/\/focus/, { timeout: 60000, waitUntil: 'commit' });
await t.wait(1500);
await shot('after-free-session');
ok(sawUrl(/\/focus\?(.*&)?goalId=g2(&|$)/), `free session lands on /focus?goalId=g2 (visited: ${visited.filter((u) => u.includes('focus')).join(', ')})`);

// ── US-098 Up next → focus ──────────────────────────────────────────
await t.goto('/today');
await page.getByLabel(/^Up next: /).first().waitFor({ timeout: 60000 });
const upLabel = await page.getByLabel(/^Start up next: /).first().getAttribute('aria-label');
await page.getByLabel(/^Start up next: /).first().click();
await page.waitForURL(/\/focus/, { timeout: 60000, waitUntil: 'commit' });
await t.wait(1200);
const upId = { 'Run 30 min': 'h1', 'Sketch soon': 'h5', 'Write later': 'h4', Read: 'h7' }[upLabel.replace('Start up next: ', '')];
ok(!!upId && sawUrl(new RegExp(`/focus\\?(.*&)?actionId=${upId}(&|$)`)), `"Up next" ▶ opens focus on that habit (${upLabel})`);

// ── "Set a goal" action ──────────────────────────────────────────────
await t.goto('/today');
await page.getByLabel(/^Mind, /).first().waitFor({ timeout: 60000 });
await openRow(/^Mind, /);
await page.getByLabel('Set a goal for Mind', { exact: true }).waitFor();
await page.getByLabel('Set a goal for Mind', { exact: true }).click();
await page.waitForURL(/\/goal\/g3/, { timeout: 60000, waitUntil: 'commit' });
await t.wait(1500);
await shot('after-set-goal');
ok(sawUrl(/\/goal\/g3\?setGoal=1/), `"Set a goal" opens /goal/g3?setGoal=1 (visited: ${visited.filter((u) => u.includes('/goal/')).join(', ')})`);

// ── A pillar with a goal and no habit today: the goal line, no tasks, no 0/0 badge ──
const db2 = JSON.parse(JSON.stringify(db));
db2.daily_actions = db2.daily_actions.filter((a) => a.goal_id !== 'g1');
db2.tasks = [task('t1', 'Only task', 0)];
db2.habit_completions = [];
await t.seed(db2, settings);
await t.goto('/today');
await page.getByLabel('Body', { exact: true }).first().waitFor({ timeout: 60000 });
await t.wait(1000);
ok((await t.body()).includes('Half marathon'), 'goal-only pillar: its row names the goal');
await openRow(/^Body$/);
b = await t.body();
ok((await page.getByLabel('Goal: Half marathon, 38 days left, behind, 1 step left', { exact: true }).count()) === 1, 'goal-only pillar: opens to its goal line ("1 step left")');
ok(!b.includes('Only task'), 'goal-only pillar: its task is not on Today');
ok(!b.includes('0/0'), 'no "0/0" badge on a pillar with nothing due today');
await shot('goal-only-pillar');

// ── No habit left anywhere: "Up next" is the goal's next step ──
const db3 = JSON.parse(JSON.stringify(db2));
db3.daily_actions = [];
await t.seed(db3, settings);
await t.goto('/today');
await page.getByLabel(/^Up next: /).first().waitFor({ timeout: 60000 });
ok((await page.getByLabel('Up next: Only task, Next step · Half marathon', { exact: true }).count()) === 1, 'no habit due: "Up next" is the goal\'s next step');
await page.getByLabel('Start up next: Only task', { exact: true }).click();
await page.waitForURL(/\/focus/, { timeout: 60000, waitUntil: 'commit' });
await t.wait(1200);
ok(sawUrl(/\/focus\?(.*&)?taskId=t1(&|$)/), 'the step\'s ▶ opens focus on that task');

await t.finish();
