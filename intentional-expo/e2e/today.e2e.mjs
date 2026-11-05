/**
 * US-098 · The new Today ("Flick's world"), at scale (6 pillars, 16 habits), clock fixed at 14:10:
 *  - one thing per block: greeting → Flick's world → one big number → three tiles → up next → pillar rows;
 *  - no filter chips, no repeated "no goal" nudges, no horizontal scroll;
 *  - pillar rows start closed; a row opens to its habits (all open ones, finished ones tucked in "N done"),
 *    closes again, and the open state survives a reload;
 *  - the tiles agree with the rows (habits done = the sum of the row badges).
 */
import { start, makeDb, today } from './lib.mjs';

const t = await start('today');
const { page, ok, shot } = t;
const label = (l) => page.getByLabel(l, { exact: true });
const now = new Date();
const at = (h, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
await page.clock.install({ time: at(14, 10) });
await page.clock.resume();

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
// 25 minutes given to Craft today (an hour ago).
db.focus_sessions = [{ id: 's1', action_id: null, goal_id: 'g1', started_at: at(13, 0).toISOString(), ended_at: at(13, 25).toISOString(), duration_seconds: 1500, note: null, was_completed: 1, task_id: null, objective_id: null }];

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);
await t.goto('/today');
await label('Body, 2 of 6 done').waitFor({ timeout: 60000 });
await t.wait(1500);
await shot('top');

const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(sw <= iw, `no horizontal scroll (${sw}/${iw})`);
let b = await t.body();

// ── the blocks, in order ──
ok(b.includes('Good afternoon, Benjamin'), 'greeting on one line with the name');
ok((await label("Flick's world, day").count()) === 1, 'Flick\'s world at the top, with a day sky at 14:10');
ok((await label('Flick is a Spark, 10h to Flame').count()) === 1, 'the stage badge sits in the world');
ok((await page.getByLabel(/^Flick, (calm|happy|worried|proud)$|^Flick is proud$/).count()) === 1, 'Flick stands in the world (tappable)');
ok((await label('25m given today').count()) === 1 || (await page.getByLabel(/^25m given today/).count()) === 1, 'one big number: 25m given today');
ok((await label('Habits done: 4 of 16').count()) === 1, 'tile: habits done 4 of 16');
ok((await label('Sessions today: 1').count()) === 1, 'tile: 1 session today');
ok((await label('Pillars given time today: 1 of 6').count()) === 1, 'tile: 1 of 6 pillars given time');
ok((await page.getByLabel(/^Up next: /).count()) === 1, 'one "Up next" card');
ok((await label('Free session').count()) === 1, 'a free session is one tap away');
ok((await label('All').count()) === 0 && !b.includes('Show 1 more'), 'no filter chips, no "Show N more"');
ok(!b.includes('has no goal running') && !b.includes('has no goal yet'), 'no repeated "no goal" nudges on Today');

// ── the tiles agree with the rows ──
const badgeSum = await page.evaluate(() => {
  let d = 0;
  let n = 0;
  for (const el of document.querySelectorAll('[aria-label]')) {
    const m = /^(.+), (\d+) of (\d+) done$/.exec(el.getAttribute('aria-label'));
    if (m) {
      d += Number(m[2]);
      n += Number(m[3]);
    }
  }
  return [d, n];
});
ok(badgeSum[0] === 4 && badgeSum[1] === 16, `habits-done tile equals the sum of the pillar rows (${badgeSum})`);

// ── rows start closed; a row opens to its habits ──
ok((await label('Up next: Body habit 3, Anytime today').count()) === 1, 'up next: the first open habit (Body habit 3, anytime)');
ok(!b.includes('Body habit 5') && !b.includes('Mind habit 1'), 'pillar rows start closed (no habit listed beyond up next)');
await label('Body, 2 of 6 done').click();
await t.wait(600);
b = await t.body();
ok(['Body habit 3', 'Body habit 4', 'Body habit 5', 'Body habit 6'].every((n) => b.includes(n)), 'opening Body lists all 4 open habits');
ok(b.includes('2 done') && !b.includes('Body habit 1'), 'finished Body habits tucked into "2 done"');
await label('2 done in Body').click();
await t.wait(400);
ok((await t.body()).includes('Body habit 1'), '"2 done" shows the finished ones');
await page.mouse.move(195, 400);
await page.mouse.wheel(0, 700);
await t.wait(500);
await shot('body-open');
await label('Body, 2 of 6 done').click();
await t.wait(500);
ok(!(await t.body()).includes('Body habit 5'), 'tapping Body again closes it');
await label('Mind, 2 of 2 done').click();
await t.wait(500);
ok((await t.body()).includes('2 done'), 'a finished pillar opens to its "2 done"');

await page.reload({ waitUntil: 'domcontentloaded' });
await label('Body, 2 of 6 done').waitFor({ timeout: 60000 });
await t.wait(1500);
b = await t.body();
ok(!b.includes('Body habit 5') && b.includes('2 done'), 'open / closed rows remembered after reload (Body closed, Mind open)');
await page.mouse.wheel(0, -3000);
await t.wait(300);
await shot('after-reload');

await t.finish();
