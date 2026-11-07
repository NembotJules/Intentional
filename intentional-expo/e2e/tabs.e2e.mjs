/**
 * US-102 · Each tab does one job (founder 2026-11-06).
 *  (a) The tab bar: Today · Goals · ◉Focus · Block · Progress. No Settings tab, no Insights tab.
 *  (b) The gear on Today opens Settings: Account, Notifications, Flick, Your data, Help & about.
 *      Nothing else: no habits list, no blocking rules, no partner or witness, no ritual.
 *  (c) Goals holds "Your habits": pausing one there shows "Paused" and stores is_active 0; resuming restores it.
 *      The gear on Goals opens Settings too.
 *  (d) Progress: titled Progress, with the ritual, the review, the partner and the history (US-104: in Your week / Your people). The old /insights link lands on it.
 */
import { start } from './lib.mjs';

const t = await start('tabs');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));

const db = {
  meta_goals: [
    { id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 },
    { id: 'g1', name: 'Craft', color: '#A66A00', icon: 'hammer', sort_order: 1, why_statement: '', is_archived: 0 },
  ],
  daily_actions: [
    { id: 'h_run', goal_id: 'g0', name: 'Run', type: 'session', target_minutes: 30, reminder_time: '07:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 1 },
    { id: 'h_write', goal_id: 'g1', name: 'Write', type: 'session', target_minutes: 45, reminder_time: null, is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 1 },
  ],
  objectives: [],
  tasks: [],
  focus_sessions: [
    { id: 's1', action_id: 'h_write', goal_id: 'g1', started_at: new Date(Date.now() - 3 * 3600e3).toISOString(), ended_at: new Date(Date.now() - 2.5 * 3600e3).toISOString(), duration_seconds: 1800, note: null, was_completed: 1, task_id: null, objective_id: null },
  ],
  habit_completions: [],
  habit_skips: [],
  milestones: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '0', milestones_backfilled: '1' };

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);
await t.goto('/today');
await page.getByRole('tab', { name: 'Today' }).waitFor({ timeout: 60000 });

// ── (a) the tab bar ──
const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
ok(tabs.join('|') === 'Today|Goals|Block|Progress', `tabs: Today · Goals · Block · Progress (${tabs.join(', ')})`);
ok((await label('Focus').count()) === 1, 'the big Focus button sits in the middle');
ok((await page.getByRole('tab', { name: 'Settings' }).count()) === 0 && (await page.getByRole('tab', { name: 'Insights' }).count()) === 0, 'no Settings tab, no Insights tab');
await shot('today-gear');

// ── (b) the gear → Settings ──
await label('Settings').first().click();
await t.waitText('Notifications', 30000);
for (const s of ['Account', 'Notifications', 'Flick', 'Your data', 'Help & about'])
  ok((await page.getByRole('heading', { name: s, exact: true }).count()) === 1, `Settings: "${s}"`);
const body = await t.body();
ok(
  !body.includes('Your habits') && !body.includes('Blocking rules') && !body.includes('Accountability partner') && !body.includes('Witness') && !body.includes('ritual'),
  'Settings holds only settings: no habits, no blocking, no partner or witness, no ritual'
);
ok(await has('Heads-up 10 min before a habit') && (await has('Sunday reminder')), 'Notifications: heads-up and the Sunday reminder');
ok((await has('Lives in: ')) && (await has('Export sessions as CSV')) && (await has('Delete all data')), 'Flick\'s worlds (with where he lives) and your data are here');
await shot('settings');
await label('Back').first().click();
await t.waitText('Up next', 30000);
ok(page.url().includes('/today'), 'Back returns to Today');

// ── (c) Goals holds the habits ──
await page.getByRole('tab', { name: 'Goals' }).click();
await t.waitText('Your habits', 30000);
ok((await label('Run active').count()) === 1 && (await label('Write active').count()) === 1, 'Goals: every habit with its pause switch');
await label('Run active').click();
await t.wait(600);
ok((await has('Paused')) && (await readDb()).daily_actions.find((a) => a.id === 'h_run')?.is_active === 0, 'pausing Run: "Paused", stored inactive');
await label('Run active').click();
await t.wait(600);
ok((await readDb()).daily_actions.find((a) => a.id === 'h_run')?.is_active === 1, 'resuming Run: stored active again');
await page.getByText('Your habits').first().scrollIntoViewIfNeeded();
await shot('goals-habits');
await label('Settings').last().click(); // Goals' own gear (Today's stays mounted behind its tab)
await t.waitText('Help & about', 30000);
ok(page.url().includes('/settings'), 'the gear on Goals opens Settings too');

// ── (d) Progress ──
await t.goto('/insights');
await t.waitText('Your people', 60000);
ok(page.url().includes('/progress') && (await page.getByRole('heading', { name: 'Progress', exact: true }).count()) === 1, 'the old /insights link lands on Progress');
ok((await label('Your week, as a story').count()) === 1 && (await label('Weekly review').count()) === 1 && (await label('Accountability partner').count()) === 1 && (await label('Session history').count()) === 1, 'Progress: the ritual, the review, the partner, the history');
await shot('progress');

await t.finish();
