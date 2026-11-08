/**
 * US-104 · Progress, simpler, and the running session as a full-screen moment. Clock fixed on Thursday 14:00.
 *  (a) Progress with no hours yet: Week / Month (no "All"), and "Your week", "Your year", "Your people"
 *      are still there (the ritual, the review, the history, the year, the partner).
 *  (b) A session from the Focus button runs in Flick's world, full screen: a big timer, the task, pause / resume.
 *  (c) End early → "End now? You just started. Give it a few more minutes." Keep going → still running.
 *  (d) End again → wait out the lock → End session → "Session ended early", one session saved.
 *  (e) Progress with that session: the big number, then the three groups.
 */
import { start } from './lib.mjs';

const t = await start('session');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));

await page.clock.install({ time: new Date(2026, 10, 5, 14, 0, 0) });
await page.clock.resume();

const db = {
  meta_goals: [{ id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 }],
  daily_actions: [{ id: 'h_run', goal_id: 'g0', name: 'Run', type: 'session', target_minutes: 30, reminder_time: '18:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 0 }],
  objectives: [], tasks: [], focus_sessions: [], habit_completions: [], habit_skips: [], milestones: [], weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '0', milestones_backfilled: '1' };

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// ── (a) Progress, no hours yet ──
await t.goto('/progress');
await t.waitText('Your people', 60000);
ok((await label('This week').count()) === 1 && (await label('This month').count()) === 1 && (await label('All time').count()) === 0, 'Week / Month, no "All"');
for (const h of ['Your week', 'Your year', 'Your people']) ok((await page.getByRole('heading', { name: h, exact: true }).count()) === 1, `"${h}" even with no hours yet`);
ok(
  (await label('Your week, as a story').count()) === 1 && (await label('Weekly review').count()) === 1 && (await label('Session history').count()) === 1 && (await label('Accountability partner').count()) === 1,
  'the ritual, the review, the history and the partner are reachable before the first hour'
);
ok(!(await has('Balance')) && !(await has('Look back')), 'simpler: no balance radar, no "Look back" catch-all');
await shot('progress-empty');

// ── (b) a running session, full screen ──
await t.goto('/today');
await label('Focus').waitFor({ timeout: 60000 });
await label('Focus').click();
await page.getByText('Start focusing').first().waitFor({ timeout: 10000 });
await t.wait(800);
await label('Start focusing now').click();
await page.getByLabel(/^\d\d:\d\d remaining$/).first().waitFor({ timeout: 30000 });
ok((await page.getByLabel(/^Flick's world on the full screen, /).count()) === 1, 'the session runs in Flick\'s world, full screen');
ok((await has('Run')) && (await has('Body')) && (await has('Every minute goes to Body')), 'the task and the pillar, small');
ok((await label('End focus session').count()) === 1 && (await label('Pause focus session').count()) === 1, 'one big stop button, and pause');
await t.wait(1200);
await shot('running');
await label('Pause focus session').click();
await t.wait(600);
ok((await has('Paused. Resume when')) && (await label('Resume focus session').count()) === 1, 'pause works');
await label('Resume focus session').click();
await t.wait(600);
ok(!(await has('Paused. Resume when')), 'resume works');

// ── (c) End early → Keep going ──
await page.clock.fastForward('01:00');
await t.wait(500);
await label('End focus session').click();
await t.wait(600);
ok((await has('End now?')) && (await has('You just started. Give it a few more minutes.')), '"End now? You just started. Give it a few more minutes."');
ok((await label('End session').getAttribute('aria-disabled')) === 'true', '"End session" waits a few seconds; "Keep going" is the big one');
await shot('end-dialog');
const before = await page.getByLabel(/^\d\d:\d\d remaining$/).first().getAttribute('aria-label');
await label('Keep going').click();
await t.wait(600);
await page.clock.fastForward('00:05');
await t.wait(800);
const after = await page.getByLabel(/^\d\d:\d\d remaining$/).first().getAttribute('aria-label');
ok(!(await has('End now?')) && before !== after, `Keep going: the dialog closes and the timer keeps running (${before} → ${after})`);

// ── (d) End for real ──
await label('End focus session').click();
await t.wait(5800);
await label('End session').click();
await t.waitText('Session ended early', 30000);
await t.wait(800);
const saved = (await readDb()).focus_sessions || [];
ok(saved.length === 1 && saved[0].action_id === 'h_run' && saved[0].duration_seconds >= 60, `one session saved on Run (${JSON.stringify(saved.map((x) => [x.action_id, x.duration_seconds]))})`);

// ── (e) Progress with that hour ──
await t.goto('/progress');
await t.waitText('Your people', 60000);
ok((await page.getByLabel(/given to your pillars this week$/).count()) === 1, 'the one big number: given to your pillars this week');
ok(await has('Where it went'), 'then where it went');
await page.getByRole('heading', { name: 'Your week', exact: true }).scrollIntoViewIfNeeded();
await shot('progress-groups');

await t.finish();
