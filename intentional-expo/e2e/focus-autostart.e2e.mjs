/**
 * US-076: from notification to focus in one tap.
 * The notification handler opens /focus?actionId=<id>&autostart=1 (within 30 min of the start time,
 * see services/habitSchedule.intentFromResponse) or /focus?actionId=<id> (later: preselect only).
 *   (a) autostart → 3-second "Starting <habit> in 3…" overlay → the focus room runs the habit's duration
 *   (b) Cancel during the overlay → preparing screen, habit preselected, never starts
 *   (c) no autostart → preselect only
 *   (d) a session already running → "Switch to <Habit>?" · Keep current keeps it · Switch saves it and starts the habit
 *   (e) unknown / paused habit → picker, no crash
 */
import { start, makeDb } from './lib.mjs';

const t = await start('focus-autostart');
const { page, ok, shot } = t;

const { db, settings } = makeDb({
  pillars: [
    ['Body', '#D65A31', 'dumbbell'],
    ['Craft', '#A66A00', 'hammer'],
  ],
  habits: [
    { id: 'a0', pillar: 0, name: 'Run', type: 'session', minutes: 30 },
    { id: 'a1', pillar: 1, name: 'Write', type: 'session', minutes: 25 },
    { id: 'a2', pillar: 1, name: 'Old paused habit', type: 'session', minutes: 40 },
  ],
});
for (const a of db.daily_actions) {
  a.days_mask = 127;
  a.objective_id = null;
}
db.daily_actions[2].is_active = 0;
db.objectives = [];
db.tasks = [];

const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const sessions = async () => (await readDb()).focus_sessions ?? [];
const noSideScroll = async (label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw <= iw, `${label}: no horizontal scroll (${sw}/${iw})`);
};
const running = () => page.getByLabel('End focus session', { exact: true }).count().then((n) => n > 0);
/** Remaining seconds shown by the focus room's countdown. */
async function remainingSecs() {
  const txt = (await page.getByLabel(/remaining$/).first().innerText()).trim();
  const m = /^(\d+):(\d\d)$/.exec(txt);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
/**
 * In-app navigation, no reload: what the notification handler does when the app is already open
 * (router.push). Reaches expo-router's imperative `router` through the Metro dev runtime.
 */
async function openInApp(route) {
  const done = await page.evaluate((r) => {
    const req = globalThis.__r;
    const mods = req?.getModules?.();
    if (!mods) return false;
    for (const [id, m] of mods instanceof Map ? mods : Object.entries(mods)) {
      if (m?.verboseName?.endsWith('expo-router/build/imperative-api.js')) {
        req(Number(id)).router.push(r);
        return true;
      }
    }
    return false;
  }, route);
  ok(done, `in-app navigation to ${route} dispatched`);
}

await t.goto('/');
await t.wait(1500);
await t.seed(db, settings);

// ─── (a) autostart → overlay → running ───
await t.goto('/focus?actionId=a0&autostart=1');
await t.waitText('Starting Run in', 120000);
let b = await t.body();
ok(b.includes('Starting Run in 3') || b.includes('Starting Run in 2'), 'autostart: overlay "Starting Run in 3…" shows');
ok(b.includes('Tap to cancel'), 'autostart: overlay says "Tap to cancel"');
ok((await page.getByLabel('Cancel auto-start', { exact: true }).count()) > 0, 'autostart: Cancel button present');
ok(!(await running()), 'autostart: not running yet during the overlay');
await shot('a-overlay');
await noSideScroll('overlay');
await t.waitText('Starting Run in 1', 5000);
ok(await t.has('Starting Run in 1'), 'autostart: countdown reaches 1');
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 5000 });
ok(await running(), 'autostart: focus room is running after 3 s');
b = await t.body();
ok(b.includes('Run') && !b.includes('Starting Run in'), 'autostart: room shows the habit, overlay gone');
let rem = await remainingSecs();
ok(rem <= 30 * 60 && rem > 29 * 60, `autostart: countdown from the habit's 30 min (${rem}s left)`);
ok(!page.url().includes('autostart'), `autostart: params cleared after reading (${page.url()})`);
await t.wait(1500);
ok((await remainingSecs()) < rem, 'autostart: the timer is counting down');
await shot('a-running');
await noSideScroll('running');

// ─── (b) Cancel during the overlay ───
await t.goto('/focus?actionId=a0&autostart=1');
await t.waitText('Starting Run in', 120000);
await t.tap('Cancel auto-start', 300);
ok(!(await t.has('Starting Run in')), 'cancel: overlay closes');
ok((await page.getByText('Start focus', { exact: true }).count()) > 0, 'cancel: preparing screen with "Start focus"');
ok((await page.getByLabel('30 minutes', { exact: true }).count()) > 0, 'cancel: habit duration preselected (30)');
ok(await t.has('Run'), 'cancel: habit preselected');
await t.wait(4000);
ok(!(await running()), 'cancel: still not running 4 s later');
ok((await page.getByText('Start focus', { exact: true }).count()) > 0, 'cancel: still on the preparing screen 4 s later');
await shot('b-cancelled');

