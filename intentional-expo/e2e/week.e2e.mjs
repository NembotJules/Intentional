/**
 * The week: Sunday ritual (US-082), weekly card (US-085), accountability partner, missed / skipped habits (US-078),
 * habit week + forgiving streaks in Insights (US-078/081), Sunday reminder settings.
 *
 * The browser clock is set to Sunday 2026-10-25 19:00 (local) and keeps running, so the suite never depends on
 * the real day. Week = Mon Oct 19 → Sun Oct 25.
 */
import { start, openPillarRows } from './lib.mjs';

const t = await start('week');
const { page, ok, has, shot, tap } = t;
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 800)); });

const local = (d, h = 9, m = 0) => new Date(2026, 9, d, h, m, 0);
const iso = (d, h = 9, m = 0) => local(d, h, m).toISOString();
await page.clock.install({ time: local(25, 19, 0) });
await page.clock.resume();

// ── Seed ──
const pillars = [
  ['g0', 'Body', '#D65A31', 'body'],
  ['g1', 'Craft', '#A66A00', 'craft'],
  ['g2', 'Mind', '#4C6FFF', 'mind'],
];
const habit = (id, goal, name, minutes, time, mask) => ({ id, goal_id: goal, name, type: 'session', target_minutes: minutes, reminder_time: time, is_active: 1, sort_order: 0, objective_id: null, days_mask: mask, strict: 0 });
const session = (id, goal, mins, startedAt, action = null, objective = null) => ({ id, action_id: action, goal_id: goal, started_at: startedAt, ended_at: startedAt, duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: objective });
const db = {
  meta_goals: pillars.map(([id, name, color, icon], k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 })),
  daily_actions: [
    habit('run', 'g0', 'Run', 30, '07:00', 0b0011111), // Mon–Fri
    habit('stretch', 'g0', 'Stretch', 15, '17:00', 127), // every day: missed tonight
    habit('read', 'g2', 'Read', 30, '21:00', 127), // every day: still ahead tonight
  ],
  focus_sessions: [
    session('s1', 'g0', 30, iso(19, 7), 'run'),
    session('s2', 'g0', 30, iso(20, 7), 'run'),
    session('s3', 'g0', 30, iso(22, 7), 'run'),
    session('s4', 'g1', 120, iso(20, 14), null, 'o1'),
    session('s5', 'g1', 90, iso(23, 15), null, 'o1'),
    session('s6', 'g2', 30, iso(21, 21), 'read'),
    session('s7', 'g0', 60, iso(14, 9)), // last week
  ],
  habit_completions: [],
  habit_skips: [{ id: 'k1', action_id: 'run', date: '2026-10-21' }], // Wed: a rest day
  objectives: [
    { id: 'o1', pillar_id: 'g1', title: 'Ship the portfolio site', done_when: '', deadline: '2026-12-20', status: 'active', metric_current: null, metric_target: null, metric_unit: null, metric_start: null, sort_order: 0, created_at: iso(1), closed_at: null, close_note: null },
  ],
  tasks: [
    { id: 't1', objective_id: 'o1', title: 'Design the home page', estimate_minutes: 60, planned_date: null, is_done: 1, done_at: iso(20), sort_order: 0, created_at: iso(1) },
    { id: 't2', objective_id: 'o1', title: 'Write case studies', estimate_minutes: 90, planned_date: null, is_done: 0, done_at: null, sort_order: 1, created_at: iso(1) },
  ],
  weekly_reviews: [],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1' };
const readSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_settings_v1') || '{}'));
const readDb = () => page.evaluate(() => JSON.parse(localStorage.getItem('intentional_db_v2') || '{}'));
const noOverflow = async (where) => {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  ok(w <= 390, `no horizontal overflow on ${where} (${w})`);
};

await t.goto('/');
await page.waitForTimeout(2000);
await t.seed(db, settings);

