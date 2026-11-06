/**
 * Milestones on real things (US-080).
 *
 *  (a) A real Focus session carries Body over 10 hours → the stage-up (Flame) then the milestone ("10 hours to Body."), queued.
 *      The milestone row is stored once; a reload shows nothing.
 *  (b) Share from the milestone opens the card (MILESTONE · 10h · Body).
 *  (c) Retroactive: an install with 120h of history records 10/50/100h silently (no celebration) with their real dates.
 *  (d) Your life in hours lists the milestones.
 */
import { start, today } from './lib.mjs';

const t = await start('milestones');
const { page, ok, has, shot } = t;

const iso = (offsetDays, h = 9) => {
  const [y, m, d] = today(offsetDays).split('-').map(Number);
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
};
const pillars = [
  ['g0', 'Body', '#D65A31', 'body'],
  ['g1', 'Craft', '#A66A00', 'craft'],
];
const session = (id, goal, seconds, startedAt) => ({ id, action_id: null, goal_id: goal, started_at: startedAt, ended_at: startedAt, duration_seconds: seconds, note: null, was_completed: 1, task_id: null, objective_id: null });
const dbWith = (sessions) => ({
  meta_goals: pillars.map(([id, name, color, icon], k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 })),
  daily_actions: [],
  focus_sessions: sessions,
  habit_completions: [],
  habit_skips: [],
  objectives: [],
  tasks: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
});
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));

await t.goto('/');
await page.waitForTimeout(2000);

// ── (a) A real session crosses 10h on Body ──
// 10 h minus 4 s over five past days; milestones already backfilled; Flick seen as a Spark.
const almost = [0, 1, 2, 3].map((k) => session('p' + k, 'g0', 2 * 3600, iso(-20 + k)));
almost.push(session('p4', 'g0', 2 * 3600 - 4, iso(-15)));
await t.seed(dbWith(almost), { user_name: 'Alex', hasCompletedOnboarding: '1', milestones_backfilled: '1', flick_stage_seen: '0' });
await t.goto('/focus?goalId=g0');
await t.waitText('Free time · Body', 240000);
await page.waitForTimeout(2000);
ok(!(await has('hours to Body.')), 'before the session: no milestone shown');
await t.pick('Start focus', 1500);
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 15000 });
await t.tap('End focus session', 300);
await t.wait(5500);
await t.tap('End session anyway', 1500);

await t.waitText('Flick is now a Flame. 10 hours given to the life you chose.', 20000).catch(() => {});
await page.waitForTimeout(1500);
ok(await has('Flick is now a Flame. 10 hours given to the life you chose.'), 'after the session: the stage-up comes first');
ok((await page.getByLabel('Next', { exact: true }).count()) > 0, 'stage-up: "Next" because a milestone is queued');
await shot('queued-stage');
await t.tap('Next', 1200);
// US-101: Flame earns the Forest; its screen comes before the milestone.
await t.waitText('New world unlocked!', 10000).catch(() => {});
ok((await has('New world unlocked!')) && (await has('The Forest')), 'then the world Flame earns: "New world unlocked!", The Forest');
await t.tap('Later', 1200);
await t.waitText('10 hours to Body.', 20000).catch(() => {});
await page.waitForTimeout(1500);
ok(await has('10 hours to Body.') && await has('Milestone'), 'then the milestone: "10 hours to Body."');
ok(await has('Every one of them given on purpose.'), 'milestone: the line under it');
await shot('milestone-body-10h');

let d = await readDb();
const rows = (d.milestones ?? []).filter((m) => m.kind === 'pillar_hours');
ok(rows.length === 1 && rows[0].ref_id === 'g0' && rows[0].value === 10, `milestone row stored: pillar_hours g0 10 (${JSON.stringify(rows.map((r) => [r.ref_id, r.value]))})`);
const saved = d.focus_sessions.find((s) => !s.id.startsWith('p'));
ok(!!saved && saved.goal_id === 'g0' && saved.duration_seconds >= 4, `the crossing session was saved (${saved?.duration_seconds}s)`);

// ── (b) Share ──
await t.tap('Share this milestone', 1200);
ok(await has('Share this milestone') && await has('Hours only. No task names.'), 'share sheet opens');
ok(await has('MILESTONE') && await has('10h'), 'card: MILESTONE badge + 10h');
await shot('milestone-share');
await t.tap('Close share', 800);
await t.tap('Continue', 1000);
ok(!(await has('10 hours to Body.')), 'Continue closes the milestone');
ok(await has('Session ended early'), 'the session end screen is underneath');

// Never twice.
await t.goto('/today');
await t.waitText('Good', 240000);
await page.waitForTimeout(2500);
ok(!(await has('10 hours to Body.')) && !(await has('Flick is now a')), 'reload: nothing fires again');
d = await readDb();
ok((d.milestones ?? []).length === 1, 'still exactly one milestone row');

// ── (c) Retroactive: 120h of history on an install that never checked ──
const history = Array.from({ length: 60 }, (_, i) => session('h' + i, 'g0', 2 * 3600, iso(-120 + i * 2, 8)));
await t.seed(dbWith(history), { user_name: 'Alex', hasCompletedOnboarding: '1' });
await t.goto('/today');
await t.waitText('Good', 240000);
await page.waitForTimeout(3000);
ok(!(await has('hours to Body.')) && !(await has('Flick is now a')), 'retroactive: no celebration for history');
d = await readDb();
const back = (d.milestones ?? []).filter((m) => m.kind === 'pillar_hours').map((m) => m.value).sort((a, b) => a - b);
ok(JSON.stringify(back) === '[10,50,100]', `retroactive: 10/50/100h recorded (${JSON.stringify(back)})`);
const m50 = d.milestones.find((m) => m.value === 50);
// 50h is crossed by the 25th 2h session (index 24), which ends at 10:00 on its day.
const expected50 = new Date(Date.parse(iso(-120 + 24 * 2, 8)) + 2 * 3600 * 1000).toISOString();
ok(m50?.achieved_at === expected50, `retroactive: 50h dated by the session that crossed it (${m50?.achieved_at} vs ${expected50})`);
ok((await readSettings()).milestones_backfilled === '1', 'retroactive: backfill flag set');

// ── (d) Your life in hours lists them ──
await t.goto('/life');
await page.waitForTimeout(2500);
await page.getByText('Milestones', { exact: true }).scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
ok(await has('100 hours to Body.') && await has('50 hours to Body.') && await has('10 hours to Body.'), 'life: milestones listed');
await shot('life-milestones');
const w = await page.evaluate(() => document.documentElement.scrollWidth);
ok(w <= 390, `life: no horizontal overflow (${w})`);

await t.finish();