// ─── (c) no autostart → preselect only ───
await t.goto('/focus?actionId=a1');
await page.getByText('Start focus', { exact: true }).waitFor({ timeout: 120000 });
await t.wait(300);
ok(!(await t.has('Starting Write in')), 'preselect: no auto-start overlay');
ok(await t.has('Write'), 'preselect: habit Write preselected');
ok((await page.getByLabel('25 minutes', { exact: true }).count()) > 0, 'preselect: duration = habit target (25)');
await t.wait(4000);
ok(!(await running()), 'preselect: not running 4 s later');
await shot('c-preselect');

// ─── (d) a session already running → "Switch to <Habit>?" ───
await t.goto('/focus?actionId=a0&autostart=1');
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 120000 });
await t.wait(2500);
ok((await sessions()).length === 0, 'switch: no session saved yet');
await openInApp('/focus?actionId=a1&autostart=1');
await t.waitText('Switch to Write?', 15000);
b = await t.body();
ok(b.includes('Switch to Write?'), 'switch: sheet "Switch to Write?" shows');
ok(!b.includes('Starting Write in'), 'switch: no auto-start overlay while a session runs');
ok((await page.getByLabel('Keep current session', { exact: true }).count()) > 0, 'switch: "Keep current" offered');
await shot('d-switch-sheet');
await noSideScroll('switch sheet');
await t.tap('Keep current session', 1500);
ok(!(await t.has('Switch to Write?')), 'keep: sheet closes');
ok(await running(), 'keep: the current session is still running');
b = await t.body();
ok(b.includes('Run') && !b.includes('Write'), 'keep: still the Run session');
ok((await sessions()).length === 0, 'keep: nothing saved');
const runLeft = await remainingSecs();
ok(runLeft < 30 * 60 - 2, `keep: Run timer kept going (${runLeft}s left)`);

await openInApp('/focus?actionId=a1&autostart=1');
await t.waitText('Switch to Write?', 15000);
ok(await t.has('Switch to Write?'), 'switch again: sheet shows on the second notification');
await t.tap('Switch to Write', 2000);
await page.getByLabel('End focus session', { exact: true }).waitFor({ timeout: 10000 });
let s = await sessions();
const runRow = s.find((x) => x.action_id === 'a0');
ok(s.length === 1 && !!runRow, `switch: the Run session was saved (${s.length} row)`);
ok((runRow?.duration_seconds ?? 0) >= 3, `switch: Run session duration recorded (${runRow?.duration_seconds}s)`);
ok(runRow?.goal_id === 'g0', 'switch: Run session saved on its pillar');
b = await t.body();
ok(b.includes('Write') && !b.includes('Switch to Write?'), 'switch: the room now runs Write');
ok(b.includes('Craft'), 'switch: room shows Write\'s pillar');
rem = await remainingSecs();
ok(rem <= 25 * 60 && rem > 24 * 60, `switch: Write counts down from its 25 min (${rem}s left)`);
await shot('d-switched');
// End Write through the normal guard → a second row with action a1.
await t.wait(1200);
await t.tap('End focus session', 300);
await t.wait(5500);
await t.tap('End session anyway', 1500);
await t.waitText('Session ended early');
s = await sessions();
const writeRow = s.find((x) => x.action_id === 'a1');
ok(s.length === 2 && !!writeRow && writeRow.goal_id === 'g1', `switch: Write session saved after End (${s.length} rows)`);

// ─── (e) unknown / paused habit → picker ───
await t.goto('/focus?actionId=does-not-exist&autostart=1');
await page.getByLabel('Just give time to Body', { exact: true }).waitFor({ timeout: 120000 });
await t.wait(4000);
b = await t.body();
ok(!b.includes('Starting'), 'unknown habit: no overlay');
ok(!(await running()), 'unknown habit: nothing started');
ok(b.includes('Pick where your next hour goes.'), 'unknown habit: the normal picker shows');
await shot('e-unknown');
await t.goto('/focus?actionId=a2&autostart=1');
await page.getByLabel('Just give time to Body', { exact: true }).waitFor({ timeout: 120000 });
await t.wait(4000);
b = await t.body();
ok(!b.includes('Starting Old paused habit') && !(await running()), 'paused habit: not started');
ok(b.includes('Pick where your next hour goes.'), 'paused habit: the normal picker shows');
ok((await sessions()).length === 2, 'no extra sessions saved');

await t.finish();
