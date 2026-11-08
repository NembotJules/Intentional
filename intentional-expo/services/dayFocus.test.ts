import { describe, expect, it } from 'vitest';
import { dayBreakdown, weekDays } from './dayFocus';

describe('Progress day strip (US-109)', () => {
  it('the week runs Monday → Sunday around today; days after today are future', () => {
    const d = weekDays(new Date(2026, 10, 7, 15)); // Saturday 7 Nov 2026
    expect(d.map((x) => `${x.short} ${x.date.getDate()}`)).toEqual(['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8']);
    expect(d.filter((x) => x.isToday).map((x) => x.short)).toEqual(['Sat']);
    expect(d.filter((x) => x.isFuture).map((x) => x.short)).toEqual(['Sun']);
    expect(weekDays(new Date(2026, 10, 8, 9))[6]!.isToday).toBe(true); // Sunday stays in the same week
  });
  it('a day: total minutes and the split by pillar, biggest first', () => {
    const at = (h: number, day = 7) => new Date(2026, 10, day, h).toISOString();
    const s = [
      { goal_id: 'body', started_at: at(8), duration_seconds: 1500 },
      { goal_id: 'craft', started_at: at(10), duration_seconds: 3600 },
      { goal_id: 'body', started_at: at(18), duration_seconds: 900 },
      { goal_id: 'craft', started_at: at(10, 6), duration_seconds: 3600 },
    ];
    expect(dayBreakdown(s, new Date(2026, 10, 7))).toEqual({ minutes: 100, parts: [{ goalId: 'craft', minutes: 60 }, { goalId: 'body', minutes: 40 }] });
    expect(dayBreakdown(s, new Date(2026, 10, 5))).toEqual({ minutes: 0, parts: [] });
  });
});
