/**
 * Today screen at scale: pillar chips wrap (no sideways scroll), pillars fold, finished
 * actions tuck into "N done", "Show N more" past 3 open actions, folds survive a reload.
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('today');
const { page, ok, shot } = t;
const P = [
  ['Body', '#D65A31', 'dumbbell'],
  ['Craft', '#A66A00', 'hammer'],
  ['Mind', '#4C6FFF', 'brain'],
  ['Finances', '#2F8F5B', 'wallet'],
  ['Family', '#E5484D', 'heart'],
  ['Faith', '#8E5CF6', 'heart'],
];
const counts = [6, 2, 2, 2, 3, 1];
const habits = counts.flatMap((n, p) => Array.from({ length: n }, (_, k) => ({ id: `g${p}a${k}`, pillar: p, name: `${P[p][0]} habit ${k + 1}` })));
const completions = ['g0a0', 'g0a1', 'g2a0', 'g2a1'].map((id) => ({ id: 'c' + id, action_id: id, date: today(), completed: 1 }));
const { db, settings } = makeDb({ pillars: P, habits, completions, name: 'Benjamin' });

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);
await t.goto('/today');
await page.getByLabel('All', { exact: true }).waitFor();
await t.wait(1500);
await shot('top');

const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(sw <= iw, `no horizontal scroll (${sw}/${iw})`);
let b = await t.body();
ok(b.includes('Show 1 more'), 'Body shows 3 open + "Show 1 more"');
ok(b.includes('2 done'), 'finished Body habits tucked into "2 done"');
ok(b.includes('All done for today'), 'fully done Mind pillar folded itself');
ok(!b.includes('Mind habit 1'), 'Mind habits hidden while folded');

await page.mouse.move(195, 400);
await page.mouse.wheel(0, 520);
await t.wait(600);
await shot('list');
await page.getByText('Show 1 more').click();
await t.wait(400);
ok((await t.body()).includes('Body habit 6'), '"Show 1 more" reveals the rest');
await page.getByLabel('Body, 2 of 6 done').click();
await t.wait(500);
ok(!(await t.body()).includes('Body habit 3'), 'tapping the Body header folds it');
await shot('folded');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByLabel('All', { exact: true }).waitFor();
await t.wait(1500);
ok(!(await t.body()).includes('Body habit 3'), 'fold remembered after reload');

await t.finish();
