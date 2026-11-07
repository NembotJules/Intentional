/**
 * US-103 → US-107 · The Block tab, compact, with the clock fixed on Thursday 10:00.
 *  (a) The tab: "Block" + Add blocker, Blocking now, Scheduled, Presets for you, Your apps. No info banner, no list of
 *      app categories, no "Unlocking early" section.
 *  (b) Work hours preset: one tap → On, stored as Mon–Fri 9:00–17:00 tagged "work"; its card "Work hours · Active".
 *  (c) Bedtime preset: two same-day rules (22:00–23:59 and 0:00–7:00), one card "Next at 22:00".
 *  (d) Tapping a preset that's on opens its sheet; Delete removes exactly its rules; the rest stays.
 *  (e) Add blocker: name, sticker, a schedule across midnight, weekdays → two rules, one "Study" card.
 *  (f) Edit a card → All day → "Active" now; (g) a bad window shows why and doesn't save.
 *  (h) Your apps: nothing chosen on the web, one Choose button. (i) /blocking (old links) lands on the Block tab.
 */
import { start } from './lib.mjs';

const t = await start('block');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const rulesOf = async () => JSON.parse((await readSettings()).block_rules_v1 || '[]');
const isOn = async (l) => (await label(l).last().getAttribute('aria-checked')) === 'true';

const thu = new Date(2026, 10, 5, 10, 0, 0);
await page.clock.install({ time: thu });
await page.clock.resume();

