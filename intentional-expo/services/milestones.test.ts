import { describe, expect, it } from 'vitest';
import type { HabitDay } from './weekSummary';
import { celebrates, detectMilestones, milestoneCopy, milestoneKey, type MilestoneInput } from './milestones';
import { localDayKey, localDayStart, shiftDayKey } from '@/utils/dates';

// Dates relative to today: `w` weeks ago, Monday + `d` days, at `h` o'clock.
const thisMonday = (() => {
  const t = localDayKey();
  const dow = localDayStart(t).getDay();
  return shiftDayKey(t, dow === 0 ? -6 : 1 - dow);
})();
const at = (weeksAgo: number, d = 0, h = 9) => {
  const day = localDayStart(shiftDayKey(thisMonday, -7 * weeksAgo + d));
  day.setHours(h);
  return day.toISOString();
};
const s = (goal: string, startedAt: string, mins: number) => ({ goal_id: goal, started_at: startedAt, duration_seconds: mins * 60 });
const base = (over: Partial<MilestoneInput> = {}): MilestoneInput => ({
  now: new Date(),
  sessions: [],
  pillars: [{ id: 'body' }, { id: 'craft' }],
  objectives: [],
  habitWeeks: [],
  existing: [],
  ...over,
});

describe('detectMilestones · pillar hours (US-080)', () => {
  it('fires exactly at 10h on one pillar, dated by the session that crossed it', () => {
    const sessions = [s('body', at(3, 0), 540), s('body', at(2, 0), 59), s('body', at(1, 0), 1)];
    const got = detectMilestones(base({ sessions }));
    expect(got).toEqual([{ kind: 'pillar_hours', ref_id: 'body', value: 10, achieved_at: new Date(Date.parse(at(1, 0)) + 60_000).toISOString() }]);
  });
  it('does not fire at 9h59m', () => {
    expect(detectMilestones(base({ sessions: [s('body', at(1), 599)] }))).toEqual([]);
  });
  it('counts per pillar, not in total', () => {
    expect(detectMilestones(base({ sessions: [s('body', at(1), 300), s('craft', at(1, 1), 300)] }))).toEqual([]);
  });
  it('one long history crosses several lines, each once (retroactive backfill)', () => {
    const sessions = Array.from({ length: 60 }, (_, i) => s('body', at(20, i, 8), 120)); // 120h
    expect(detectMilestones(base({ sessions })).filter((m) => m.kind === 'pillar_hours').map((m) => m.value)).toEqual([10, 50, 100]);
  });
  it('never fires twice: recorded milestones are skipped', () => {
    const sessions = [s('body', at(1), 660)];
    const first = detectMilestones(base({ sessions }));
    expect(first).toHaveLength(1);
    expect(detectMilestones(base({ sessions, existing: first }))).toEqual([]);
  });
  it('a 1,000h pillar records every line up to 1,000', () => {
    const sessions = Array.from({ length: 100 }, (_, i) => s('craft', at(30, i, 6), 600));
    expect(detectMilestones(base({ sessions })).map((m) => m.value)).toEqual([10, 50, 100, 250, 500, 1000]);
  });
});

describe('detectMilestones · goals (US-080)', () => {
  it('records each achieved goal once, at its close date; dropped goals are not milestones', () => {
    const closed = at(1, 2);
    const objectives = [
      { id: 'o1', status: 'completed', closed_at: closed },
      { id: 'o2', status: 'dropped', closed_at: closed },
      { id: 'o3', status: 'active', closed_at: null },
    ];
    const got = detectMilestones(base({ objectives }));
    expect(got).toEqual([{ kind: 'goal', ref_id: 'o1', value: 1, achieved_at: closed }]);
    expect(celebrates(got[0]!)).toBe(false);
    expect(detectMilestones(base({ objectives, existing: got }))).toEqual([]);
  });
});

