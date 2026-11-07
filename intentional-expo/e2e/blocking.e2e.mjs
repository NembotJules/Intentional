/**
 * Blocking (founder feedback 2026-10-30): a Blocking card on Focus opens one screen for the apps to block and when.
 *
 *  (a) Focus shows the card: the apps (categories on web) and "Focus sessions · 1 habit".
 *  (b) The Block tab (US-107, compact): "Focus sessions · Always", "During my habits" (tap → off, saved),
 *      a blocker: validation, add, edit, delete. No notice, no category list (founder 2026-11-07).
 *  (c) The card follows the rules; Settings links to the same screen.
 * Web has no Screen Time, so nothing is enforced here: the iOS windows are a device check.
 */
import { start } from './lib.mjs';

const t = await start('blocking');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const checked = async (l) => (await label(l).last().getAttribute('aria-checked')) === 'true';

const db = {
  meta_goals: [{ id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 }],
  daily_actions: [
    { id: 'h_gym', goal_id: 'g0', name: 'Gym', type: 'session', target_minutes: 60, reminder_time: '07:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 1 },
    { id: 'h_walk', goal_id: 'g0', name: 'Walk', type: 'session', target_minutes: 20, reminder_time: null, is_active: 1, sort_order: 1, objective_id: null, days_mask: 127, strict: 1 },
  ],
  objectives: [],
  tasks: [],
  focus_sessions: [],
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

// ── (a) the card on Focus ──
await t.goto('/focus');
await t.waitText('Pick where your next hour goes.', 240000);
await t.wait(1200);
ok(await has('Blocking') && await has('Social, Games, Entertainment'), 'Focus: Blocking card with the apps (default categories on web)');
ok(await has('Focus sessions · 1 habit'), 'Focus: "Focus sessions · 1 habit" (only Gym has a start time)');
await shot('focus-card');
await t.tap('Blocking', 1500);
await t.waitText('Blocking now', 60000);
const card = (re) => page.getByLabel(re);

// ── (b) the Block tab ──
ok(page.url().includes('/block'), 'the card opens the Block tab (/blocking redirects there, US-103)');
ok(!(await has('only works in the Intentional iPhone app')) && !(await has('Shopping')), 'no web notice and no category list (US-107)');
ok((await page.getByLabel('Focus sessions: Always', { exact: true }).count()) === 1, 'Blocking now: "Focus sessions · Always"');
ok(await has('1 habit with a start time'), '"During my habits" counts the habits with a start time');
ok((await card(/^During my habits: (Active|Next)/).count()) === 1, '"During my habits" is on by default');
await shot('screen');

await card(/^During my habits: /).last().click();
await t.wait(700);
ok((await label('During my habits: Off').count()) === 1 && (await readSettings()).block_during_habits === '0', 'tapping "During my habits" turns it off (after a confirm) and is saved');

await t.tap('Add blocker', 800);
for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) await label(d).last().click();
await t.tap('Add blocker now', 400);
ok(await has("Tap the days it's on."), 'no day → "Tap the days it\'s on."');
await t.tap('Weekdays', 200);
await label('From').last().fill('09:00');
await label('To').last().fill('09:05');
await t.tap('Add blocker now', 400);
ok(await has('At least 15 minutes.'), 'too short is refused');
await label('To').last().fill('12:00');
await shot('form');
await t.tap('Add blocker now', 900);
ok(await has('Mon–Fri · 9:00–12:00'), 'saved: "Mon–Fri · 9:00–12:00"');
let rules = JSON.parse((await readSettings()).block_rules_v1 || '[]');
ok(rules.length === 1 && rules[0].days_mask === 31 && rules[0].start === '09:00' && rules[0].end === '12:00' && rules[0].enabled && rules[0].name === 'Block hours', 'rule stored (Mon–Fri, 09:00–12:00, on, named "Block hours")');
await shot('rule');

await card(/^Block hours: /).last().click();
await t.wait(800);
await label('To').last().fill('13:30');
await t.tap('Save changes', 900);
ok(await has('Mon–Fri · 9:00–13:30'), 'edit: the end moves to 13:30');

// ── (c) the card follows; the Block tab opens it (US-102) ──
await t.goto('/focus'); // the Block tab has no Back: it's a tab (US-103)
await t.waitText('Pick where your next hour goes.', 60000);
ok(await has('Social, Games, Entertainment') && await has('Focus sessions') && !(await has('Focus sessions · 1 habit')), 'Focus card: the apps, habits off');

await t.goto('/today');
await page.getByRole('tab', { name: 'Block' }).waitFor({ timeout: 240000 });
await page.getByRole('tab', { name: 'Block' }).click();
await t.waitText('Blocking now', 60000);
ok(page.url().includes('/block'), 'the Block tab opens the same blocking screen');

await card(/^Block hours: /).last().click();
await t.wait(800);
await t.tap('Delete blocker', 900);
ok(!(await has('Mon–Fri · 9:00–13:30')) && JSON.parse((await readSettings()).block_rules_v1 || '[]').length === 0, 'delete removes the rule');
const w = await page.evaluate(() => document.documentElement.scrollWidth);
ok(w <= 390, `no horizontal scroll (${w})`);

await t.finish();
