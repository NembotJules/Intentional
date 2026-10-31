import { describe, expect, it } from 'vitest';
import { buildYear, rangeLabel, stagePathLine, storyYear, yearHours, yearShareText, type YearInput } from './yearInHours';

describe('yearHours', () => {
  it('formats the big numbers', () => {
    expect(yearHours(45)).toBe('45m');
    expect(yearHours(750)).toBe('12.5h');
    expect(yearHours(600)).toBe('10h');
    expect(yearHours(18720)).toBe('312h');
    expect(yearHours(75000)).toBe('1,250h');
  });
});

// The year under test is always last year, so nothing depends on today's date.
const Y = new Date().getFullYear() - 1;
const at = (m: number, d: number, h = 9, min = 0) => new Date(Y, m, d, h, min).toISOString();
const s = (goal: string, startedAt: string, mins: number) => ({ goal_id: goal, started_at: startedAt, duration_seconds: mins * 60 });
const pillars = [
  { id: 'body', name: 'Body', color: '#D65A31', icon: 'body' },
  { id: 'craft', name: 'Craft', color: '#A66A00', icon: 'craft' },
  { id: 'mind', name: 'Mind', color: '#4C6FFF', icon: 'mind' },
];
const input = (over: Partial<YearInput> = {}): YearInput => ({ year: Y, now: new Date(Y + 1, 0, 5), sessions: [], pillars, objectives: [], ...over });

describe('storyYear (US-086)', () => {
  it('Dec 1 → Dec 31 is this year’s final story', () => {
    expect(storyYear(new Date(Y, 11, 1, 0, 1))).toEqual({ year: Y, final: true });
    expect(storyYear(new Date(Y, 11, 31, 23, 59))).toEqual({ year: Y, final: true });
  });
  it('Jan 1 → Jan 15 is last year’s; Jan 16 starts "so far"', () => {
    expect(storyYear(new Date(Y + 1, 0, 1, 0, 0))).toEqual({ year: Y, final: true });
    expect(storyYear(new Date(Y + 1, 0, 15, 23, 59))).toEqual({ year: Y, final: true });
    expect(storyYear(new Date(Y + 1, 0, 16, 0, 0))).toEqual({ year: Y + 1, final: false });
    expect(storyYear(new Date(Y, 10, 30, 23, 59))).toEqual({ year: Y, final: false });
  });
});

describe('buildYear (US-086)', () => {
  it('counts sessions by their local day: Dec 31 23:30 is this year, Jan 1 00:10 is next, Dec 31 of the year before is history', () => {
    const y = buildYear(
      input({
        sessions: [s('body', new Date(Y - 1, 11, 31, 23, 30).toISOString(), 60), s('body', at(0, 1, 0, 10), 30), s('body', at(11, 31, 23, 30), 45), s('body', new Date(Y + 1, 0, 1, 0, 10).toISOString(), 90)],
      })
    );
    expect(y.totalMinutes).toBe(75);
    expect(y.sessionCount).toBe(2);
    expect(y.months[0]!.minutes).toBe(30);
    expect(y.months[11]!.minutes).toBe(45);
  });

  it('pillars by share, the best month and the best day', () => {
    const y = buildYear(
      input({
        sessions: [s('body', at(2, 3), 120), s('body', at(2, 4), 60), s('craft', at(9, 10), 90), s('craft', at(9, 10, 14), 60), s('mind', at(5, 1), 0)],
      })
    );
    expect(y.pillars.map((p) => [p.name, p.minutes])).toEqual([
      ['Body', 180],
      ['Craft', 150],
    ]);
    expect(y.pillars[0]!.share).toBeCloseTo(180 / 330);
    expect(y.bestMonth).toMatchObject({ index: 2, long: 'March', minutes: 180 });
    expect(y.bestDay).toEqual({ dayKey: `${Y}-10-10`, minutes: 150 });
    expect(y.activeDays).toBe(3);
  });

  it('longest streak of days in a row, across a month boundary', () => {
    const days = [[0, 30], [0, 31], [1, 1], [1, 2], [4, 1], [4, 2], [4, 3]] as const;
    const y = buildYear(input({ sessions: days.map(([m, d]) => s('body', at(m, d), 20)) }));
    expect(y.longestStreak).toEqual({ days: 4, from: `${Y}-01-30`, to: `${Y}-02-02` });
    expect(rangeLabel(y.longestStreak!.from, y.longestStreak!.to)).toBe('Jan 30 – Feb 2');
  });

  it('goals achieved in the year only, with their hours', () => {
    const y = buildYear(
      input({
        objectives: [
          { id: 'o1', title: 'Run 10k', pillar_id: 'body', status: 'completed', closed_at: at(5, 20) },
          { id: 'o2', title: 'Old one', pillar_id: 'body', status: 'completed', closed_at: new Date(Y - 1, 5, 1).toISOString() },
          { id: 'o3', title: 'Dropped', pillar_id: 'craft', status: 'dropped', closed_at: at(6, 1) },
        ],
        goalMinutes: { o1: 600 },
      })
    );
    expect(y.goalsAchieved).toEqual([{ id: 'o1', title: 'Run 10k', pillarId: 'body', closedAt: at(5, 20), minutes: 600 }]);
  });

  it('Flick’s path: lifetime stage at the start of the year → at the end, with the stages reached', () => {
    const before = [s('body', new Date(Y - 1, 5, 1).toISOString(), 12 * 60)]; // 12h → Flame on Jan 1
    const during = Array.from({ length: 40 }, (_, i) => s('craft', at(1 + Math.floor(i / 20), 1 + (i % 20)), 240)); // +160h
    const y = buildYear(input({ sessions: [...before, ...during] }));
    expect(y.stageStart.name).toBe('Flame');
    expect(y.stageEnd.name).toBe('Bonfire');
    expect(y.stagesReached).toEqual(['Torch', 'Bonfire']);
    expect(stagePathLine(y)).toBe('Flick grew from a Flame to a Bonfire.');
    expect(stagePathLine(buildYear(input({ sessions: before })))).toBe('Flick stayed a Flame, and every hour fed it.');
  });

  it('an empty year is all zeros, no best month, no streak', () => {
    const y = buildYear(input());
    expect(y).toMatchObject({ totalMinutes: 0, sessionCount: 0, bestMonth: null, longestStreak: null, bestDay: null, pillars: [], stagesReached: [] });
  });

  it('share text: hours, top pillar, streak, goals', () => {
    const y = buildYear(
      input({
        sessions: [s('body', at(0, 1), 600), s('body', at(0, 2), 600), s('craft', at(0, 3), 300)],
        objectives: [{ id: 'o1', title: 'x', pillar_id: 'body', status: 'completed', closed_at: at(3, 3) }],
      })
    );
    expect(yearShareText(y, { final: true })).toBe(
      [`My ${Y} in hours on Intentional:`, '⏱ 25h given to the life I chose', '🥇 Most of it to Body (80%)', '🔥 3 days in a row', '🏆 1 goal achieved'].join('\n')
    );
    expect(yearShareText(y, { final: false }).split('\n')[0]).toBe(`My ${Y} so far on Intentional:`);
  });
});
