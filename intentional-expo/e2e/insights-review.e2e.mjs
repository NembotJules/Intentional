/**
 * Insights goals (US-071) + weekly review per goal (US-072) on seeded data.
 * Covers: calendar-week hours (a session last Sunday must not count), real projection sentences,
 * no "unknown"/"overdue" copy, the "Where it went" goal / maintenance / free-time split,
 * "On track?" answers restored after reload, inline "Plan next week" tasks, and the history summary.
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('insights-review');
const { page, ok, has, shot, tap } = t;

// ── Dates (local) ──
const now = new Date();
const dow = now.getDay();
const mondayOffset = dow === 0 ? -6 : 1 - dow;
const weekStart = today(mondayOffset); // this Monday
const nextWed = today(mondayOffset + 9);
const nextWedDate = Number(nextWed.slice(8));
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };
const lastSundayNoon = (() => { const [y, m, d] = weekStart.split('-').map(Number); return new Date(y, m - 1, d - 1, 12, 0, 0).toISOString(); })();
const minutesAgoIso = (n) => new Date(Date.now() - n * 60000).toISOString();

// ── Seed ──
const { db, settings } = makeDb({
  pillars: [['Body', '#D65A31', 'body'], ['Finances', '#2F8F5B', 'money'], ['Mind', '#4C6FFF', 'mind']],
  habits: [{ id: 'a0', pillar: 0, name: 'Stretch', type: 'session', minutes: 30 }],
  name: 'Alex',
});
db.daily_actions = db.daily_actions.map((a) => ({ ...a, objective_id: null, days_mask: 127 }));
const obj = (id, pillar, title, createdDaysAgo, deadlineInDays) => ({
  id, pillar_id: pillar, title, done_when: '', deadline: today(deadlineInDays), status: 'active',
  metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0,
  created_at: daysAgoIso(createdDaysAgo), closed_at: null, close_note: null,
});
db.objectives = [
  obj('o0', 'g0', 'Run a half marathon', 30, 60), // 1 of 4 tasks after 30 days → ~120 days total → after the deadline
  obj('o1', 'g1', 'Save 5,000 €', 10, 80), // 1 of 2 tasks after 10 days → ~20 days total → well before
  obj('o2', 'g2', 'Read 12 books', 5, 120), // no tasks, no metric → no pace, "first hour" line
];
const task = (id, o, title, done, k) => ({ id, objective_id: o, title, estimate_minutes: 30, planned_date: null, is_done: done ? 1 : 0, done_at: done ? daysAgoIso(2) : null, sort_order: k, created_at: daysAgoIso(10) });
db.tasks = [
  task('t0', 'o0', 'Buy shoes', true, 0), task('t1', 'o0', 'Run 5k', false, 1), task('t2', 'o0', 'Run 10k', false, 2), task('t3', 'o0', 'Run 15k', false, 3),
  task('t4', 'o1', 'Open savings account', true, 0), task('t5', 'o1', 'Set auto transfer', false, 1),
];
const session = (id, goal, mins, startedAt, { action = null, taskId = null, objective = null } = {}) => ({
  id, action_id: action, goal_id: goal, started_at: startedAt, ended_at: startedAt, duration_seconds: mins * 60,
  note: null, was_completed: 1, task_id: taskId, objective_id: objective,
});
db.focus_sessions = [
  session('s-goal', 'g0', 60, minutesAgoIso(3), { taskId: 't1', objective: 'o0' }), // goal work, today
  session('s-maint', 'g0', 30, minutesAgoIso(2), { action: 'a0' }), // habit with no goal → maintenance
  session('s-free', 'g0', 15, minutesAgoIso(1)), // no habit, no task → free time
  session('s-sunday', 'g0', 120, lastSundayNoon, { taskId: 't1', objective: 'o0' }), // last week: must NOT count
];
db.weekly_reviews = [];

await t.goto('/');
await page.waitForTimeout(2000);
await t.seed(db, settings);

// ── Insights ──
await t.goto('/insights');
await t.waitText('Where it went', 240000);
await page.waitForTimeout(1500);
await shot('insights-top');
const body = await t.body();
ok(body.includes('Goals'), 'Goals section shown');
ok((await page.getByLabel(/^Run a half marathon, 1h this week/).count()) > 0, 'goal hours = this calendar week only (1h, last Sunday excluded)');
ok(!(await page.getByLabel(/^Run a half marathon, 3h this week/).count()), 'last Sunday session not counted');
ok(body.includes("At this pace you'll reach Save 5,000 € around") && /Save 5,000 € around [A-Z][a-z]{2} \d+, \d+ days before your deadline\./.test(body), 'projection: before the deadline');
// o0 is 25% done at 33% of its time: inside the ±10% band, so its pace reads "on track". The projection must not
// contradict that with "after your deadline" (changed 2026-10-21 by the founder's agent: the old expectation showed
// "on track" and "a little after your deadline" side by side in the same card).
ok(/Run a half marathon is on track for [A-Z][a-z]{2} \d+\. Keep giving it hours every week\./.test(body), 'projection agrees with the on-track pace');
ok(!/reach Run a half marathon around .*after your deadline/.test(body), 'no "after your deadline" next to an on-track pace');
ok(body.includes('Give Read 12 books its first hour this week.'), 'no progress yet → first-hour line');
ok(!/unknown/i.test(body), 'no "unknown" text');
ok(!/overdue|\blate\b/i.test(body), 'no "overdue"/"late" text');
ok(!/finish \d+ days (early|late)/.test(body), 'old false "finish N days early/late" line gone');
await page.getByText('Where it went').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await shot('insights-where');
ok(body.includes('Goal work 1h'), 'split: goal work 1h');
ok(body.includes('Maintenance 30m'), 'split: maintenance 30m');
ok(body.includes('Free time 15m'), 'split: free time 15m');
ok(body.includes('1h 45m'), 'Body this week = 1h 45m (calendar week)');
{ const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, 'no horizontal overflow on Insights (' + w + ')'); }

// ── Weekly review ──
await t.goto('/weekly-review');
await t.waitText('How are your goals?', 240000);
await page.waitForTimeout(1000);
ok(await has('1h this week'), 'review: Run a half marathon 1h this week (calendar week)');
ok(!(await has('3h this week')), 'review: last Sunday not counted');
ok(!/unknown/i.test(await t.body()), 'review: no "unknown" pace');
ok(!(await has('Plan tasks for next week')), 'review: plan next week is inline (no link to Today)');
await page.getByLabel('What went well?').fill('Ran three times');
await tap('On track: Run a half marathon', 400);
await tap('Behind: Save 5,000 €', 400);
const taskInput = page.getByLabel('New task for Run a half marathon');
await taskInput.scrollIntoViewIfNeeded();
await taskInput.fill('Long run 15k');
await page.getByLabel(new RegExp(`^Plan on Wed ${nextWedDate}$`)).first().click();
await page.waitForTimeout(300);
await shot('review-plan');
await tap('Add task to Run a half marathon', 800);
await shot('review-plan-added');
{ const d = await page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
  const row = (d.tasks || []).find((x) => x.title === 'Long run 15k');
  ok(row && row.objective_id === 'o0' && row.planned_date === nextWed, `task added inline for next Wednesday (${row && row.planned_date} vs ${nextWed})`); }
ok(await has('Long run 15k'), 'added task listed under the goal');
await tap('Save review', 800);
ok(await has('Review saved'), 'review saved');
await shot('review-saved');

// Reload: answers come back, and re-saving keeps goals_data.
await page.reload({ waitUntil: 'domcontentloaded' });
await t.waitText('How are your goals?', 240000);
await page.waitForTimeout(1500);
// Selected answer chips are filled with ink (Surface.ink #171411); aria-selected when the platform exposes it.
const sel = async (label) => {
  const el = page.getByLabel(label, { exact: true }).last();
  const aria = await el.getAttribute('aria-selected');
  const bg = await el.evaluate((e) => getComputedStyle(e).backgroundColor);
  return aria === 'true' || bg === 'rgb(23, 20, 17)' ? 'true' : 'false:' + aria + ':' + bg;
};
{ const a = await sel('On track: Run a half marathon'); ok(a === 'true', 'after reload: "On track" restored ' + a); }
{ const a = await sel('Behind: Save 5,000 €'); ok(a === 'true', 'after reload: "Behind" restored ' + a); }
ok((await sel('On track: Read 12 books')) !== 'true', 'unanswered goal stays unanswered');
ok((await sel('Behind: Run a half marathon')) !== 'true', 'only the chosen answer is selected');
ok(await has('Long run 15k'), 'after reload: planned task still listed');
await shot('review-restored');
await tap('Save review', 800);
{ const d = await page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
  const r = (d.weekly_reviews || []).find((x) => x.week_start === weekStart);
  const g = r && r.goals_data ? JSON.parse(r.goals_data) : null;
  ok(Array.isArray(g) && g.some((x) => x.objective_id === 'o0' && x.on_track === 'yes' && Math.round(x.hours * 60) === 60) && g.some((x) => x.objective_id === 'o1' && x.on_track === 'behind'),
    're-save keeps goals_data: ' + (r && r.goals_data)); }
// Change an answer, save again, reload: the latest answer wins.
await tap('Rethink: Save 5,000 €', 400);
await tap('Save review', 800);
await page.reload({ waitUntil: 'domcontentloaded' });
await t.waitText('How are your goals?', 240000);
await page.waitForTimeout(1500);
{ const a = await sel('Rethink: Save 5,000 €'); ok(a === 'true', 'changed answer restored after second save ' + a); }
ok((await sel('On track: Run a half marathon')) === 'true', 'other answer still restored');
{ const w = await page.evaluate(() => document.documentElement.scrollWidth); ok(w <= 390, 'no horizontal overflow on review (' + w + ')'); }

// ── History ──
await tap('View past reviews', 1200);
await page.getByText('Past reviews', { exact: true }).first().waitFor({ timeout: 120000 });
await page.waitForTimeout(800);
await shot('history');
{ const b = await t.body();
  ok(b.includes('Ran three times'), 'history: review text');
  ok(b.includes('Run a half marathon') && b.includes('On track') && b.includes('Save 5,000 €') && b.includes('Rethink'), 'history: goal summary with the latest answers');
  ok(/Run a half marathon\s*On track\s*1h/.test(b), 'history: goal hours shown');
  ok((b.match(/Week of /g) || []).length === 1, 'history: one card for the week after saving twice'); }

await t.finish();
