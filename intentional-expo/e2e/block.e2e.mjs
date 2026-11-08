/**
 * US-103 · The Block tab, with the clock fixed on Thursday 10:00.
 *  (a) The tab: "Block", Blocking now (Focus sessions · Always), Presets, Your block hours, Your apps, Unlocking early.
 *  (b) Work hours preset: one tap → On, stored as Mon–Fri 9:00–17:00 tagged "work"; Blocking now shows "Work hours · Active".
 *  (c) Bedtime preset: two same-day rules (22:00–23:59 and 0:00–7:00), one card "Next at 22:00".
 *  (d) Tapping a preset again removes exactly its rules; the person's own block hours stay.
 *  (e) /blocking (old links) lands on the Block tab.
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

// ── (e) + (a) ──
await t.goto('/blocking');
await t.waitText('Blocking now', 60000);
ok(page.url().includes('/block') && !page.url().includes('/blocking'), '/blocking lands on the Block tab');
for (const h of ['Block', 'Blocking now', 'Presets', 'Your block hours', 'Your apps', 'Unlocking early'])
  ok((await page.getByRole('heading', { name: h, exact: true }).count()) >= 1, `section "${h}"`);
ok((await label('Focus sessions: Always').count()) === 1, 'Blocking now: Focus sessions · Always');
ok((await label('Block hours: Next at 13:00').count()) === 1, 'your own block hours (13:00–14:00): "Next at 13:00" at 10:00');
ok((await label('During my habits: Next at 18:00').count()) === 1, 'During my habits: "Next at 18:00" (Gym)');
ok(!(await isOn('Preset Work hours')) && !(await isOn('Preset Bedtime')), 'presets start off');
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
await page.getByLabel('Preset Morning focus', { exact: true }).scrollIntoViewIfNeeded();
await t.wait(500);
await shot('presets-on');

// ── (d) remove ──
await label('Preset Work hours').click();
await t.wait(700);
rules = await rulesOf();
ok(!(await isOn('Preset Work hours')) && !rules.some((r) => r.preset === 'work'), 'a second tap removes Work hours');
ok(rules.some((r) => r.id === 'own1') && rules.filter((r) => r.preset === 'bedtime').length === 2, 'your own block hours and Bedtime stay');
ok((await label('Work hours: Active').count()) === 0, 'Work hours leaves Blocking now');

await t.finish();
