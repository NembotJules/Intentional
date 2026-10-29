import { describe, expect, it } from 'vitest';
import { buildWeekSummary, formatMinutes, headlineFor, weekLabel, weekStartOf, weekText, type WeekInput } from './weekSummary';

// 2026-10-19 is a Monday. All times local.
const at = (day: number, h = 9, m = 0) => new Date(2026, 9, day, h, m, 0).toISOString();
const WED_NOON = new Date(2026, 9, 21, 12, 0, 0);

function input(over: Partial<WeekInput> = {}): WeekInput {
  return {
    weekStart: '2026-10-19',
    now: WED_NOON,
    pillars: [
      { id: 'body', name: 'Body', color: '#D65A31', icon: 'body' },
      { id: 'craft', name: 'Craft', color: '#A66A00', icon: 'craft' },
      { id: 'mind', name: 'Mind', color: '#4C6FFF', icon: 'mind' },
    ],
    sessions: [],
    habits: [],
    skips: [],
    goals: [],
    ...over,
  };
}
const session = (goal: string, startedAt: string, mins: number, extra: Partial<{ action_id: string; objective_id: string }> = {}) => ({
  goal_id: goal,
  action_id: extra.action_id ?? null,
  objective_id: extra.objective_id ?? null,
  started_at: startedAt,
  duration_seconds: mins * 60,
});

describe('weekStartOf / weekLabel / formatMinutes', () => {
  it('finds the Monday, Sunday included', () => {
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19'); // Sunday belongs to the week that started Monday
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26');
  });
  it('labels within and across months', () => {
    expect(weekLabel('2026-10-19')).toBe('Oct 19 – 25');
    expect(weekLabel('2026-10-26')).toBe('Oct 26 – Nov 1');
  });
  it('formats minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(125)).toBe('2h 5m');
  });
});

describe('buildWeekSummary', () => {
  it('totals this week per pillar and per day, and keeps last week apart', () => {
    const s = buildWeekSummary(
      input({
        sessions: [
          session('body', at(19), 60),
          session('body', at(20), 30),
          session('craft', at(20, 14), 90),
          session('mind', at(18, 20), 45), // last Sunday → previous week
          session('mind', at(5), 600), // two weeks ago → ignored
        ],
      })
    );
    expect(s.totalMinutes).toBe(180);
    expect(s.prevTotalMinutes).toBe(45);
    expect(s.pillars.map((p) => [p.name, p.minutes, p.prevMinutes])).toEqual([
      ['Body', 90, 0],
      ['Craft', 90, 0],
      ['Mind', 0, 45],
    ]);
    expect(s.days.map((d) => d.minutes)).toEqual([60, 120, 0, 0, 0, 0, 0]);
    expect(s.daysShowedUp).toBe(2);
    expect(s.bestDay).toEqual({ dayKey: '2026-10-20', minutes: 120 });
    expect(s.label).toBe('Oct 19 – 25');
    expect(s.isPast).toBe(false);
  });

  it('a session late Sunday night still belongs to that week', () => {
    const s = buildWeekSummary(input({ now: new Date(2026, 9, 27, 9), sessions: [session('body', at(25, 23, 30), 25)] }));
    expect(s.totalMinutes).toBe(25);
    expect(s.days[6]!.minutes).toBe(25);
    expect(s.isPast).toBe(true);
  });

  it('marks each habit day: done, rest (skipped), missed, today, upcoming, off', () => {
    const s = buildWeekSummary(
      input({
        // Mon, Tue, Wed, Thu, Fri scheduled (bits 0-4)
        habits: [{ id: 'run', goal_id: 'body', name: 'Run', target_minutes: 30, days_mask: 0b0011111, is_active: 1 }],
        sessions: [session('body', at(19), 30, { action_id: 'run' })],
        skips: [{ action_id: 'run', date: '2026-10-20' }],
      })
    );
    const run = s.habits[0]!;
    expect(run.days).toEqual(['done', 'rest', 'today', 'upcoming', 'upcoming', 'off', 'off']);
    expect(run.kept).toBe(1);
    expect(run.due).toBe(1);
    expect(run.givenMinutes).toBe(30);
    expect(run.plannedMinutes).toBe(4 * 30); // rest day isn't planned time
    expect(s.restDays).toBe(1);
  });

  it('a past scheduled day with no time is missed; a short session does not keep the habit', () => {
    const s = buildWeekSummary(
      input({
        habits: [{ id: 'read', goal_id: 'mind', name: 'Read', target_minutes: 30, days_mask: 127, is_active: 1 }],
        sessions: [session('mind', at(20), 10, { action_id: 'read' })],
      })
    );
    expect(s.habits[0]!.days.slice(0, 3)).toEqual(['missed', 'missed', 'today']);
    expect(s.habitsKept).toBe(0);
    expect(s.habitsDue).toBe(2);
    expect(s.habits[0]!.givenMinutes).toBe(10);
  });

  it('a skipped day that still got its time counts as done', () => {
    const s = buildWeekSummary(
      input({
        habits: [{ id: 'run', goal_id: 'body', name: 'Run', target_minutes: 30, days_mask: 127, is_active: 1 }],
        sessions: [session('body', at(19), 30, { action_id: 'run' })],
        skips: [{ action_id: 'run', date: '2026-10-19' }],
      })
    );
    expect(s.habits[0]!.days[0]).toBe('done');
  });

  it('old check-off habits count from their completions; paused habits are left out', () => {
    const s = buildWeekSummary(
      input({
        habits: [
          { id: 'vit', goal_id: 'body', name: 'Vitamins', target_minutes: 0, days_mask: 127, is_active: 1 },
          { id: 'old', goal_id: 'body', name: 'Paused', target_minutes: 30, days_mask: 127, is_active: 0 },
        ],
        completions: [{ action_id: 'vit', date: '2026-10-19' }],
      })
    );
    expect(s.habits.map((h) => h.id)).toEqual(['vit']);
    expect(s.habits[0]!.days[0]).toBe('done');
  });

  it('adds this week minutes to each goal', () => {
    const s = buildWeekSummary(
      input({
        goals: [{ id: 'o1', title: 'Half marathon', pillar_id: 'body', progress: 0.4, pace: 'on_track' }],
        sessions: [session('body', at(19), 45, { objective_id: 'o1' }), session('body', at(12), 45, { objective_id: 'o1' })],
      })
    );
    expect(s.goals[0]!.minutes).toBe(45);
  });
});

