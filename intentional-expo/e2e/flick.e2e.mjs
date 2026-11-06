/**
 * Flick evolves with lifetime hours (US-079).
 *
 * For each stage (Spark 0h · Flame 10h · Torch 50h · Bonfire 150h · Beacon 500h · Sun 1000h) we seed lifetime hours just past
 * the threshold with the previous stage marked as seen, and assert:
 *   - the full-screen celebration appears with the typed line, once (the seen stage is stored, a reload shows nothing),
 *   - Today shows the stage next to the greeting with the hours to the next one, Insights shows the same.
 * Also: the first check ever (no stored stage) stamps silently, and losing hours never demotes Flick.
 * Screenshots: one celebration and one Today header per stage.
 */
import { start, today } from './lib.mjs';

const t = await start('flick');
const { page, ok, has, shot } = t;

const iso = (offsetDays, h = 9) => {
  const [y, m, d] = today(offsetDays).split('-').map(Number);
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
};
const pillars = [
  ['g0', 'Body', '#D65A31', 'body'],
  ['g1', 'Craft', '#A66A00', 'craft'],
];
/** `hours` of lifetime time, spread as 2h sessions over past days (none this week beyond today's one). */
function sessionsFor(hours) {
  const out = [];
  let left = hours * 60;
  let k = 0;
  while (left > 0) {
    const mins = Math.min(120, left);
    out.push({ id: 's' + k, action_id: null, goal_id: k % 2 ? 'g1' : 'g0', started_at: iso(-10 - Math.floor(k / 3), 8 + (k % 3) * 3), ended_at: iso(-10 - Math.floor(k / 3)), duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: null });
    left -= mins;
    k += 1;
  }
  return out;
}
const dbWith = (hours, extra = []) => ({
  meta_goals: pillars.map(([id, name, color, icon], k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 })),
  daily_actions: [],
  focus_sessions: [...sessionsFor(hours), ...extra],
  habit_completions: [],
  objectives: [],
  tasks: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
});
const settingsWith = (seen) => ({ user_name: 'Alex', hasCompletedOnboarding: '1', ...(seen === null ? {} : { flick_stage_seen: String(seen) }) });
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const celebrating = () => page.getByText('given to the life you chose.', { exact: false }).count();

await t.goto('/');
await page.waitForTimeout(2000);

// ── First check ever: 60h of history, no stored stage → stamped as Torch, no celebration ──
await t.seed(dbWith(60), settingsWith(null));
await t.goto('/today');
await t.waitText('Good', 240000);
await page.waitForTimeout(2500);
ok((await celebrating()) === 0, 'first check ever: no celebration for existing history');
ok((await readSettings()).flick_stage_seen === '2', 'first check ever: current stage (Torch = 2) stamped silently');
ok(await has('Torch') && await has('90h to Bonfire'), 'Today: stage + hours to next next to the greeting (60h → 90h to Bonfire)');

