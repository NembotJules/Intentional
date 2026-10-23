import { describe, expect, it } from 'vitest';
import {
  ACTION_SKIP,
  ACTION_SNOOZE,
  ACTION_START,
  MAX_PENDING,
  buildHabitAlerts,
  buildStrictBlocks,
  intentFromResponse,
  parseHHMM,
  startAlertContent,
  type HabitForSchedule,
} from './habitSchedule';

// 2026-10-19 is a Monday. All times are local.
const MON_0600 = new Date(2026, 9, 19, 6, 0, 0);
const MON_0730 = new Date(2026, 9, 19, 7, 30, 0);

function habit(overrides: Partial<HabitForSchedule> = {}): HabitForSchedule {
  return { id: 'run', name: 'Run', pillarName: 'Body', target_minutes: 30, reminder_time: '07:00', days_mask: 127, is_active: 1, strict: 1, ...overrides };
}

describe('parseHHMM', () => {
  it('accepts valid times and rejects the rest', () => {
    expect(parseHHMM('7:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseHHMM('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('')).toBeNull();
    expect(parseHHMM(null)).toBeNull();
  });
});

describe('buildHabitAlerts (US-075)', () => {
  it('schedules one start alert per scheduled day in the window, at the start time, soonest first', () => {
    const alerts = buildHabitAlerts([habit()], { now: MON_0600, days: 7 });
    expect(alerts).toHaveLength(7);
    expect(alerts[0]!.fireAt).toEqual(new Date(2026, 9, 19, 7, 0, 0));
    expect(alerts[0]!.id).toBe('habit-run-2026-10-19-start');
    expect(alerts.map((a) => a.dayKey)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  });

  it('respects the weekday schedule (Mon/Wed/Fri only)', () => {
    const alerts = buildHabitAlerts([habit({ days_mask: 0b0010101 })], { now: MON_0600, days: 7 });
    expect(alerts.map((a) => a.dayKey)).toEqual(['2026-10-19', '2026-10-21', '2026-10-23']);
  });

  it("skips today's alert when the time has passed, the habit is done, or it was skipped", () => {
    expect(buildHabitAlerts([habit()], { now: MON_0730, days: 1 })).toEqual([]);
    expect(buildHabitAlerts([habit()], { now: MON_0600, days: 1, doneToday: new Set(['run']) })).toEqual([]);
    expect(buildHabitAlerts([habit()], { now: MON_0600, days: 1, skippedToday: new Set(['run']) })).toEqual([]);
    // tomorrow is unaffected by today's skip
    expect(buildHabitAlerts([habit()], { now: MON_0600, days: 2, skippedToday: new Set(['run']) }).map((a) => a.dayKey)).toEqual(['2026-10-20']);
  });

  it('ignores paused habits, habits without a start time and habits with no day', () => {
    const alerts = buildHabitAlerts(
      [habit({ id: 'a', is_active: 0 }), habit({ id: 'b', reminder_time: null }), habit({ id: 'c', days_mask: 0 })],
      { now: MON_0600 }
    );
    expect(alerts).toEqual([]);
  });

  it('adds a heads-up 10 minutes before when enabled, and it is not an auto-start', () => {
    const alerts = buildHabitAlerts([habit()], { now: MON_0600, days: 1, headsUp: true });
    expect(alerts.map((a) => [a.kind, a.fireAt.getHours(), a.fireAt.getMinutes()])).toEqual([
      ['headsup', 6, 50],
      ['start', 7, 0],
    ]);
    expect(alerts[0]!.title).toBe('Run in 10 min');
  });

  it('never exceeds the iOS pending cap: heads-ups are dropped before start alerts', () => {
    const many = Array.from({ length: 10 }, (_, i) => habit({ id: `h${i}`, reminder_time: `0${7 + (i % 3)}:${String(i * 5).padStart(2, '0')}` }));
    const alerts = buildHabitAlerts(many, { now: MON_0600, days: 7, headsUp: true });
    expect(alerts.length).toBeLessThanOrEqual(MAX_PENDING);
    expect(alerts.filter((a) => a.kind === 'start').length).toBe(Math.min(70, MAX_PENDING));
  });

  it('carries the start time in the payload so a late tap does not auto-start', () => {
    const [a] = buildHabitAlerts([habit()], { now: MON_0600, days: 1 });
    expect(a!.data).toEqual({ actionId: 'run', kind: 'start', scheduledAt: new Date(2026, 9, 19, 7, 0, 0).toISOString() });
  });
});

describe('startAlertContent', () => {
  it('says apps are already blocked only when strict mode really runs on this device', () => {
    expect(startAlertContent(habit(), { blockingAvailable: true, autoBlock: true })).toEqual({ title: '🔥 Run · Body', body: 'Apps blocked. Tap to start your 30 min.' });
    expect(startAlertContent(habit(), { blockingAvailable: true, autoBlock: false }).body).toBe('Time to start. 30 min, apps blocked.');
    expect(startAlertContent(habit(), { blockingAvailable: false, autoBlock: false }).body).toBe('Time to start. 30 min.');
    expect(startAlertContent(habit({ strict: 0 }), { blockingAvailable: true, autoBlock: true }).body).toBe('Time to start. 30 min, apps blocked.');
  });
});

describe('intentFromResponse (US-076)', () => {
  const data = { actionId: 'run', kind: 'start', scheduledAt: new Date(2026, 9, 19, 7, 0, 0).toISOString() };
  const tap = (actionIdentifier: string, now: Date, d: Record<string, unknown> = data) => intentFromResponse({ actionIdentifier, data: d, now });

  it('tap or Start now within 30 minutes auto-starts the session', () => {
    expect(tap('expo.modules.notifications.actions.DEFAULT', new Date(2026, 9, 19, 7, 2))).toEqual({ type: 'start', actionId: 'run', autostart: true });
    expect(tap(ACTION_START, new Date(2026, 9, 19, 7, 30))).toEqual({ type: 'start', actionId: 'run', autostart: true });
  });

  it('more than 30 minutes late only preselects the habit', () => {
    expect(tap(ACTION_START, new Date(2026, 9, 19, 7, 31))).toEqual({ type: 'start', actionId: 'run', autostart: false });
  });

  it('a heads-up tap or an old reminder without a start time never auto-starts', () => {
    expect(tap(ACTION_START, new Date(2026, 9, 19, 6, 51), { ...data, kind: 'headsup' }).type === 'start' && tap(ACTION_START, new Date(2026, 9, 19, 6, 51), { ...data, kind: 'headsup' })).toMatchObject({ autostart: false });
    expect(tap(ACTION_START, new Date(2026, 9, 19, 7, 1), { actionId: 'run' })).toEqual({ type: 'start', actionId: 'run', autostart: false });
  });

  it('snooze and skip buttons map to their intents; other notifications open their screen', () => {
    expect(tap(ACTION_SNOOZE, MON_0730)).toEqual({ type: 'snooze', actionId: 'run' });
    expect(tap(ACTION_SKIP, MON_0730)).toEqual({ type: 'skip', actionId: 'run' });
    expect(tap('x', MON_0730, { screen: 'weekly-review' })).toEqual({ type: 'open-review' });
    expect(tap('x', MON_0730, {})).toEqual({ type: 'open-today' });
  });
});

describe('buildStrictBlocks (US-077)', () => {
  it('strict is on by default and makes a weekly window from start to start + duration', () => {
    expect(buildStrictBlocks([habit({ strict: undefined, days_mask: 0b0111111 })])).toEqual([
      { habitId: 'run', weekdays: [2, 3, 4, 5, 6, 7], startHour: 7, startMinute: 0, endHour: 7, endMinute: 30 },
    ]);
  });

  it('skips habits with strict off, paused, or without a start time; clips at midnight', () => {
    expect(buildStrictBlocks([habit({ strict: 0 }), habit({ id: 'p', is_active: 0 }), habit({ id: 'n', reminder_time: null })])).toEqual([]);
    expect(buildStrictBlocks([habit({ reminder_time: '23:40', target_minutes: 45 })])[0]).toMatchObject({ endHour: 23, endMinute: 59 });
  });
});
