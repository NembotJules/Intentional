/**
 * US-101 · Rewards you can see: full-colour stage-ups and Flick's worlds, earned with real hours.
 *  (a) 10.5 h of history, last seen stage Spark → the Flame stage-up (full colour) → "New world unlocked!": the
 *      Forest, with a preview → "Try it" → Today's world is the Forest. A reload: nothing fires again.
 *  (e) US-125: "Try every world" in Settings (development builds) unlocks every world.
 *  (b) The picker (the globe on Today): the hill and the Forest unlocked, the Forest chosen; the Beach, the Lake
 *      and the Rooftop locked with the hours still to give. A locked world can't be chosen.
 *  (c) Choosing the hill brings Flick home; Settings → Flick's worlds opens the same picker.
 *  (d) A stored choice that isn't earned (the Rooftop at 10 h) shows Flick's hill.
 */
import { start, today } from './lib.mjs';

const t = await start('worlds');
const { page, ok, has, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });

const iso = (offsetDays, h = 9) => {
  const [y, m, d] = today(offsetDays).split('-').map(Number);
  return new Date(y, m - 1, d, h, 0, 0).toISOString();
};
function sessionsFor(hours) {
  const out = [];
  let left = hours * 60;
  let k = 0;
  while (left > 0) {
    const mins = Math.min(120, left);
    out.push({ id: 's' + k, action_id: null, goal_id: 'g0', started_at: iso(-10 - Math.floor(k / 3), 8 + (k % 3) * 3), ended_at: iso(-10 - Math.floor(k / 3)), duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: null });
    left -= mins;
    k += 1;
  }
  return out;
}
const dbWith = (hours) => ({
  meta_goals: [{ id: 'g0', name: 'Body', color: '#D65A31', icon: 'body', sort_order: 0, why_statement: '', is_archived: 0 }],
  daily_actions: [],
  focus_sessions: sessionsFor(hours),
  habit_completions: [],
  objectives: [],
  tasks: [],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
});
const base = { user_name: 'Alex', hasCompletedOnboarding: '1', milestones_backfilled: '1' };
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const worldLabel = () => page.getByLabel(/^Flick's world: /).first().getAttribute('aria-label');

await t.goto('/');
await t.wait(2000);

// ── (a) the stage-up, then the world it earns ──
await t.seed(dbWith(10.5), { ...base, flick_stage_seen: '0' });
await t.goto('/today');
await t.waitText('Flick is now a Flame. 10 hours given to the life you chose.', 60000).catch(() => {});
await t.wait(1500);
ok(await has('Flick is now a Flame. 10 hours given to the life you chose.'), 'the Flame stage-up');
ok(await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).backgroundColor === 'rgb(255, 107, 53)')), 'the stage-up is a full-colour screen (Flame orange)');
ok((await label('Flick, a Flame, celebrating').count()) === 1, 'Flick, big, in his new Flame look');
await shot('stage-flame');
await t.tap('Next', 1200);
await t.waitText('New world unlocked!', 10000).catch(() => {});
ok((await has('New world unlocked!')) && (await has('The Forest')) && (await has('Tall pines and a camp in the trees.')), '"New world unlocked!": The Forest, with its line');
ok(await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => getComputedStyle(d).backgroundColor === 'rgb(47, 143, 85)')), 'the world screen is full colour (forest green)');
ok((await label('Try it').count()) === 1 && (await label('Later').count()) === 1, '"Try it" and "Later"');
await shot('world-forest-unlocked');
await t.tap('Try it', 1500);
ok(!(await has('New world unlocked!')), '"Try it" closes it');
ok((await readSettings()).world_theme === 'forest', 'the Forest is stored as Flick\'s world');
// The 10-hours-to-Body milestone was queued behind the world: close it to see Today.
if (await has('10 hours to Body.')) await t.tap('Continue', 1200);
ok(!(await has('10 hours to Body.')) && !(await has('Flick is now a')), 'every celebration closed: Today underneath');
ok(/^Flick's world: The Forest, /.test((await worldLabel()) ?? ''), `Today: Flick's world is the Forest (${await worldLabel()})`);
await t.wait(1200);
await shot('today-forest');
await t.goto('/today');
await t.waitText('Good', 60000);
await t.wait(2500);
ok(!(await has('New world unlocked!')) && !(await has('Flick is now a')), 'a reload: nothing fires again');

// ── (b) the picker ──
await label("Flick's worlds").first().click();
await t.waitText('Every world is earned with hours given to your pillars.', 20000);
await t.wait(1800); // the cards' entrance
ok(await has('You’ve given 10 hours so far.'), 'the picker: "You\'ve given 10 hours so far."');
ok((await label('World: Flick’s hill').count()) === 1, 'Flick\'s hill: unlocked');
ok((await label('World: The Forest, chosen').count()) === 1, 'the Forest: unlocked and chosen');
ok((await label('World: The Beach, locked, 40 h to unlock').count()) === 1, 'the Beach: locked, 40 h to unlock');
ok((await label('World: The Mountain lake, locked, 140 h to unlock').count()) === 1, 'the Mountain lake: locked, 140 h to unlock');
ok((await label('World: The Rooftop, locked, 490 h to unlock').count()) === 1, 'the Rooftop: locked, 490 h to unlock');
await shot('picker');
await label('World: The Beach, locked, 40 h to unlock').click();
await t.wait(500);
ok(await has('The Beach opens after 40 more hours given to your pillars.'), 'a locked world says how many hours are left');
ok((await readSettings()).world_theme === 'forest' && (await label('World: The Forest, chosen').count()) === 1, 'a locked world can\'t be chosen: still the Forest');

// ── (c) back to the hill; Settings opens the picker too ──
await label('World: Flick’s hill').click();
await t.wait(500);
ok((await label('World: Flick’s hill, chosen').count()) === 1 && (await has('Flick now lives in Flick’s hill.')), 'choosing the hill');
await t.goto('/today');
await t.waitText('Good', 60000);
ok(/^Flick's world: Flick’s hill, /.test((await worldLabel()) ?? ''), 'Today: back on Flick\'s hill');
await t.goto('/settings');
await label("Flick's worlds").first().waitFor({ timeout: 30000 });
await label("Flick's worlds").first().click();
await t.waitText('Every world is earned', 20000);
ok(await has('Flick’s worlds'), 'Settings → Flick\'s worlds opens the picker');

// ── (d) a choice that isn't earned ──
await t.seed(dbWith(10.5), { ...base, flick_stage_seen: '1', world_theme: 'rooftop' });
await t.goto('/today');
await t.waitText('Good', 60000);
await t.wait(1500);
ok(/^Flick's world: Flick’s hill, /.test((await worldLabel()) ?? ''), `a stored Rooftop at 10 h shows Flick's hill (${await worldLabel()})`);

// ── (e) US-125 · "Try every world" (development builds): every world unlocked, the Rooftop can be chosen ──
await t.goto('/settings');
await label('Try every world').first().waitFor({ timeout: 30000 });
await label('Try every world').first().click();
await t.wait(400);
await label("Flick's worlds").first().click();
await t.waitText('Every world is earned', 20000);
ok((await page.getByLabel(/^World: .*, locked/).count()) === 0, 'Try every world: no world is locked');
// the Rooftop stored in (d) is now unlocked, so it's already Flick's world
ok((await label('World: The Rooftop, chosen').count()) === 1, 'Try every world: the stored Rooftop now counts (chosen)');
await label('World: The Beach').first().click();
await t.wait(500);
ok((await label('World: The Beach, chosen').count()) === 1, 'Try every world: the Beach can be chosen');
await t.goto('/today');
await t.waitText('Good', 60000);
await t.wait(1200);
ok(/^Flick's world: The Beach, /.test((await worldLabel()) ?? ''), `Today shows the Beach (${await worldLabel()})`);

await t.finish();
