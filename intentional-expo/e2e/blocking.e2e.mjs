/**
 * Blocking (founder feedback 2026-10-30): a Blocking card on Focus opens one screen for the apps to block and when.
 *
 *  (a) Focus shows the card: the apps (categories on web) and "Focus sessions · 1 habit".
 *  (b) The screen: the web/Expo Go notice, the category list (saved), "Every focus session · Always",
 *      "During my habits" switch, block hours: validation, add, edit, turn off, delete.
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
await t.waitText('Keep distracting apps out of the hours you chose.', 60000);

// ── (b) the screen ──
ok(page.url().includes('/blocking'), 'the card opens /blocking');
ok(await has('only works in the Intentional iPhone app'), 'web: says blocking needs the iPhone app, and that choices are saved');
ok(await has('Every focus session') && await has('Always'), '"Every focus session · Always"');
ok(await has('1 habit with a start time'), '"During my habits" counts the habits with a start time');
ok(await checked('Block during my habits'), '"During my habits" is on by default');
await shot('screen');

await t.tap('Shopping', 300);
ok(JSON.parse((await readSettings()).blocked_category_ids || '[]').includes('shopping'), 'a category tap is saved');

await t.tap('Block during my habits', 500);
ok(!(await checked('Block during my habits')) && (await readSettings()).block_during_habits === '0', '"During my habits" switches off and is saved');

await t.tap('Add block hours', 600);
ok(await has('New block hours') && await has('Tap the days to block.'), 'block hours form: no day picked yet');
await t.tap('Add', 400);
ok(await has("Tap the days it's on."), 'no day → "Tap the days it\'s on."');
await t.tap('Weekdays', 200);
await label('From').fill('12:00');
await label('To').fill('09:00');
await t.tap('Add', 400);
ok(await has('The end must be after the start (same day).'), 'end before start is refused');
await label('From').fill('09:00');
await label('To').fill('12:00');
await shot('form');
await t.tap('Add', 800);
ok(await has('Mon–Fri · 9:00–12:00'), 'saved: "Mon–Fri · 9:00–12:00"');
let rules = JSON.parse((await readSettings()).block_rules_v1 || '[]');
ok(rules.length === 1 && rules[0].days_mask === 31 && rules[0].start === '09:00' && rules[0].end === '12:00' && rules[0].enabled, 'rule stored (Mon–Fri, 09:00–12:00, on)');
await shot('rule');

await t.tap('Edit block hours Mon–Fri · 9:00–12:00', 600);
await label('To').fill('13:30');
await t.tap('Save', 800);
ok(await has('Mon–Fri · 9:00–13:30'), 'edit: the end moves to 13:30');

await t.tap('Block hours Mon–Fri · 9:00–13:30', 500);
rules = JSON.parse((await readSettings()).block_rules_v1 || '[]');
ok(rules[0]?.enabled === false, 'the rule switch turns it off');

// ── (c) the card follows; Settings links here ──
await t.tap('Back', 1500);
await t.waitText('Pick where your next hour goes.', 60000);
ok(await has('Social, Games, Entertainment +1') && await has('Focus sessions') && !(await has('Focus sessions · 1 habit')), 'Focus card: +1 category, habits off, rule off');

await t.goto('/settings');
await t.waitText('Blocking rules', 240000);
await t.tap('Blocking rules', 1500);
await t.waitText('Keep distracting apps out of the hours you chose.', 60000);
ok(page.url().includes('/blocking'), 'Settings → Blocking rules opens the same screen');

await t.tap('Edit block hours Mon–Fri · 9:00–13:30', 600);
await t.tap('Delete block hours', 800);
ok(!(await has('Mon–Fri · 9:00–13:30')) && JSON.parse((await readSettings()).block_rules_v1 || '[]').length === 0, 'delete removes the rule');
const w = await page.evaluate(() => document.documentElement.scrollWidth);
ok(w <= 390, `no horizontal scroll (${w})`);

await t.finish();
