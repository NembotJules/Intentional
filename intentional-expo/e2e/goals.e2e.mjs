/**
 * Goals, tasks, habits & sessions (US-059 → US-064, US-068/069, US-074) on the web build.
 * Every check reads the screen AND, where it matters, the web DB in localStorage (intentional_db_v2).
 */
import { start, today } from './lib.mjs';

const t = await start('goals');
const { page, ok, shot } = t;

// ─── helpers ────────────────────────────────────────────────────────────────
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayStart = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDeadline = (k) => {
  const d = dayStart(k);
  const base = `${WD[d.getDay()]}, ${MON[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}, ${d.getFullYear()}`;
};
const fmtLong = (k) => { const d = dayStart(k); return `${WD_LONG[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const label = (l) => page.getByLabel(l, { exact: true });
const noSideScroll = async (where) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw <= iw, `${where}: no horizontal scroll (${sw}/${iw})`);
};
const go = async (route, waitFor) => {
  await t.goto(route);
  await t.waitText(waitFor, 240000);
  await t.wait(900);
};

// ─── seed ───────────────────────────────────────────────────────────────────
const now = new Date();
const mondayKey = (() => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); })();
const mondayStart = dayStart(mondayKey);
const iso = (d) => d.toISOString();
const pillar = (id, name, color, icon, k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 });
const habit = (h) => ({ is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, reminder_time: null, strict: 1, ...h });
const objective = (o) => ({ done_when: '', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(now), closed_at: null, close_note: null, ...o });
const session = (s) => ({ note: null, was_completed: 1, task_id: null, action_id: null, ended_at: s.started_at, ...s });

const createdAt = new Date(now); createdAt.setDate(createdAt.getDate() - 30);
const db = {
  meta_goals: [
    pillar('g0', 'Body', '#D65A31', 'dumbbell', 0),
    pillar('g1', 'Craft', '#A66A00', 'hammer', 1),
    pillar('g2', 'Family', '#2F8F5B', 'heart', 2),
    pillar('g3', 'Mind', '#4C6FFF', 'brain', 3),
  ],
  daily_actions: [
    habit({ id: 'h_run', goal_id: 'g0', name: 'Run', type: 'session', target_minutes: 30, reminder_time: '07:00', days_mask: 63, objective_id: 'o_active', sort_order: 0 }),
    habit({ id: 'h_stretch', goal_id: 'g0', name: 'Stretch', type: 'habit', target_minutes: 60, sort_order: 1 }),
  ],
  objectives: [
    objective({ id: 'o_active', pillar_id: 'g0', title: 'Run a half marathon', done_when: 'Finish 21.1 km', deadline: today(60), status: 'active', metric_current: 11, metric_target: 21, metric_unit: 'km', metric_start: 5, created_at: iso(createdAt) }),
    objective({ id: 'o_next', pillar_id: 'g0', title: 'Run a marathon', deadline: today(200), status: 'planned', sort_order: 1 }),
    objective({ id: 'o_craft', pillar_id: 'g1', title: 'Ship the MVP', deadline: today(40), status: 'active' }),
  ],
  tasks: [{ id: 't_shoes', objective_id: 'o_active', title: 'Buy running shoes', estimate_minutes: 30, planned_date: null, is_done: 1, done_at: iso(now), sort_order: 0, created_at: iso(createdAt) }],
  focus_sessions: [
    // this week: 45 min on the Run habit
    session({ id: 's1', goal_id: 'g0', objective_id: 'o_active', action_id: 'h_run', started_at: iso(new Date(now.getTime() - 60000)), duration_seconds: 2700 }),
    // last Sunday 23:00 (one hour before this week): 40 min on a task
    session({ id: 's2', goal_id: 'g0', objective_id: 'o_active', task_id: 't_shoes', started_at: iso(new Date(mondayStart.getTime() - 3600000)), duration_seconds: 2400 }),
    // ten days ago: 60 min on Run
    session({ id: 's3', goal_id: 'g0', objective_id: 'o_active', action_id: 'h_run', started_at: iso(new Date(now.getTime() - 10 * 86400000)), duration_seconds: 3600 }),
  ],
  habit_completions: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};

await t.goto('/');
await t.wait(2000);
await t.seed(db, { user_name: 'Alex', hasCompletedOnboarding: '1' });

// ─── US-061: goal detail header ─────────────────────────────────────────────
await go('/objective/o_active', 'Run a half marathon');
await shot('goal-detail-header');
let b = await t.body();
ok(b.includes(`Due ${fmtDeadline(today(60))} · 60 days left`), `header shows deadline date + days left ("Due ${fmtDeadline(today(60))} · 60 days left")`);
ok(b.includes('Done when: Finish 21.1 km'), 'header shows done-when');
ok(b.includes('On track'), 'pace word "On track" (6/16 of the metric at 1/3 of the time)');
ok(await label('Hours given 2.4h').count() === 1, 'hours all time = 45 + 40 + 60 min = 2.4h');
ok(await label('This week 45m').count() === 1, 'hours this week = 45m (Sunday-night session is last week)');
ok(b.includes('Started at 5'), 'metric shows where it started');
ok(!b.includes('overdue') && !b.includes('coming soon'), 'no "overdue" / "coming soon" copy');
await noSideScroll('goal detail');

// ─── US-061: recent sessions ────────────────────────────────────────────────
ok(b.includes('Recent sessions') && b.includes('Buy running shoes') && b.includes('45 min') && b.includes('40 min') && b.includes('60 min'), 'recent sessions list the seeded sessions with labels and durations');
ok((await page.getByText('Run', { exact: true }).count()) >= 2, 'habit sessions are labelled with the habit name ("Run")');
ok(b.includes('Mon–Sat · 7:00 · 30 min'), 'linked habit shows its schedule');

// ─── US-064: add 3 tasks with estimates and plans ───────────────────────────
async function addTask(title, estimateLabel, planLabel, custom) {
  await t.tap('Add task');
  await label('Task title').fill(title);
  await t.tap(estimateLabel, 200);
  if (custom) await label('Custom estimate minutes').fill(custom);
  await t.tap(planLabel, 200);
  await t.tap('Add task', 800);
}
await addTask('Buy race bib', 'Estimate 15 min', 'Plan Today');
await addTask('Long run 15 km', 'Estimate 90 min', 'Plan Tomorrow');
await t.tap('Add task');
await label('Task title').fill('Book physio');
await t.tap('Custom estimate', 200);
await label('Custom estimate minutes').fill('25');
await t.tap('Plan This week', 200);
await shot('task-form');
await t.tap('Add task', 800);

let d = await readDb();
const byTitle = (title) => d.tasks.find((x) => x.title === title);
const sunday = (() => { const x = new Date(now); x.setDate(x.getDate() + ((7 - x.getDay()) % 7)); return keyOf(x); })();
ok(byTitle('Buy race bib')?.estimate_minutes === 15 && byTitle('Buy race bib')?.planned_date === today(0), 'task 1 saved: 15 min, planned today');
ok(byTitle('Long run 15 km')?.estimate_minutes === 90 && byTitle('Long run 15 km')?.planned_date === today(1), 'task 2 saved: 90 min, planned tomorrow');
ok(byTitle('Book physio')?.estimate_minutes === 25 && byTitle('Book physio')?.planned_date === sunday, `task 3 saved: custom 25 min, "This week" = coming Sunday (${sunday})`);
b = await t.body();
ok(b.includes('0 / 15 min · Today') && b.includes('0 / 90 min · Tomorrow'), 'rows show "N / M min" and the planned day');
ok((await label('Edit Buy race bib').innerText()).includes('Next'), '"Next" label on the first open task');
await shot('tasks-added');

// reorder
await t.tap('Move Long run 15 km up', 800);
d = await readDb();
const order = d.tasks.filter((x) => !x.is_done).sort((a, c) => a.sort_order - c.sort_order).map((x) => x.title);
ok(order[0] === 'Long run 15 km' && order[1] === 'Buy race bib', `reorder saved (${order.join(' > ')})`);
ok((await label('Edit Long run 15 km').innerText()).includes('Next') && !(await label('Edit Buy race bib').innerText()).includes('Next'), '"Next" moved with the reorder');

// edit
await t.tap('Edit Book physio');
ok((await label('Task title').inputValue()) === 'Book physio', 'edit form is prefilled with the task');
await label('Task title').fill('Book physio check');
await t.tap('Estimate 30 min', 200);
await t.tap('Plan Tomorrow', 200);
await t.tap('Save task', 800);
d = await readDb();
ok(byTitle('Book physio check')?.estimate_minutes === 30 && byTitle('Book physio check')?.planned_date === today(1) && !byTitle('Book physio'), 'task edited in place (title, estimate, plan)');

// delete (real delete, not "done")
const bibId = byTitle('Buy race bib').id;
await t.tap('Edit Buy race bib');
await t.tap('Delete task', 900);
d = await readDb();
ok(!d.tasks.some((x) => x.id === bibId), 'deleted task row is gone from the DB (not marked done)');
ok(!(await t.body()).includes('Buy race bib'), 'deleted task is gone from the screen');

// check off → Next moves
await t.tap('Mark Long run 15 km done', 800);
d = await readDb();
ok(byTitle('Long run 15 km')?.is_done === 1, 'checked-off task saved as done');
ok((await label('Edit Book physio check').innerText()).includes('Next'), '"Next" moved to the following task');
ok((await t.body()).includes('2 done'), 'done tasks fold into "2 done"');
await shot('tasks-after');

// ─── US-061: update metric (quick action) ───────────────────────────────────
await t.tap('Update metric');
await label('Current value').fill('15');
await t.tap('Save value', 800);
d = await readDb();
ok(d.objectives.find((o) => o.id === 'o_active').metric_current === 15, 'metric value saved (15)');
b = await t.body();
ok(b.includes('15 of 21 km') && b.includes('Ahead'), 'header updates: "15 of 21 km", pace now "Ahead"');

// ─── US-061: edit goal — deadline chips, never a raw date field ─────────────
await t.tap('Edit goal');
b = await t.body();
ok(b.includes('30 days') && b.includes('90 days') && b.includes('6 months') && b.includes('Pick a date'), 'edit goal: deadline chips');
ok((await page.locator('input[placeholder="YYYY-MM-DD"]').count()) === 0, 'edit goal: no raw YYYY-MM-DD text field');
await t.tap('Deadline in 90 days', 300);
await shot('edit-goal');
await t.tap('Save', 900);
d = await readDb();
ok(d.objectives.find((o) => o.id === 'o_active').deadline === today(90), 'edited deadline saved as a local day key (90 days)');

// ─── US-062: complete → celebration → Start next ────────────────────────────
await t.tap('Mark as achieved', 1500);
ok(await t.has('Goal achieved!'), 'celebration shows after confirming');
ok(await t.has('Start next: Run a marathon'), 'offers "Start next: <planned goal>"');
ok(await label('Not now').count() >= 1, 'offers "Not now"');
await label('What made it work?').fill('Consistency');
await shot('celebration');
await t.tap('Start next: Run a marathon', 2000);
await t.waitText('Run a marathon', 60000);
d = await readDb();
const done = d.objectives.find((o) => o.id === 'o_active');
ok(done.status === 'completed' && done.close_note === 'Consistency' && !!done.closed_at, 'goal completed with its reflection saved as close_note');
ok(d.objectives.find((o) => o.id === 'o_next').status === 'active', '"Start next" activated the planned goal');
ok(page.url().includes('/objective/o_next'), 'navigated to the next goal');
ok(d.tasks.some((x) => x.objective_id === 'o_active' && !x.is_done), 'unfinished tasks stay attached to the completed goal');

// ─── US-063: drop with a reason → Set your next goal ────────────────────────
await go('/objective/o_craft', 'Ship the MVP');
await t.tap('Drop goal', 900);
ok(await t.has('Changing course is part of being intentional.'), 'drop sheet: respectful copy');
await label('Drop this goal?').fill('Priorities changed');
await shot('drop-sheet');
await t.tap('Drop goal', 1500);
ok(await t.has('Goal dropped'), 'after dropping: what-next sheet');
ok(await t.has('Set your next goal'), 'no planned goal → offers "Set your next goal"');
d = await readDb();
const dropped = d.objectives.find((o) => o.id === 'o_craft');
ok(dropped.status === 'dropped' && dropped.close_note === 'Priorities changed', 'status dropped, reason saved as close_note');
await shot('drop-next');
await t.tap('Set your next goal', 2000);
await t.waitText('New goal', 60000);
ok(page.url().includes('/goal/g1'), '"Set your next goal" opens the pillar');
ok((await t.has('New goal')) && (await label('Pick a date').count()) === 1, '?setGoal=1 opened the set-goal form on arrival');
await shot('set-goal-from-drop');

// ─── US-059: set a goal with "Pick a date" ──────────────────────────────────
await go('/goal/g2', 'Family');
await t.tap('Set a goal');
await label('What will you achieve?').fill('Weekly family dinner');
await label("How will you know it's done?").fill('Ten dinners in a row, etc.');
await t.tap('Pick a date', 400);
await t.tap('Next month', 300);
const picked = (() => { const x = new Date(now.getFullYear(), now.getMonth() + 1, 15); return keyOf(x); })();
await t.tap(fmtLong(picked), 300);
ok(await t.has(`Deadline: ${fmtDeadline(picked)}`), `picked date shown (${fmtDeadline(picked)})`);
ok((await page.locator('input[placeholder="Unit (kg, km, €, etc.)"]').count()) === 0, 'metric fields hidden until "Track a number"');
await t.tap('Track a number', 300);
ok((await page.locator('input[placeholder="Unit (kg, km, €, etc.)"]').count()) === 1, 'unit placeholder ends with "etc."');
await t.tap('Track a number', 300);
await shot('set-goal-pick-date');
await noSideScroll('set-goal form with DayPicker');
await t.tap('Set goal', 1200);
d = await readDb();
const fam = d.objectives.find((o) => o.pillar_id === 'g2' && o.title === 'Weekly family dinner');
ok(fam?.status === 'active' && fam?.deadline === picked, `goal saved active with the picked local day (${fam?.deadline})`);
b = await t.body();
ok(b.includes('Weekly family dinner') && b.includes('Done when: Ten dinners in a row, etc.'), 'pillar goal card shows title + done-when');
const days = Math.round((dayStart(picked) - dayStart(today(0))) / 86400000);
ok(b.includes(`${days} days left`) && b.includes('0h given') && b.includes(`Due ${fmtDeadline(picked)}`), `goal card shows days left (${days}), hours given, deadline`);

// planned "Next up"
await t.tap('Plan next goal');
await label('What will you achieve?').fill('Family trip');
await t.tap('Deadline in 90 days', 300);
await t.tap('Add to queue', 1200);
d = await readDb();
const trip = d.objectives.find((o) => o.title === 'Family trip');
ok(trip?.status === 'planned' && trip?.deadline === today(90), 'second goal saved as planned with a local-day deadline');
b = await t.body();
ok(b.includes('Next up') && b.includes('Saved "Family trip" as Next up.'), '"Next up" list + honest saved-as-planned notice');
await shot('pillar-next-up');
await t.tap('Open Family trip', 1500);
await page.waitForURL(/\/objective\//, { timeout: 60000 });
await t.wait(1200);
ok(page.url().includes(`/objective/${trip.id}`) && (await t.has('Next up')), 'tapping a "Next up" row opens that goal');

// ─── US-074: maintenance toggle hides the nudge; "Not now" snoozes ──────────
await go('/goals', 'Your pillars');
ok(await label('Set a goal for Mind').count() === 1, 'Goals tab: nudge on goal-less Mind');
ok(await label('Set a goal for Craft').count() === 1, 'Goals tab: nudge on Craft (its goal was dropped)');
ok(await label('Set a goal for Family').count() === 0, 'Goals tab: no nudge on Family (has a goal)');
ok(!(await t.body()).includes('overdue'), 'Goals tab: no "overdue" copy');
await shot('goals-tab-nudges');
await t.tap('Not now, Craft', 800);
ok(await label('Set a goal for Craft').count() === 0, '"Not now" hides the Craft nudge');
const snoozed = await page.evaluate(() => JSON.parse(localStorage.getItem('@intentional/goalNudgeDismissed') || '{}'));
ok(!!snoozed.g1, 'dismissal stored per pillar (14-day snooze)');
await noSideScroll('goals tab');

await go('/goal/g3', 'Mind');
await label('This pillar runs on habits').click();
await t.wait(600);
d = await readDb();
const maint = JSON.parse(d.settings.find((s) => s.key === 'maintenance_pillars')?.value ?? '[]');
ok(maint.includes('g3'), 'maintenance toggle saved for Mind');
ok(await t.has('Mind runs on habits'), 'pillar shows "runs on habits" instead of the set-goal row');
await shot('maintenance');
await go('/goals', 'Your pillars');
ok(await label('Set a goal for Mind').count() === 0, 'maintenance pillar shows no nudge');

// ─── US-068/069: habits ─────────────────────────────────────────────────────
await go('/goal/g0', 'Body');
b = await t.body();
ok(b.includes('Mon–Sat · 7:00 · 30 min'), 'habit list shows the schedule ("Mon–Sat · 7:00 · 30 min")');
ok(!b.includes('min a day') && !b.includes('Daily habit'), 'no "min a day" / "Daily habit" copy');
await t.tap('Edit habit Stretch');
ok(await t.has('Give it 15 min so it counts'), 'check habit edit asks for a duration');
ok((await page.getByRole('button', { name: '15 min', exact: true }).getAttribute('aria-selected')) === 'true', '15 min preselected for the old check habit');
await t.tap('Saturday', 150);
await t.tap('Sunday', 150);
await t.tap('Set a start time', 300);
await label('Start time').fill('07:30');
await shot('habit-form');
await t.tap('Save', 1000);
d = await readDb();
const st = d.daily_actions.find((a) => a.id === 'h_stretch');
ok(st.type === 'session' && st.target_minutes === 15, `check habit converted to timed 15 min (type ${st.type}, ${st.target_minutes} min)`);
ok(st.days_mask === 31 && st.reminder_time === '07:30', `weekdays + time saved (mask ${st.days_mask}, ${st.reminder_time})`);
ok(await t.has('Mon–Fri · 7:30 · 15 min'), 'saved schedule shown as "Mon–Fri · 7:30 · 15 min"');

// new habit: no check type; can't turn off the last day; minimum 5
await t.tap('Add habit');
b = await t.body();
ok(!b.includes('How do you track it?') && !b.includes('Just check it off'), 'new habit form offers no check type');
ok(['5 min', '15 min', '30 min', '45 min', '60 min', '90 min'].every((c) => b.includes(c)), 'duration chips 5 · 15 · 30 · 45 · 60 · 90');
for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) await t.tap(day, 120);
await t.tap('Sunday', 200);
ok(await t.has('A habit needs at least one day.'), 'last day stays on, with a hint');
await label('Habit name').fill('Walk');
await label('Custom minutes').fill('3');
await label('Habit name').click();
await t.tap('Add habit', 1000);
d = await readDb();
const walk = d.daily_actions.find((a) => a.name === 'Walk');
ok(walk?.type === 'session' && walk?.target_minutes === 5 && walk?.days_mask === 64, `new habit saved timed, min 5, Sunday only (${walk?.type}, ${walk?.target_minutes}, ${walk?.days_mask})`);
ok(await t.has('Sun · Anytime · 5 min'), 'new habit row: "Sun · Anytime · 5 min"');
await shot('habits-list');
await noSideScroll('pillar detail');

// Goals tab routes habit add to the one habit form
await go('/goals?editGoal=g0', 'Edit pillar');
b = await t.body();
ok(!b.includes('Daily actions') && !b.includes('Add an action') && b.includes('Habits'), 'Goals sheet says "Habits", no "action" copy');
await shot('goals-sheet');
await t.tap('Add a habit', 2000);
await t.waitText('New habit', 60000);
ok(page.url().includes('/goal/g0'), 'Goals sheet "Add a habit" opens the pillar habit form');

await t.finish();
