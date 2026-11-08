#!/usr/bin/env node
/**
 * US-122 · The welcome carousel's "real screenshots of the app" (assets/images/onboarding/*.jpg), retaken from the
 * running web build with a realistic week, so they always show the current design and Flick.
 *   1 app-today.jpg       Today: Flick's world, the big number, tiles, Up next (mid-afternoon)
 *   2 app-focusroom.jpg   a running session: the meditating Flick in his world, the big timer
 *   3 app-insights.jpg    Progress: this week's hours by pillar
 *
 * Needs the web dev server (E2E_BASE_URL, default http://localhost:8081) and Chrome (E2E_CHROME).
 *   node scripts/capture-onboarding-shots.mjs
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { start } from '../e2e/lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/images/onboarding');
const t = await start('onboarding-shots');
const { page } = t;
await page.setViewportSize({ width: 390, height: 844 });

// Thursday mid-afternoon of a good week.
const day = (d, h, m = 0) => new Date(2026, 10, d, h, m, 0);
await page.clock.install({ time: day(5, 14, 20) });
await page.clock.resume();

const P = [
  ['g0', 'Body', '#D65A31', 'dumbbell'],
  ['g1', 'Craft', '#A66A00', 'hammer'],
  ['g2', 'Mind', '#4C6FFF', 'brain'],
  ['g3', 'Family', '#E5484D', 'heart'],
];
const habit = (id, goal, name, minutes, time, k) => ({ id, goal_id: goal, name, type: 'session', target_minutes: minutes, reminder_time: time, is_active: 1, sort_order: k, objective_id: null, days_mask: 127, strict: 0 });
const session = (id, goal, action, d, h, mins) => ({ id, action_id: action, goal_id: goal, started_at: day(d, h).toISOString(), ended_at: day(d, h, mins).toISOString(), duration_seconds: mins * 60, note: null, was_completed: 1, task_id: null, objective_id: null });
const db = {
  meta_goals: P.map(([id, name, color, icon], k) => ({ id, name, color, icon, sort_order: k, why_statement: '', is_archived: 0 })),
  daily_actions: [
    habit('h0', 'g0', 'Gym', 60, '18:00', 0),
    habit('h1', 'g1', 'Ship the app', 90, '09:00', 1),
    habit('h2', 'g2', 'Read', 30, '21:30', 2),
    habit('h3', 'g3', 'Call mum', 20, '19:30', 3),
  ],
  objectives: [], tasks: [], habit_completions: [], habit_skips: [], milestones: [], weekly_reviews: [],
  focus_sessions: [
    session('s1', 'g1', 'h1', 2, 9, 95), session('s2', 'g0', 'h0', 2, 18, 60), session('s3', 'g2', 'h2', 2, 21, 30),
    session('s4', 'g1', 'h1', 3, 9, 80), session('s5', 'g3', 'h3', 3, 19, 25), session('s6', 'g0', 'h0', 4, 18, 55),
    session('s7', 'g1', 'h1', 4, 9, 100), session('s8', 'g2', 'h2', 4, 21, 35), session('s9', 'g1', 'h1', 5, 9, 85),
  ],
  settings: [{ key: 'user_name', value: 'Alex' }, { key: 'hasCompletedOnboarding', value: '1' }],
};
const settings = { user_name: 'Alex', hasCompletedOnboarding: '1', flick_stage_seen: '9', milestones_backfilled: '1' };
const label = (l) => page.getByLabel(l, { exact: true });
const snap = async (name) => {
  await page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 86 });
  console.log('wrote', name);
};

await t.goto('/');
await t.wait(2000);
await t.seed(db, settings);

// 1 · Today (after the launch intro has faded)
await t.goto('/today');
await page.getByLabel(/^Up next: /).waitFor({ timeout: 90000 });
await t.wait(4200);
await snap('app-today.jpg');

// 3 · Progress
await t.goto('/progress');
await t.waitText('Your people', 60000);
await t.wait(3500);
await snap('app-insights.jpg');

// 2 · a running session (the meditating Flick)
await t.goto('/today');
await label('Focus').waitFor({ timeout: 60000 });
await t.wait(3200);
await label('Focus').click();
await page.getByText('Start focusing').first().waitFor({ timeout: 15000 });
await t.wait(800);
await label('Start focusing now').click();
await page.getByLabel(/^\d\d:\d\d remaining$/).first().waitFor({ timeout: 30000 });
await t.wait(2600);
await snap('app-focusroom.jpg');

process.exit(0);
