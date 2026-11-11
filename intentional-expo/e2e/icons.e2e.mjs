/**
 * US-128 · Flick-style hero icons: the tab bar (sun, target, lock, chart), the streak flame, the empty states that
 * used thin line icons (session history, weekly reviews), and the world unlock padlock. Every sticker image must load;
 * the screenshots are the visual check.
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('icons');
const { page } = t;

const brokenImages = () => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(0, 80)));
const crop = (label, y, h) => page.screenshot({ path: `e2e/artifacts/icons/${label}.png`, clip: { x: 0, y, width: 390, height: h } });

await t.goto('/');
const { db, settings } = makeDb({
  pillars: [['Health', '#52B788', 'heart']],
  habits: [{ pillar: 0, name: 'Run' }],
  completions: [0, -1, -2].map((d, k) => ({ id: 'c' + k, action_id: 'a0', date: today(d), completed_at: new Date().toISOString() })),
});
await t.seed(db, settings);
await t.goto('/today');
await t.waitText('Today', 30000);
await t.wait(2500);
for (const tab of ['Today', 'Goals', 'Block', 'Progress']) t.ok((await page.getByLabel(tab, { exact: true }).count()) > 0, `tab bar shows ${tab}`);
await t.shot('today');
await crop('tabbar-today', 844 - 130, 130);
t.ok((await brokenImages()).length === 0, 'every image on Today loads');

await t.tap('Progress', 1500);
await crop('tabbar-progress', 844 - 130, 130);
t.ok((await brokenImages()).length === 0, 'every image on Progress loads');

for (const [route, text] of [
  ['/streak', 'streak'],
  ['/session-history', 'No sessions here yet'],
  ['/reviews-history', 'No reviews yet'],
  ['/worlds', 'World'],
]) {
  await t.goto(route);
  await page.getByText(new RegExp(text, 'i')).first().waitFor({ timeout: 30000 });
  await t.wait(1500);
  await t.shot(route.slice(1));
  t.ok((await brokenImages()).length === 0, `every image on ${route} loads`);
}

await t.finish();