describe('headline and text', () => {
  const base = () =>
    buildWeekSummary(
      input({
        sessions: [session('body', at(19), 120), session('craft', at(20), 60), session('mind', at(13), 30)],
        habits: [{ id: 'run', goal_id: 'body', name: 'Run', target_minutes: 60, days_mask: 127, is_active: 1 }],
        goals: [{ id: 'o1', title: 'Half marathon', pillar_id: 'body', progress: 0.42, pace: 'on_track' }],
      })
    );

  it('headline: more than last week names the leading pillar; empty week is kind', () => {
    expect(headlineFor(base())).toBe('2h 30m more than last week. Body led the way.');
    expect(headlineFor(buildWeekSummary(input()))).toBe('A quiet week. The next one starts with one hour.');
  });

  it('the partner text has the week, pillars, habits, goals and a sign-off, and no task names', () => {
    const text = weekText(base(), { userName: 'Alex', partnerName: 'Sam' });
    expect(text).toContain("Sam, here's my week (Oct 19 – 25) on Intentional:");
    expect(text).toContain('⏱ 3h given to the life I chose (last week: 30m)');
    expect(text).toContain('Body 2h · Craft 1h');
    expect(text).toContain('No time yet: Mind');
    expect(text).toContain('✅ Habits kept: 0 of 2');
    expect(text).toContain('📅 Showed up 2 of 7 days');
    expect(text).toContain('🎯 Half marathon: 42%, on track');
    expect(text).toContain('Keep me honest next week too.');
    expect(text.endsWith('— Alex')).toBe(true);
  });

  it('without a partner it is a plain caption', () => {
    const text = weekText(base());
    expect(text.startsWith('My week (Oct 19 – 25) on Intentional:')).toBe(true);
    expect(text).not.toContain('Keep me honest');
    expect(text.endsWith('\nhttps://nembotjules.vercel.app/intentional')).toBe(true);
  });
});