describe('detectMilestones · a week with every habit kept (US-080)', () => {
  const D = (x: string) => x.split('') .map((c) => ({ d: 'done', r: 'rest', m: 'missed', o: 'off', t: 'today', u: 'upcoming' })[c] as HabitDay);
  it('the first week with every scheduled day done (rest days allowed) fires, once', () => {
    const habitWeeks = [
      { weekStart: shiftDayKey(thisMonday, -21), habits: [D('ddmdddd')] },
      { weekStart: shiftDayKey(thisMonday, -14), habits: [D('ddrdddd'), D('dodoodo')] },
      { weekStart: shiftDayKey(thisMonday, -7), habits: [D('ddddddd')] },
    ];
    const got = detectMilestones(base({ habitWeeks }));
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ kind: 'habit_week', value: 1 });
    expect(localDayKey(new Date(got[0]!.achieved_at))).toBe(shiftDayKey(thisMonday, -8)); // that week's Sunday
  });
  it('a week still in progress does not count until every day is done', () => {
    expect(detectMilestones(base({ habitWeeks: [{ weekStart: thisMonday, habits: [D('dddtuuu')] }] }))).toEqual([]);
  });
  it('a week of only rest days or no scheduled habits does not count', () => {
    expect(detectMilestones(base({ habitWeeks: [{ weekStart: thisMonday, habits: [D('rrooooo')] }] }))).toEqual([]);
    expect(detectMilestones(base({ habitWeeks: [{ weekStart: thisMonday, habits: [] }] }))).toEqual([]);
  });
});

describe('detectMilestones · 4 weeks with every pillar getting time (US-080)', () => {
  const weekOf = (weeksAgo: number, pillars = ['body', 'craft']) => pillars.map((p, i) => s(p, at(weeksAgo, i, 10), 30));
  it('fires on the 4th full week, at the moment its last pillar got time', () => {
    const sessions = [...weekOf(4), ...weekOf(3), ...weekOf(2), ...weekOf(1)];
    const got = detectMilestones(base({ sessions }));
    expect(got).toEqual([{ kind: 'pillar_weeks', ref_id: null, value: 4, achieved_at: new Date(Date.parse(at(1, 1, 10)) + 30 * 60_000).toISOString() }]);
  });
  it('3 weeks are not enough, and a week where one pillar got nothing resets the run', () => {
    expect(detectMilestones(base({ sessions: [...weekOf(3), ...weekOf(2), ...weekOf(1)] }))).toEqual([]);
    const broken = [...weekOf(5), ...weekOf(4), ...weekOf(3, ['body']), ...weekOf(2), ...weekOf(1)];
    expect(detectMilestones(base({ sessions: broken }))).toEqual([]);
  });
  it('this week counts as soon as every pillar has time; an unfinished current week does not break the run', () => {
    const sessions = [...weekOf(3), ...weekOf(2), ...weekOf(1), ...weekOf(0)];
    expect(detectMilestones(base({ sessions })).map((m) => m.kind)).toEqual(['pillar_weeks']);
    const partial = [...weekOf(4), ...weekOf(3), ...weekOf(2), ...weekOf(1), ...weekOf(0, ['body'])];
    expect(detectMilestones(base({ sessions: partial })).map((m) => m.kind)).toEqual(['pillar_weeks']);
  });
  it('archived pillars do not have to get time', () => {
    const sessions = [...weekOf(4, ['body']), ...weekOf(3, ['body']), ...weekOf(2, ['body']), ...weekOf(1, ['body'])];
    expect(detectMilestones(base({ sessions, pillars: [{ id: 'body' }, { id: 'old', is_archived: 1 }] })).map((m) => m.kind)).toEqual(['pillar_weeks']);
  });
});

describe('milestoneCopy / keys', () => {
  it('words each milestone with the pillar name', () => {
    const c = milestoneCopy({ kind: 'pillar_hours', ref_id: 'body', value: 1000, achieved_at: '' }, () => 'Body');
    expect(c.title).toBe('1,000 hours to Body.');
    expect(c.big).toBe('1,000h');
    expect(c.share).toContain('1,000 hours given to Body');
    expect(c.share).toContain('https://nembotjules.vercel.app/intentional');
    expect(milestoneCopy({ kind: 'pillar_weeks', ref_id: null, value: 4, achieved_at: '' }, () => null).title).toBe('4 weeks in a row, every pillar got time.');
  });
  it('keys by kind, ref and value', () => {
    expect(milestoneKey({ kind: 'pillar_hours', ref_id: 'body', value: 50 })).toBe('pillar_hours|body|50');
    expect(milestoneKey({ kind: 'habit_week', ref_id: null, value: 1 })).toBe('habit_week||1');
  });
});
