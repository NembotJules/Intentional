/**
 * US-110 → US-113 · Redesign batch 5 (the brainrot-faithful design system), on the web at 390×844 and 375×812.
 *  (a) Today: the flame in the header shows the day streak and opens the streak moment (the number, "day streak!",
 *      this week's seven days).
 *  (b) Goals: nothing overlaps or clips on a pillar card: long names and "12h 45m", at 390 and 375 wide
 *      (founder 2026-11-07: the minutes overlapped the goal row).
 *  (c) Block: "Add blocker" → the big sticker → "Choose a sticker" grid → pick the moon → the sheet shows it.
 */
import { start, today } from './lib.mjs';

const t = await start('design5-e2e');
const { page, ok, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const d0 = new Date();
d0.setHours(9, 0, 0, 0);
const sess = (id, goal, min, daysAgo) => {
  const s = new Date(d0.getTime() - daysAgo * 86400000);
  return { id, action_id: null, goal_id: goal, started_at: s.toISOString(), ended_at: new Date(s.getTime() + min * 60000).toISOString(), duration_seconds: min * 60, note: null, was_completed: 1, task_id: null, objective_id: null };
};
const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
const LONG = 'Family and the people I love most in the world';
const GOAL = 'Run a half marathon under two hours this spring with friends';
const db = {
  meta_goals: [
    { id: 'g0', name: 'Body', color: '#D65A31', icon: 'dumbbell', sort_order: 0, why_statement: '', is_archived: 0 },
    { id: 'g1', name: LONG, color: '#2E9E5B', icon: 'heart', sort_order: 1, why_statement: '', is_archived: 0 },
  ],
  daily_actions: [],
  objectives: [
    { id: 'o0', pillar_id: 'g0', title: GOAL, done_when: '', deadline: today(160), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(86400000 * 20), closed_at: null, close_note: null },
    { id: 'o1', pillar_id: 'g1', title: GOAL, done_when: '', deadline: today(40), status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(86400000 * 20), closed_at: null, close_note: null },
  ],
  tasks: [],
  // today, yesterday, the day before: a 3-day streak; 12h 45m + 1h for Body this week (if the week started), long names everywhere
  focus_sessions: [sess('s0', 'g0', 30, 0), sess('s1', 'g1', 765, 0), sess('s2', 'g0', 20, 1), sess('s3', 'g0', 15, 2)],
  habit_completions: [], habit_skips: [], milestones: [], weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '9', milestones_backfilled: '1' };
const dismiss = async () => {
  for (let k = 0; k < 4; k++) {
    const b = page.getByRole('button', { name: /^(Continue|Next)$/ });
    if ((await b.count()) && (await page.getByText(/Milestone|New stage/).count())) {
      await b.last().click({ force: true });
      await t.wait(1200);
    } else break;
  }
};

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// ── (a) the streak ──
await t.goto('/today');
await label('Day streak: 3 days').first().waitFor({ timeout: 60000 });
await dismiss();
ok((await label('Day streak: 3 days').count()) === 1, 'the flame in the header shows a 3-day streak');
for (let k = 0; k < 3 && !page.url().includes('/streak'); k++) {
  await dismiss();
  await label('Day streak: 3 days').first().click({ force: true });
  await t.wait(2500);
}
await page.getByText('day streak!').first().waitFor({ timeout: 30000 });
ok((await label('3 day streak').count()) === 1, 'the streak moment: the huge "3"');
ok((await page.evaluate(() => globalThis.__jingles ?? [])).includes('streak'), 'US-131: the streak moment plays its sound');
await page.getByText('This week', { exact: true }).last().waitFor({ timeout: 10000 });
ok((await page.getByText('This week', { exact: true }).count()) >= 1, 'and this week');
const week = await page.getByLabel(/^\d{4}-\d{2}-\d{2}: (given|to come|not given)$/).allInnerTexts();
ok(week.length === 7, `seven days in the week card (${week.length})`);
ok((await page.getByLabel(new RegExp(`^${today(0)}: given$`)).count()) === 1, 'today is lit');
await shot('streak');
await label('Close').last().click({ force: true });
await t.wait(800);

// ── (b) Goals: no overlap, at 390 and 375 ──
const box = async (loc) => (await loc.count()) ? loc.first().boundingBox() : null;
const overlap = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
for (const w of [390, 375]) {
  await page.setViewportSize({ width: w, height: 812 });
  await t.goto('/goals');
  await label('Open Body').first().waitFor({ timeout: 60000 });
  await dismiss();
  await t.wait(1500);
  for (const name of ['Body', LONG]) {
    const card = await box(label(`Open ${name}`));
    const nameBox = await box(label(`Open ${name}`).getByText(name, { exact: true }));
    const num = await box(label(`Open ${name}`).getByLabel(/ this week$/));
    const goal = await box(label(`Open ${name}`).getByText(GOAL, { exact: true }));
    const left = await box(label(`Open ${name}`).getByText(/^\d+d left$/));
    ok(card && nameBox && num && goal && left, `${w}px · ${name.slice(0, 12)}: name, number, goal and days left are all there`);
    ok(!overlap(nameBox, num) && !overlap(goal, left) && !overlap(num, goal), `${w}px · ${name.slice(0, 12)}: nothing overlaps`);
    ok(num.x + num.width <= card.x + card.width - 4 && left.x + left.width <= card.x + card.width - 4, `${w}px · ${name.slice(0, 12)}: the number and "days left" stay inside the card`);
  }
  await shot(`goals-${w}`);
}
await page.setViewportSize({ width: 390, height: 844 });

// ── (c) Block: the sticker grid ──
await t.goto('/block');
await label('Add blocker').first().waitFor({ timeout: 60000 });
await dismiss();
await label('Add blocker').last().click();
await label('Change sticker').last().waitFor({ timeout: 10000 });
await label('Change sticker').last().click();
await page.getByText('Choose a sticker').last().waitFor({ timeout: 10000 });
ok((await page.getByLabel(/^Sticker /).count()) >= 12, 'a grid of stickers');
await shot('stickers');
await label('Sticker moon').last().click();
await t.wait(600);
ok((await page.getByText('Choose a sticker').count()) === 0, 'picking one closes the grid');
ok((await label('Change sticker').last().locator('img[src*="moon"], [style*="moon"]').count()) >= 1, 'the sheet\'s big sticker is now the moon');
await shot('sheet-moon');

await t.finish();