// ── Today: Sunday card, missed habit, skip / undo, long-press options ──
await t.goto('/today');
await t.waitText('Your week is ready', 240000);
await page.waitForTimeout(1200);
await openPillarRows(page); // US-098: habits live inside the pillar rows
await shot('today-sunday');
ok(await has('Look back and plan next week. 3 minutes.'), 'Sunday card (no partner yet)');
ok(await has('Missed 17:00'), 'Stretch: "Missed 17:00" after its start time');
ok((await page.getByLabel('Do Stretch now', { exact: true }).count()) > 0, '"Do it now" on the missed habit');
ok(!(await has('Missed 21:00')), 'Read (21:00) is not missed yet');
ok(!/overdue|failed|\blate\b/i.test(await t.body()), 'no guilt words on Today');
await noOverflow('Today');

await tap('Skip Stretch today', 900);
await shot('today-skipped');
ok(await has('Rest day · your streak is safe'), 'skipped habit shows as a rest day');
{ const d = await readDb(); ok((d.habit_skips || []).some((r) => r.action_id === 'stretch' && r.date === '2026-10-25'), 'skip saved for today'); }
await tap('Undo skip Stretch', 900);
ok(!(await has('Rest day · your streak is safe')), 'undo brings it back');
{ const d = await readDb(); ok(!(d.habit_skips || []).some((r) => r.action_id === 'stretch'), 'skip removed'); }

// long-press → options sheet
await page.getByLabel('Start Read', { exact: true }).last().click({ delay: 800 });
await page.waitForTimeout(600);
ok(await has('Hide this habit') && (await page.getByLabel('Skip Read today', { exact: true }).count()) > 0, 'long-press opens Skip today / Hide');
await shot('today-options');
await tap('Skip Read today', 900);
ok(await has('Rest day · your streak is safe'), 'Skip from the options sheet works');
await tap('Undo skip Read', 900);

// ── Ritual ──
await tap('Open your week', 1500);
await t.waitText('your week is in', 60000);
await page.waitForTimeout(1500);
await shot('ritual-intro');
ok(await has('Week of Oct 19 – 25'), 'ritual: week label');
await tap('Show me', 1800);
await shot('ritual-hours');
// Mon 30 · Tue 30+120 · Wed 30 · Thu 30 · Fri 90 = 5h 30m (last week's 1h not counted)
ok(await has('5h 30m'), 'ritual: total 5h 30m this week');
ok(await has('4h 30m more than last week'), 'ritual: vs last week');
ok(await has('You showed up 5 of 7 days. Tuesday was your best: 2h 30m.'), 'ritual: days + best day line');
await tap('Continue', 1500);
await shot('ritual-pillars');
ok(await has('Where it went'), 'ritual: pillars step');
ok(await has('3h 30m') && await has('1h 30m'), 'ritual: per-pillar hours');
await tap('Continue', 1500);
await shot('ritual-habits');
// Run: Mon Tue Thu kept, Wed rest, Fri missed → 4 due · Stretch & Read: Mon–Sat missed → 6 + 6 (Sunday is still today)
ok(await has('You kept 4 of 16 habit days.'), 'ritual: habits kept (rest day not counted as due)');
ok(await has('1 rest day. A rest day keeps your streak.'), 'ritual: rest day explained');
await tap('Continue', 1500);
await shot('ritual-goals');
ok(await has('Ship the portfolio site') && await has('3h 30m this week') && await has('50%'), 'ritual: goal hours + progress');
await tap('Continue', 1800);
await shot('ritual-next');
ok(await has('Now, make next week count.'), 'ritual: last step');

