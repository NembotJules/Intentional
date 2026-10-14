import { describe, expect, it } from 'vitest';
import { dayKeyDiff, localDayKey, localDayKeyFromIso, localDayRangeIso, shiftDayKey } from './dates';
import { getGoalColor, getGoalTint, resolveGoalTone } from './goalColors';

describe('local day helpers', () => {
  it('buckets a just-after-midnight local time into the local day, not the UTC day', () => {
    const justAfterMidnight = new Date(2026, 9, 5, 0, 30); // local Oct 5, 00:30
    expect(localDayKey(justAfterMidnight)).toBe('2026-10-05');
    expect(localDayKeyFromIso(justAfterMidnight.toISOString())).toBe('2026-10-05');
  });

  it('day range covers exactly one local day', () => {
    const { start, end } = localDayRangeIso('2026-10-05');
    expect(new Date(start).getTime()).toBe(new Date(2026, 9, 5).getTime());
    expect(new Date(end).getTime()).toBe(new Date(2026, 9, 6).getTime() - 1);
  });

  it('shifts and diffs across month and year boundaries', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayKeyDiff('2026-01-31', '2026-02-01')).toBe(1);
    expect(dayKeyDiff('2026-02-01', '2026-01-31')).toBe(-1);
  });
});

describe('goal colors', () => {
  it('uses the color the user picked', () => {
    expect(getGoalColor({ id: 'any', color: '#2F8F5B' })).toBe('#2F8F5B');
    expect(getGoalTint({ id: 'any', color: '#2F8F5B' })).toBe('rgba(47,143,91,0.14)');
  });

  it('falls back to a stable hashed tone when the stored color is missing or invalid', () => {
    expect(getGoalColor({ id: 'goal-1', color: '' })).toBe(resolveGoalTone('goal-1').primary);
    expect(getGoalColor({ id: 'goal-1', color: null })).toBe(resolveGoalTone('goal-1').primary);
  });
});