// ── Each stage: crossing the threshold celebrates once ──
const STAGES = [
  ['Spark', 0, 'Flame', '10h to Flame'],
  ['Flame', 10, 'Torch', '40h to Torch'],
  ['Torch', 50, 'Bonfire', '100h to Bonfire'],
  ['Bonfire', 150, 'Beacon', '350h to Beacon'],
  ['Beacon', 500, 'Sun', '500h to Sun'],
  ['Sun', 1000, null, 'the brightest stage'],
];
// US-101: each stage-up's colour (services/celebrations.STAGE_COLORS) and the world it earns.
const STAGE_RGB = ['rgb(255, 122, 58)', 'rgb(255, 107, 53)', 'rgb(232, 137, 12)', 'rgb(217, 72, 15)', 'rgb(112, 72, 232)', 'rgb(232, 161, 0)'];
const WORLDS = { Flame: 'The Forest', Torch: 'The Beach', Bonfire: 'The Mountain lake', Beacon: 'The Rooftop' };
for (let i = 0; i < STAGES.length; i++) {
  const [name, hours, , toNext] = STAGES[i];
  await t.seed(dbWith(hours), settingsWith(Math.max(0, i - 1)));
  await t.goto('/today');
  await t.waitText('Good', 240000);
  if (i === 0) {
    await page.waitForTimeout(2500);
    ok((await celebrating()) === 0, 'Spark (0h): nothing to celebrate');
  } else {
    const line = `Flick is now a ${name}. ${hours.toLocaleString('en-US')} hours given to the life you chose.`;
    await t.waitText(line, 20000).catch(() => {});
    await page.waitForTimeout(1500); // let the line finish typing
    ok(await has(line), `${name}: celebration with the typed line "${line}"`);
    ok(await has(`New stage · ${hours.toLocaleString('en-US')} hours`), `${name}: celebration eyebrow`);
    ok(await has(STAGES[i + 1] ? `Next: ${STAGES[i + 1][0]} at ${STAGES[i + 1][1].toLocaleString('en-US')} hours.` : 'The brightest stage. Every hour still counts.'), `${name}: what comes next`);
    await shot(`celebrate-${name.toLowerCase()}`);
    ok((await readSettings()).flick_stage_seen === String(i), `${name}: stage ${i} stored as seen`);
    // US-101: full colour, in the stage's own colour.
    const colour = STAGE_RGB[i];
    ok(await page.evaluate((c) => [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).backgroundColor === c), colour), `${name}: a full-colour screen (${colour})`);
    const world = WORLDS[name];
    if (world) {
      // The world this stage earns comes right after it.
      ok((await page.getByLabel('Next', { exact: true }).count()) > 0, `${name}: "Next", because its world is queued`);
      await t.tap('Next', 1200);
      await t.waitText('New world unlocked!', 10000).catch(() => {});
      ok((await has('New world unlocked!')) && (await has(world)), `${name}: then "New world unlocked!": ${world}`);
      await shot(`world-${name.toLowerCase()}`);
      await t.tap('Later', 800);
      ok(!(await has('New world unlocked!')) && (await celebrating()) === 0, `${name}: "Later" closes it`);
    } else {
      await t.tap('Continue', 800);
      ok((await celebrating()) === 0, `${name}: Continue closes the celebration`);
    }
  }
  ok(await has(name) && await has(`· ${toNext}`), `${name}: Today pill "${name} · ${toNext}"`);
  await shot(`today-${name.toLowerCase()}`);
  if (i > 0) {
    // Reload: it fired once, it doesn't fire again.
    await t.goto('/today');
    await t.waitText('Good', 240000);
    await page.waitForTimeout(2500);
    ok((await celebrating()) === 0, `${name}: no second celebration after a reload`);
  }
}

// ── Insights shows the stage too, and taps through to Your life in hours ──
await t.seed(dbWith(13), settingsWith(1));
await t.goto('/insights');
await t.waitText('Flick is a Flame', 240000);
ok(await has('· 37h to Torch'), 'Insights: "Flick is a Flame · 37h to Torch" (13h)');
await shot('insights-flame');
await page.getByLabel('Flick is a Flame. 37h to Torch. Open your life in hours', { exact: true }).click();
await page.waitForURL(/\/life/, { timeout: 60000 });
await page.waitForTimeout(1500);
ok(await has('Flick is a Flame') && await has('37h to Torch'), 'Insights → Life: same stage and hours to next');

// ── Never goes down: Torch was reached, sessions deleted down to 20h → still a Torch, no celebration ──
await t.seed(dbWith(20), settingsWith(2));
await t.goto('/today');
await t.waitText('Good', 240000);
await page.waitForTimeout(2500);
ok((await celebrating()) === 0, 'demotion: no celebration');
ok(await has('Torch') && !(await has('Flame ·')), 'demotion: Today still shows Torch after hours dropped to 20h');
ok((await readSettings()).flick_stage_seen === '2', 'demotion: stored stage stays Torch');

await t.finish();
