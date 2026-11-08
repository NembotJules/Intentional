import { describe, expect, it } from 'vitest';
import { currentDayStreak, streakLine, weekDays } from './dayStreak';

describe('day streak (US-111)', () => {
  it('counts back from today, or from yesterday while today is still open', () => {
    expect(currentDayStreak(new Set(['2026-11-05', '2026-11-06', '2026-11-07']), '2026-11-07')).toBe(3);
    expect(currentDayStreak(new Set(['2026-11-05', '2026-11-06']), '2026-11-07')).toBe(2);
    expect(currentDayStreak(new Set(['2026-11-04', '2026-11-06']), '2026-11-07')).toBe(1);
    expect(currentDayStreak(new Set(['2026-11-04']), '2026-11-07')).toBe(0);
    expect(currentDayStreak(new Set(['2026-10-31', '2026-11-01']), '2026-11-01')).toBe(2);
  });
  it('this week runs Monday → Sunday with done, today and future marked', () => {
    const w = weekDays(new Set(['2026-11-02', '2026-11-04']), '2026-11-04'); // a Wednesday
    expect(w.map((d) => d.key)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
    expect(w.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(w.findIndex((d) => d.isToday)).toBe(2);
    expect(w.filter((d) => d.future).length).toBe(4);
    expect(weekDays(new Set(), '2026-11-08')[6]!.isToday).toBe(true); // Sunday is the last day
  });
  it('a short line for every length', () => {
    expect(streakLine(0)).toMatch(/light it/);
    expect(streakLine(1)).toMatch(/Day one/);
    expect(streakLine(4)).toMatch(/Keep it going/);
    expect(streakLine(12)).toMatch(/rhythm/);
    expect(streakLine(40)).toMatch(/who you are/);
  });
});