// share (no partner)
await tap('Share your week', 1500);
await t.waitText('Safe to post anywhere', 20000);
await page.waitForTimeout(800);
await shot('share-sheet-light');
const card = await t.body();
ok(card.includes('INTENTIONAL') && card.includes('given to the life I chose') && card.includes("Alex's week"), 'card: wordmark, hero line, name');
ok(card.includes('5/7') && card.includes('days with time') && card.includes('4/16') && card.includes('habits kept'), 'card: stats');
ok(!card.includes('Design the home page') && !card.includes('Write case studies'), 'card: no task names');
await tap('Dark card', 600);
await shot('share-sheet-dark');
await tap('Share', 1000);
{ const shared = await page.evaluate(() => globalThis.__lastShared || '');
  ok(shared.startsWith('My week (Oct 19 – 25) on Intentional:') && shared.includes('⏱ 5h 30m given to the life I chose (last week: 1h)'), 'share text: header + total');
  ok(shared.includes('Craft 3h 30m · Body 1h 30m · Mind 30m') && shared.includes('🎯 Ship the portfolio site: 50%'), 'share text: pillars + goal');
  ok(!shared.includes('Write case studies'), 'share text: no task names'); }
await page.waitForTimeout(600);
ok(!(await has('Safe to post anywhere')), 'the sheet closes after sharing');

// ── Partner ──
await tap('Choose an accountability partner', 1500);
await t.waitText('One person who sees your week', 60000);
await shot('partner-empty');
await page.getByLabel('Partner name').fill('Sam');
await page.getByLabel('Partner phone number').fill('+33 6 12 34 56 78');
await tap('Choose Sam', 1200);
await shot('partner-chosen');
ok(await has('Sam sees your week'), 'partner saved');
const invite = await page.getByTestId('invite-preview').innerText();
ok(invite.includes("Hey Sam! I'm giving my hours to Body, Craft and Mind (Ship the portfolio site).") && invite.endsWith('— Alex'), 'invite names pillars, goal, sign-off');
{ const s = await readSettings(); const p = JSON.parse(s.partner || '{}'); ok(p.name === 'Sam' && p.phone === '+33612345678', 'partner stored with a clean number: ' + s.partner); }
await tap('Send the invite', 900);
{ const shared = await page.evaluate(() => globalThis.__lastShared || ''); ok(shared.startsWith('Hey Sam!'), 'invite handed to the share sheet'); }
{ const s = await readSettings(); ok(!!JSON.parse(s.partner).invitedAt, 'invite marked as sent'); }
ok(await has('Your week is ready') && await has('Sam is waiting for it'), 'partner: Sunday report due');
await tap('Send your week to Sam', 1500);
await t.waitText('Send your week to Sam', 20000);
ok((await page.getByLabel('Text it to Sam', { exact: true }).count()) > 0, 'partner sheet: "Text it to Sam"');
await shot('partner-sheet');
await tap('Send to Sam', 1200);
{ const shared = await page.evaluate(() => globalThis.__lastShared || '');
  ok(shared.startsWith("Sam, here's my week (Oct 19 – 25) on Intentional:") && shared.includes('Keep me honest next week too.') && shared.includes('— Alex'), 'partner message greets Sam and signs off'); }
{ const s = await readSettings(); ok(JSON.parse(s.partner_sent_weeks || '[]').includes('2026-10-19'), 'week recorded as sent'); }
await tap('Close', 800);
await page.waitForTimeout(600);
ok(await has('Week of Oct 19 – 25 sent'), 'partner: week shows as sent');
ok(await has('Sent 1 week in a row'), 'partner: streak of weeks sent');
await shot('partner-sent');
await noOverflow('Partner');

// ── Back to the ritual end → plan next week marks the ritual done ──
await t.goto('/ritual');
await t.waitText('your week is in', 60000);
for (let i = 0; i < 5; i++) await tap(i === 0 ? 'Show me' : 'Continue', 1200);
ok(await has('Sam has your week. Plan the next one.'), 'ritual end knows the week was sent');
await tap('Plan next week', 2000);
await t.waitText('Where did your week go?', 60000);
{ const s = await readSettings(); ok(s['ritual_done_2026-10-19'] === '1', 'ritual marked done'); }
await t.goto('/today');
await t.waitText('given today', 120000);
await page.waitForTimeout(1200);
ok(!(await has('Your week is ready')), 'Today: Sunday card gone after the ritual');