const own = { id: 'own1', days_mask: 127, start: '13:00', end: '14:00', enabled: true };
const db = {
  meta_goals: [{ id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 }],
  daily_actions: [{ id: 'h_gym', goal_id: 'g0', name: 'Gym', type: 'session', target_minutes: 60, reminder_time: '18:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 1 }],
  objectives: [], tasks: [], focus_sessions: [], habit_completions: [], habit_skips: [], milestones: [], weekly_reviews: [],
  settings: [{ key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { hasCompletedOnboarding: '1', milestones_backfilled: '1', flick_stage_seen: '0', block_rules_v1: JSON.stringify([own]) };

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// ── (i) + (a) ──
await t.goto('/blocking');
await t.waitText('Blocking now', 60000);
ok(page.url().includes('/block') && !page.url().includes('/blocking'), '/blocking lands on the Block tab');
for (const h of ['Block', 'Blocking now', 'Scheduled', 'Presets for you', 'Your apps'])
  ok((await page.getByRole('heading', { name: h, exact: true }).count()) >= 1, `section "${h}"`);
for (const h of ['Unlocking early', 'Your block hours', 'Presets'])
  ok((await page.getByRole('heading', { name: h, exact: true }).count()) === 0, `no "${h}" section`);
const b0 = await t.body();
ok(!b0.includes('Blocking runs on Apple') && !b0.includes('Try the unlock screen') && !b0.includes('Open a blocked app and Intentional asks'), 'no banner, no unlocking text');
ok((await page.getByRole('checkbox', { name: 'Social media' }).count()) === 0 && !b0.includes('The kinds of apps'), 'no list of app categories');
ok((await label('Add blocker').count()) === 1, 'an "Add blocker" button');
ok((await label('Focus sessions: Always').count()) === 1, 'Blocking now: Focus sessions · Always');
ok((await label('Block hours: Next at 13:00').count()) === 1, 'Scheduled: your own block hours (13:00–14:00), "Next at 13:00"');
ok((await label('During my habits: Next at 18:00').count()) === 1, 'Scheduled: During my habits, "Next at 18:00" (Gym)');
ok(!(await isOn('Preset Work hours')) && !(await isOn('Preset Bedtime')), 'presets start off');
for (const p of ['Bedtime', 'Work hours', 'Morning focus', 'Evening wind-down', 'Dinner time']) ok((await label(`Preset ${p}`).count()) === 1, `preset "${p}"`);
await t.wait(1500); // the cards come in one by one
await shot('block-top');

// ── (b) Work hours ──
await label('Preset Work hours').click();
await t.wait(700);
let rules = await rulesOf();
const work = rules.filter((r) => r.preset === 'work');
ok(await isOn('Preset Work hours'), 'one tap: Work hours is on');
ok(work.length === 1 && work[0].days_mask === 31 && work[0].start === '09:00' && work[0].end === '17:00' && work[0].enabled, 'stored: Mon–Fri 9:00–17:00, tagged "work"');
ok((await label('Work hours: Active').count()) === 1, 'Blocking now: "Work hours · Active" on Thursday 10:00');

// ── (c) Bedtime ──
await label('Preset Bedtime').click();
await t.wait(700);
rules = await rulesOf();
const bed = rules.filter((r) => r.preset === 'bedtime').map((r) => `${r.start}-${r.end}/${r.days_mask}`);
ok(bed.join(',') === '22:00-23:59/127,00:00-07:00/127', `Bedtime = two same-day rules, every day (${bed})`);
ok((await label('Bedtime: Next at 22:00').count()) === 1, 'one Bedtime card: "Next at 22:00"');
ok(await has('Every day · 22:00–7:00'), 'Bedtime reads as one window');
await shot('presets-on');

// ── (d) a preset that's on opens its sheet; Delete ──
await label('Preset Work hours').click();
await t.wait(900);
ok((await label('Save changes').count()) === 1 && (await label('Blocker name').last().inputValue()) === 'Work hours', 'tapping Work hours again opens its sheet');
await label('Delete blocker').last().click();
await t.wait(900);
rules = await rulesOf();
ok(!(await isOn('Preset Work hours')) && !rules.some((r) => r.preset === 'work'), 'Delete removes Work hours');
ok(rules.some((r) => r.id === 'own1') && rules.filter((r) => r.preset === 'bedtime').length === 2, 'your own block hours and Bedtime stay');
ok((await label('Work hours: Active').count()) === 0, 'Work hours leaves Blocking now');

// ── (e) Add blocker ──
await label('Add blocker').click();
await t.wait(900);
ok((await label('Add blocker now').count()) === 1, 'the sheet opens');
ok((await label('All day').count()) === 1 && (await label('Schedule').count()) === 1, 'All day / Schedule');
await label('Blocker name').last().fill('Study');
await label('Change sticker').last().click();
await t.wait(300);
ok((await label('Sticker book').count()) === 1, 'a grid of stickers');
await label('Sticker book').last().click();
await label('From').last().fill('23:00');
await label('To').last().fill('06:30');
await label('Weekdays').last().click();
await t.wait(300);
await shot('blocker-sheet');
await label('Add blocker now').last().click();
await t.wait(900);
rules = await rulesOf();
const study = rules.filter((r) => r.name === 'Study');
ok(study.length === 2 && study.map((r) => `${r.start}-${r.end}/${r.days_mask}`).join(',') === '23:00-23:59/31,00:00-06:30/31' && study.every((r) => r.sticker === 'book' && r.group === study[0].group), `Study = two same-day rules, Mon–Fri, one group (${study.map((r) => r.start + '-' + r.end)})`);
ok((await label('Study: Next at 23:00').count()) === 1 && (await has('Mon–Fri · 23:00–6:30')), 'one "Study" card: Mon–Fri · 23:00–6:30, next at 23:00');

// ── (f) edit → All day ──
await label('Block hours: Next at 13:00').click();
await t.wait(900);
await label('All day').last().click();
await label('Save changes').last().click();
await t.wait(900);
rules = await rulesOf();
const allDay = rules.filter((r) => r.group === 'own1' || r.id === 'own1');
ok(allDay.length === 1 && allDay[0].start === '00:00' && allDay[0].end === '23:59', 'All day is stored as 00:00–23:59');
ok((await label('Block hours: Active').count()) === 1 && (await has('All day')), 'the card says "All day" and is active now');

// ── (g) a bad window ──
await label('Add blocker').click();
await t.wait(900);
await label('From').last().fill('10:00');
await label('To').last().fill('10:00');
await label('Add blocker now').last().click();
await t.wait(400);
ok(await has('Pick an end time.'), 'same start and end: "Pick an end time."');
const before = (await rulesOf()).length;
ok((await label('Add blocker now').count()) === 1 && before === rules.length, 'nothing saved, the sheet stays');
await label('Close').last().click({ position: { x: 195, y: 30 } });
await t.wait(600);

// ── (h) Your apps ──
ok((await label('No apps chosen yet').count()) === 1, 'Your apps: empty app-icon slots on the web (no tokens there)');
ok(await has('Pick the apps themselves, like TikTok or Instagram.'), 'one line nudges toward individual apps');
await page.getByText('Pick the apps themselves, like TikTok or Instagram.').scrollIntoViewIfNeeded();
await t.wait(400);
await shot('your-apps');
ok(!(await t.body()).includes('Entertainment') && !(await t.body()).includes('Social media'), 'no app categories anywhere on the Block tab');
await label('Choose apps').click();
await t.wait(400);
ok(await has('You choose your apps in the Intentional iPhone app.'), 'Choose on the web says where it works');

await t.finish();
