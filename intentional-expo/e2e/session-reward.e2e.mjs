/**
 * US-084 · The end-of-session reward. A real 15-minute task session runs to completion (Playwright's clock
 * fast-forwards the timer) and carries the person over 10 lifetime hours:
 *   (a) the reward: "+15m to Half marathon", Flick's stage bar ("Flick · Flame", "40h to Torch"),
 *       the goal's hours ("given") and progress (1 of 3 steps → 33%), and the hand-off lines
 *       ("Flick is now a Flame", "10 hours to Body").
 *   (b) the hand-off: the full celebration waits until the reward has played, then shows over it.
 *   (c) "Yes, task done" moves the goal bar (33% → 67%), stored in the DB.
 *   (d) a short session with no stage or milestone: no hand-off lines, no celebration.
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('session-reward');
const { page, ok, shot } = t;

const { db, settings } = makeDb({ pillars: [['Body', '#D65A31', 'dumbbell']] });
const now = new Date().toISOString();
db.objectives = [
  { id: 'o0', pillar_id: 'g0', title: 'Half marathon', done_when: '', deadline: today(60), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: now, closed_at: null, close_note: null },
];
const task = (id, title, sort, extra = {}) => ({ id, objective_id: 'o0', title, estimate_minutes: 15, planned_date: null, is_done: 0, done_at: null, sort_order: sort, created_at: now, ...extra });
db.tasks = [task('t0', 'Buy shoes', 0), task('t1', 'Plan route', 1, { is_done: 1, done_at: now }), task('t2', 'Book race', 2)];
// 9h 50m given over past days: a 15-minute session crosses 10 hours (Flame, and the Body milestone).
const past = (daysAgo, mins) => {
  const d = new Date(Date.now() - daysAgo * 86400_000);
  return { id: `s${daysAgo}`, action_id: null, goal_id: 'g0', started_at: d.toISOString(), ended_at: d.toISOString(), duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: 'o0' };
};
db.focus_sessions = [past(5, 300), past(4, 290)];
db.milestones = [];
const seedSettings = { ...settings, milestones_backfilled: '1', flick_stage_seen: '0' };

const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));

await t.goto('/');
await t.wait(1500);
await t.seed(db, seedSettings);
await page.clock.install();

// ─── (a) a full session, then the reward ───
await t.goto('/focus');
await page.getByLabel('Focus on Buy shoes, task for Half marathon', { exact: true }).waitFor();
await t.wait(800);
await t.tap('Focus on Buy shoes, task for Half marathon', 800);
await shot('preparing');
ok((await page.getByText('15', { exact: true }).count()) > 0, 'task duration is its 15-minute estimate');
await t.pick('Start focus', 1200);
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 15000 });
await page.clock.fastForward('15:05');
await t.waitText('Session complete');
await t.wait(400);
let b = await t.body();
ok(b.includes('Session complete'), 'the timer ran out: "Session complete"');
ok(!b.includes('10 hours given to the life you chose'), 'hand-off: no celebration over the reward while it plays');
await t.wait(1500); // the counts finish
await shot('reward');
b = await t.body();
ok((await page.getByLabel('+15m to Half marathon', { exact: true }).count()) === 1 && b.includes('+15m to'), 'headline counted up to "+15m to Half marathon"');
ok((await page.getByLabel('Flick, Flame', { exact: true }).count()) === 1, 'Flick shows its new stage (Flame)');
ok(b.includes('Flick · Flame') && b.includes('40h to Torch'), 'stage bar: "Flick · Flame", "40h to Torch"');
ok(b.includes('10h 05m given'), `goal hours counted up to "10h 05m given"`);
ok((await page.getByLabel('Goal progress 33%', { exact: true }).count()) === 1, 'goal bar at 33% (1 of 3 steps)');
ok((await page.getByLabel('Reached: Flick is now a Flame', { exact: true }).count()) === 1, 'hand-off line: "Flick is now a Flame"');
ok((await page.getByLabel('Reached: 10 hours to Body', { exact: true }).count()) === 1, 'hand-off line: "10 hours to Body"');
const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(sw <= iw, `reward: no horizontal scroll (${sw}/${iw})`);

// ─── (b) the celebration follows ───
await t.waitText('Flick is now a Flame. 10 hours given to the life you chose.', 8000);
ok(await t.has('Flick is now a Flame. 10 hours given to the life you chose.'), 'then the stage-up celebration takes over');
await shot('hand-off-stage');
await t.tap('Next', 800);
// US-101: Flame earns the Forest, shown before the milestone.
// the US-126 reveal: the name and "Later" come at 1.9 s
await page.getByLabel('Later', { exact: true }).first().waitFor({ timeout: 20000 }).catch(() => {});
ok(await t.has('The Forest'), 'then the world Flame earns (The Forest)');
await t.tap('Later', 800);
ok(await t.has('10 hours to Body.'), 'then the milestone');
await t.tap('Continue', 800);
ok(await t.has('Session complete') && !(await t.has('10 hours to Body.')), 'back on the reward');
let d = await readDb();
ok((d.milestones ?? []).filter((m) => m.kind === 'pillar_hours' && m.value === 10).length === 1, 'milestone stored once');
const row = d.focus_sessions.find((s) => s.task_id === 't0');
ok(row?.was_completed === 1 && row?.duration_seconds === 900 && row?.objective_id === 'o0', `session row: completed, 900 s, goal o0 (${row?.was_completed}/${row?.duration_seconds}/${row?.objective_id})`);

// ─── (c) the task is done: the goal bar moves ───
await t.tap('Yes, task done', 1500);
ok((await page.getByLabel('Goal progress 67%', { exact: true }).count()) === 1, 'goal bar moved to 67% (2 of 3 steps)');
await shot('task-done');
d = await readDb();
ok(d.tasks.find((x) => x.id === 't0')?.is_done === 1, 'task t0 stored done');

// ─── (d) a short session: no hand-off ───
await t.tap('Start another session', 1000);
await t.goto('/focus?goalId=g0');
await t.waitText('Free time · Body');
await t.wait(600);
await t.pick('Start focus', 1200);
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 15000 });
await page.clock.fastForward('25:05');
await t.waitText('Session complete');
await t.wait(3500);
b = await t.body();
ok((await page.getByLabel('+25m to Body', { exact: true }).count()) === 1, 'free session: "+25m to Body"');
ok((await page.getByLabel('Flick stage Flame, 40h to Torch', { exact: true }).count()) === 1, 'stage bar: still Flame, 40h to Torch (10h 30m rounds up)');
ok((await page.getByLabel(/^Reached: /).count()) === 0, 'no stage or milestone: no hand-off lines');
ok(!b.includes('given to the life you chose.') && !b.includes('Milestone'), 'no celebration after the reward');
ok((await page.getByLabel(/^Goal progress/).count()) === 0, 'free time: no goal bar');
await shot('free-reward');

await t.finish();
