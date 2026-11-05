/**
 * US-097 · Flick comes alive on Today (web). The browser clock is set per check, so the mood never depends on
 * when the suite runs.
 *  (a) 10:00, nothing given: Flick is calm. Tap → a speech bubble "Good morning, Alex!"; each tap the next line:
 *      the next habit, the pillar at zero, the stage. The bubble hides itself after a few seconds.
 *  (b) 19:00, still nothing given: Flick is worried.
 *  (c) 23:30: Flick is sleepy; a tap → "Still up, Alex? I'm half asleep."
 *  (d) at 19:00, Flick blinks (the eyes close for a moment now and then).
 * Not covered here: the proud hop when a habit is checked off (📱 / visual).
 */
import { start } from './lib.mjs';

const t = await start('flick-alive');
const { page, ok, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const now = new Date();
const at = (h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);

const db = {
  meta_goals: [
    { id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 },
    { id: 'g1', name: 'Craft', color: '#A66A00', icon: 'hammer', sort_order: 1, why_statement: '', is_archived: 0 },
  ],
  daily_actions: [{ id: 'h_gym', goal_id: 'g0', name: 'Gym', type: 'session', target_minutes: 60, reminder_time: '18:00', is_active: 1, sort_order: 0, objective_id: null, days_mask: 127, strict: 0 }],
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

await page.clock.install({ time: at(10) });
await page.clock.resume();
await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);
await t.goto('/today');
await label('Flick, calm').first().waitFor({ timeout: 30000 });

// ── (a) 10:00 ──
ok((await label('Flick, calm').count()) === 1, '10:00, nothing given: Flick is calm');
// Flick himself (not the "Flick is a Spark…" pill next to the greeting).
const flick = () => page.getByLabel(/^Flick, (calm|happy|worried|sleepy|proud)$|^Flick is proud$/).first();
const said = async () => (await page.getByLabel(/^Flick says: /).last().getAttribute('aria-label').catch(() => null))?.replace('Flick says: ', '') ?? null;
ok((await said()) === null, 'no bubble before a tap');
await flick().click({ force: true });
await t.wait(500);
ok((await said()) === 'Good morning, Alex!', `tap 1: "Good morning, Alex!" (${await said()})`);
await shot('bubble-1');
await flick().click({ force: true });
await t.wait(500);
ok((await said()) === 'Gym at 18:00. I’ll be ready.', `tap 2: the next habit (${await said()})`);
await flick().click({ force: true });
await t.wait(500);
ok((await said()) === 'Nothing given yet. Body would love ten minutes.', `tap 3: the first pillar at zero (${await said()})`);
await flick().click({ force: true });
await t.wait(500);
const stageLine = await said();
ok(/^I’m a Spark\. \d+h to Flame\.$/.test(stageLine ?? ''), `tap 4: the stage (${stageLine})`);
await shot('bubble-4');
await flick().click({ force: true });
await t.wait(500);
ok((await said()) === 'Good morning, Alex!', 'tap 5: back to the first line');
await t.wait(4500);
ok((await said()) === null, 'the bubble hides itself after a few seconds');

// ── (b) 19:00 ──
await page.clock.setSystemTime(at(19));
await t.goto('/today');
await label('Flick, worried').first().waitFor({ timeout: 30000 }).catch(() => {});
ok((await label('Flick, worried').count()) === 1, '19:00, still nothing given: Flick is worried');
await shot('worried');

// ── (d) blinks (open-eyed moods only: worried here; calm and proud have closed eyes) ──
// A blink swaps the open eyes for closed ones for ~130 ms, every 2.6–5.8 s: sample the Flick's SVG for a while.
const flickSel = '[aria-label="Flick, worried"] svg';
const base = await page.evaluate((sel) => document.querySelector(sel)?.innerHTML ?? '', flickSel);
// Poll from Node with real timers (the page's timers run on Playwright's clock).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let changed = false;
for (const end = Date.now() + 9000; Date.now() < end && !changed; await sleep(25)) {
  changed = (await page.evaluate((sel) => document.querySelector(sel)?.innerHTML ?? '', flickSel)) !== base;
}
ok(changed, 'Flick blinks (the face changes for a moment)');


// ── (c) 23:30 ──
await page.clock.setSystemTime(at(23, 30));
await t.goto('/today');
await label('Flick, sleepy').first().waitFor({ timeout: 30000 }).catch(() => {});
ok((await label('Flick, sleepy').count()) === 1, '23:30: Flick is sleepy');
await flick().click({ force: true });
await t.wait(500);
ok((await said()) === 'Still up, Alex? I’m half asleep.', `a tap at night (${await said()})`);
await shot('sleepy');

await t.finish();
