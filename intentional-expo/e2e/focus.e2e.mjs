/**
 * Focus (US-066 / US-070): task sessions, pillar-only "Free time" sessions and habit sessions
 * all start, run, end through "Leave now?" and save the right ids.
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('focus');
const { page, ok, shot } = t;

const { db, settings } = makeDb({
  pillars: [
    ['Body', '#D65A31', 'dumbbell'],
    ['Craft', '#A66A00', 'hammer'],
  ],
  habits: [
    { id: 'a0', pillar: 0, name: 'Run', type: 'session', minutes: 30 },
    { id: 'a1', pillar: 1, name: 'Write', type: 'session', minutes: 25 },
  ],
});
db.daily_actions[0].objective_id = 'o0';
db.daily_actions[1].objective_id = null;
for (const a of db.daily_actions) a.days_mask = 127;
const now = new Date().toISOString();
db.objectives = [
  { id: 'o0', pillar_id: 'g0', title: 'Half marathon', done_when: '', deadline: today(60), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: now, closed_at: null, close_note: null },
];
const task = (id, title, sort, extra = {}) => ({ id, objective_id: 'o0', title, estimate_minutes: 45, planned_date: null, is_done: 0, done_at: null, sort_order: sort, created_at: now, ...extra });
db.tasks = [
  task('t0', 'Buy shoes', 0),
  task('t1', 'Plan route', 1, { planned_date: today() }),
  task('t2', 'Book race', 2, { planned_date: today(3) }),
  task('t3', 'Old done task', 3, { is_done: 1, done_at: now, planned_date: today(-1) }),
  task('t4', 'Unplanned later', 4),
];

const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const noSideScroll = async (label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw <= iw, `${label}: no horizontal scroll (${sw}/${iw})`);
};
/** Start from the preparing screen, run a few seconds, then End → wait out the lock → End anyway. */
async function runAndEnd(label) {
  await t.pick('Start focus', 1500);
  await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 15000 });
  const countdown = await page.getByLabel(/remaining$/).first().innerText();
  ok(/^\d+:\d\d$/.test(countdown.trim()), `${label}: running timer shows a countdown (${countdown.trim()})`);
  await t.tap('Pause focus session', 600);
  ok(await t.has('Paused. Resume when'), `${label}: pause works`);
  await t.tap('Resume focus session', 1500);
  ok(!(await t.has('Paused. Resume when')), `${label}: resume works`);
  await shot(`${label}-running`);
  await t.tap('End focus session', 300);
  ok(await t.has('Keep going'), `${label}: "Leave now?" sheet shows`);
  await shot(`${label}-leave`);
  await t.wait(5500);
  await t.tap('End session anyway', 1500);
  await t.waitText('Session ended early');
  ok(await t.has('Session ended early'), `${label}: end screen shows`);
}

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);

// ─── (a) Task session from the picker ───
await t.goto('/focus');
await page.getByLabel('Just give time to Body', { exact: true }).waitFor();
await t.wait(800);
await shot('picker');
await noSideScroll('picker');
let b = await t.body();
ok(b.includes('Buy shoes'), 'picker lists the goal\'s next task');
ok(b.includes('Plan route'), 'picker lists the task planned for today');
ok(!b.includes('Book race'), 'picker hides a task planned for a later day');
ok(!b.includes('Unplanned later'), 'picker hides other unplanned not-next tasks');
ok(!b.includes('Old done task'), 'picker hides done tasks');
ok(b.includes('for Half marathon'), 'tasks are labelled with their goal');
ok(b.includes('Just give time to Craft'), 'every pillar has a pillar-only option');

await t.tap('Focus on Buy shoes, task for Half marathon', 800);
ok(await t.has('Buy shoes'), 'task preparing screen shows the task');
ok((await page.getByText('45', { exact: true }).count()) > 0, 'task duration defaults to remaining estimate (45)');
await shot('task-preparing');
await runAndEnd('task');
b = await t.body();
ok(b.includes('to Half marathon'), 'end screen: "+… to <Goal>" uses the goal title');
ok(b.includes('Is this task done?'), 'end screen asks "Is this task done?"');
await shot('task-end');
await t.tap('Yes, task done', 1000);
b = await t.body();
ok(b.includes('Task done'), '"Yes" shows "Task done" confirmation');
ok(!b.includes('Is this task done?'), '"Yes" hides the prompt');
await shot('task-done');
let d = await readDb();
const taskRow = d.focus_sessions.find((s) => s.task_id === 't0');
ok(!!taskRow, 'task session saved with task_id');
ok(taskRow?.objective_id === 'o0', `task session objective_id = task's goal (${taskRow?.objective_id})`);
ok(taskRow?.goal_id === 'g0', 'task session goal_id = pillar');
ok(taskRow?.action_id == null, 'task session has no action_id');
ok((taskRow?.duration_seconds ?? 0) > 0, `task session recorded time (${taskRow?.duration_seconds}s)`);
ok(d.tasks.find((x) => x.id === 't0')?.is_done === 1, 'task t0 is_done = 1');

// ─── (b) Pillar-only free session via ?goalId= ───
await t.goto('/focus?goalId=g1');
await t.waitText('Free time · Craft');
await t.wait(600);
ok(await t.has('Free time · Craft'), 'goalId param preselects the pillar as free time');
ok((await page.getByText('25', { exact: true }).count()) > 0, 'free time defaults to 25 min');
ok(await t.has('Or pick a task or habit'), 'free time offers an optional task/habit');
await shot('free-preparing');
await noSideScroll('free preparing');
await t.tap('Pick a task or habit in Craft', 600);
ok(await t.has('Write'), 'alternatives list the pillar\'s habit');
await shot('free-alternatives');
await t.tap('Hide tasks and habits', 400);
await runAndEnd('free');
ok(await t.has('to Craft'), 'free end screen: "+… to <Pillar>"');
ok(!(await t.has('Is this task done?')), 'free end screen has no task prompt');
await shot('free-end');
d = await readDb();
const freeRow = d.focus_sessions.find((s) => s.goal_id === 'g1');
ok(!!freeRow, 'pillar-only session saved');
ok(freeRow?.action_id === null && freeRow?.task_id === null, `pillar-only row: action_id/task_id null (${freeRow?.action_id}/${freeRow?.task_id})`);
ok((freeRow?.duration_seconds ?? 0) > 0, 'pillar-only session recorded time');

// ─── (c) Habit session gets the habit's linked goal ───
await t.goto('/focus');
await page.getByLabel('Focus on Run, 30 minutes for Body', { exact: true }).waitFor();
await t.wait(600);
ok(!(await t.has('Buy shoes')), 'done task no longer in the picker');
await t.tap('Focus on Run, 30 minutes for Body', 800);
ok((await page.getByText('30', { exact: true }).count()) > 0, 'habit duration = habit target');
await runAndEnd('habit');
ok(await t.has('to Half marathon'), 'habit end screen credits the linked goal');
await shot('habit-end');
d = await readDb();
const habitRow = d.focus_sessions.find((s) => s.action_id === 'a0');
ok(!!habitRow, 'habit session saved with action_id');
ok(habitRow?.objective_id === 'o0', `habit session objective_id = linked goal (${habitRow?.objective_id})`);
ok(habitRow?.task_id == null, 'habit session has no task_id');
ok(!d.focus_sessions.some((s) => s.action_id === 'free-session'), 'no fake "free-session" ids written');
ok(d.focus_sessions.length === 3, `exactly 3 sessions saved (${d.focus_sessions.length})`);

await t.finish();