// ── Insights: share button, habit week, forgiving streak ──
await t.goto('/insights');
await t.waitText('Where it went', 120000);
await page.waitForTimeout(1500);
ok((await page.getByLabel('Send your week to Sam', { exact: true }).count()) > 0, 'Insights: send-your-week button names the partner');
await page.getByText('Habits this week').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await shot('insights-habits');
ok((await page.getByLabel('Run: 1h 30m of 2h this week', { exact: true }).count()) > 0, 'Insights: Run 1h 30m of 2h (rest day not planned)');
ok(await has('Rest day: skipped on purpose.'), 'Insights: rest day legend');
await noOverflow('Insights');

// ── Settings: partner row + Sunday reminder time ──
await t.goto('/settings');
await t.waitText('Your week', 120000);
await page.waitForTimeout(800);
ok(await has('Partner: Sam') && await has('Sent 1 week in a row'), 'Settings: partner row');
ok(await has('Every Sunday at 6:00 PM'), 'Settings: reminder on by default at 6 PM');
await tap('Sunday reminder at 8 PM', 600);
ok(await has('Every Sunday at 8:00 PM'), 'Settings: time changed');
{ const s = await readSettings(); ok(s.ritual_time === '20:00', 'ritual time saved'); }
await page.getByText('Your week', { exact: true }).first().scrollIntoViewIfNeeded();
await shot('settings-week');

// ── End partnership keeps history ──
await t.goto('/partner');
await t.waitText('Sam sees your week', 60000);
await tap('End partnership', 1000);
await page.waitForTimeout(800);
ok(await has('One person who sees your week'), 'partnership ended');
{ const s = await readSettings(); ok(JSON.parse(s.partner_sent_weeks || '[]').includes('2026-10-19'), 'sent history kept'); }

// ── Goal achieved → share the win ──
await t.goto('/objective/o1');
await t.waitText('Mark as achieved', 120000);
await page.waitForTimeout(800);
await page.getByText('Mark as achieved', { exact: true }).last().scrollIntoViewIfNeeded();
await t.pick('Mark as achieved', 2500);
await t.waitText('Goal achieved!', 20000);
await page.getByLabel('What made it work?').fill('Two hours every Tuesday');
await tap('Share this win', 1500);
await t.waitText('GOAL ACHIEVED', 20000);
await page.waitForTimeout(600);
await shot('goal-card');
ok(await has('Hours and days only. No task names.'), 'win sheet opens over the celebration');
ok(await has('Two hours every Tuesday') && await has('step done'), 'card shows the reflection and steps done');
await tap('Share', 1000);
{ const shared = await page.evaluate(() => globalThis.__lastShared || '');
  ok(shared.startsWith('🏆 Goal achieved: Ship the portfolio site') && shared.includes('3h 30m given') && shared.includes('1 step done') && shared.includes('"Two hours every Tuesday"'), 'win text: ' + shared.split('\n').join(' | '));
  ok(!shared.includes('Design the home page'), 'win text: no task names'); }

// ── Your life in hours (US-083) ──
await t.goto('/life');
await t.waitText('Your life in hours', 120000);
await page.waitForTimeout(1000);
await shot('life-top');
// 5h 30m this week + 1h last week = 6.5h
ok(await has('6.5h') && await has('given to the life you chose'), 'life: lifetime total');
ok(await has('Since October 14, 2026 · on 6 days · 7 sessions'), 'life: first day, active days, sessions');
ok(await has('Flick is a Spark') && await has('4h to Flame'), 'life: Flick stage + hours to next');
ok(await has('Ship the portfolio site') && await has('3h 30m in'), 'life: achieved goal with its hours');
await page.getByText('Goals achieved').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await shot('life-bottom');
await noOverflow('Life in hours');

await t.finish();
