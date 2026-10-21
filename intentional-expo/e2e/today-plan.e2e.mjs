/**
 * Today, built around the goals model (US-065 · US-067 · US-069 · US-070 · US-074):
 * goal line, next task (check off → the following task), rollover "from <day>" + Do today,
 * one shared N-of-M definition, schedule-aware habits with "7:00 · 30 min", a single "in X min",
 * the free-session pillar picker, and one "Set a goal" nudge at a time.
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
const headerCounts = async () => {
  const m = /(\d+) of (\d+) done/.exec(await t.body());
  return m ? [Number(m[1]), Number(m[2])] : null;
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
await page.getByLabel('All', { exact: true }).waitFor();
await page.getByText('Half marathon').first().waitFor();
await t.wait(1200);
await shot('top');

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

// ── next task, done task not lingering ───────────────────────────────
ok((await nextCardText()).includes('Buy running shoes'), 'next task = first open task by order ("Buy running shoes")');
ok(await page.getByLabel('Start Buy running shoes', { exact: true }).count() === 1, 'next task has a ▶ "Start Buy running shoes" button');
ok(!b.includes('Old finished errand'), 'a task done yesterday (planned yesterday) does not appear');

// ── US-067 rollover label ────────────────────────────────────────────
const fromLabel = `from ${weekdayShort(today(-2))}`;
ok(b.includes(fromLabel) && b.includes('Plan the long route'), `task planned 2 days ago shows "${fromLabel}"`);
ok(!b.includes('Do today'), 'rollover options are not always visible');

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

// ── US-065/069 one N-of-M definition ─────────────────────────────────
// Body: habits Run + Stretch(done) + tasks next + rolled-over = 1/4 · Craft 0/2 · Family 0/1 · Mind 0/1
let hc = await headerCounts();
let bs = await badgeSum();
ok(hc && hc[0] === 1 && hc[1] === 8, `header reads "1 of 8 done" (got ${hc})`);
ok(hc && bs[0] === hc[0] && bs[1] === hc[1], `header equals the sum of pillar badges (${bs})`);
ok(await page.getByLabel('Body, 1 of 4 done', { exact: true }).count() === 1, 'Body badge 1/4 (unscheduled Swim not counted)');

// ── check off the next task ──────────────────────────────────────────
await page.getByLabel('Mark Buy running shoes done', { exact: true }).click();
await page.getByText('Sign up for the race').first().waitFor();
await t.wait(800);
await shot('next-advanced');
ok((await nextCardText()).includes('Sign up for the race'), 'after checking it off, "Sign up for the race" is the next task');
const t1 = await taskRow('t1');
ok(t1 && t1.is_done === 1 && !!t1.done_at, 'DB: t1 is_done = 1 with done_at');
hc = await headerCounts();
bs = await badgeSum();
ok(hc && hc[0] === 2 && hc[1] === 9 && bs[0] === 2 && bs[1] === 9, `header and badges count the finished task (got ${hc} / ${bs})`);
ok((await t.body()).includes('2 done'), 'Body shows "2 done" (Stretch + the task)');

// ── Do today ─────────────────────────────────────────────────────────
await page.getByText(fromLabel, { exact: true }).click();
await page.getByLabel('Do today: Plan the long route', { exact: true }).waitFor();
await t.wait(700);
await shot('rollover-options');
ok(await page.getByLabel('Move to tomorrow: Plan the long route', { exact: true }).count() === 1, 'one tap shows Do today · Move to tomorrow · Unplan');
await page.getByLabel('Do today: Plan the long route', { exact: true }).click();
await t.wait(900);
b = await t.body();
ok(!b.includes(fromLabel) && b.includes('Plan the long route'), '"Do today" clears the label, the task stays');
const t4 = await taskRow('t4');
ok(t4 && t4.planned_date === DAY, `DB: t4 planned_date = today (${t4 && t4.planned_date})`);

// ── US-074 nudges ────────────────────────────────────────────────────
b = await t.body();
ok((b.match(/has no goal yet/g) || []).length === 1, 'exactly one "Set a goal" nudge on Today');
ok(b.includes('Craft has no goal yet'), 'nudge is on the first eligible pillar (Craft)');
ok(!b.includes('Family has no goal yet'), 'maintenance pillar (Family) is never nudged');
await page.getByText('Craft has no goal yet').first().scrollIntoViewIfNeeded();
await shot('nudge');
await page.getByLabel('Not now, Craft', { exact: true }).click();
await t.wait(600);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByLabel('All', { exact: true }).waitFor();
await t.wait(1500);
b = await t.body();
ok(!b.includes('Craft has no goal yet'), '"Not now" hides the Craft nudge after reload');
ok((b.match(/has no goal yet/g) || []).length === 1 && b.includes('Mind has no goal yet'), 'still one nudge at most (moves to Mind)');
ok(!b.includes('Family has no goal yet'), 'maintenance pillar still not nudged');
const dismissed = await page.evaluate(() => JSON.parse(localStorage.getItem('@intentional/goalNudgeDismissed') || '{}'));
ok(!!dismissed.g2, 'dismissal stored for Craft');

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

// ── "Set a goal" action ──────────────────────────────────────────────
await t.goto('/today');
await page.getByLabel('Set a goal for Mind', { exact: true }).waitFor();
await page.getByLabel('Set a goal for Mind', { exact: true }).click();
await page.waitForURL(/\/goal\/g3/, { timeout: 60000, waitUntil: 'commit' });
await t.wait(1500);
await shot('after-set-goal');
ok(sawUrl(/\/goal\/g3\?setGoal=1/), `"Set a goal" opens /goal/g3?setGoal=1 (visited: ${visited.filter((u) => u.includes('/goal/')).join(', ')})`);

// ── Pillar with only tasks folds when they're all done ───────────────
const db2 = JSON.parse(JSON.stringify(db));
db2.daily_actions = db2.daily_actions.filter((a) => a.goal_id !== 'g1');
db2.tasks = [task('t1', 'Only task', 0)];
db2.habit_completions = [];
await t.seed(db2, settings);
await t.goto('/today');
await page.getByText('Only task').first().waitFor();
await t.wait(800);
ok(await page.getByLabel('Body, 0 of 1 done', { exact: true }).count() === 1, 'task-only pillar is shown and counted (0/1)');
await page.getByLabel('Mark Only task done', { exact: true }).click();
await t.wait(1200);
b = await t.body();
ok(await page.getByLabel('Body, 1 of 1 done', { exact: true }).count() === 1 && b.includes('All done for today'), 'task-only pillar folds itself once its task is done');
await shot('task-only-folded');

await t.finish();
