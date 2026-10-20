import { describe, expect, it } from 'vitest';
import { dayKeyDiff, localDayKey, localDayKeyFromIso, localDayRangeIso, shiftDayKey, isDueToday, timeToMinutes } from './dates';
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

describe('US-069: habit scheduling', () => {
  describe('isDueToday', () => {
    it('returns true for Monday when bit 0 is set', () => {
      const monday = new Date(2026, 9, 5); // Monday, Oct 5, 2026
      expect(isDueToday(1, monday)).toBe(true); // 0b0000001
      expect(isDueToday(2, monday)).toBe(false); // 0b0000010
    });

    it('returns true for Tuesday when bit 1 is set', () => {
      const tuesday = new Date(2026, 9, 6); // Tuesday, Oct 6, 2026
      expect(isDueToday(2, tuesday)).toBe(true); // 0b0000010
      expect(isDueToday(1, tuesday)).toBe(false); // 0b0000001
    });

    it('returns true for Sunday when bit 6 is set', () => {
      const sunday = new Date(2026, 9, 11); // Sunday, Oct 11, 2026
      expect(isDueToday(64, sunday)).toBe(true); // 0b1000000
      expect(isDueToday(1, sunday)).toBe(false); // 0b0000001
    });

    it('returns true for all days when all bits are set (127)', () => {
      const monday = new Date(2026, 9, 5);
      const tuesday = new Date(2026, 9, 6);
      const sunday = new Date(2026, 9, 11);
      expect(isDueToday(127, monday)).toBe(true);
      expect(isDueToday(127, tuesday)).toBe(true);
      expect(isDueToday(127, sunday)).toBe(true);
    });

    it('returns true for weekdays only when bits 0-4 are set (31)', () => {
      const monday = new Date(2026, 9, 5);
      const friday = new Date(2026, 9, 9);
      const saturday = new Date(2026, 9, 10);
      const sunday = new Date(2026, 9, 11);
      expect(isDueToday(31, monday)).toBe(true); // 0b0011111
      expect(isDueToday(31, friday)).toBe(true);
      expect(isDueToday(31, saturday)).toBe(false);
      expect(isDueToday(31, sunday)).toBe(false);
    });

    it('returns true for weekends only when bits 5-6 are set (96)', () => {
      const friday = new Date(2026, 9, 9);
      const saturday = new Date(2026, 9, 10);
      const sunday = new Date(2026, 9, 11);
      expect(isDueToday(96, friday)).toBe(false); // 0b1100000
      expect(isDueToday(96, saturday)).toBe(true);
      expect(isDueToday(96, sunday)).toBe(true);
    });
  });

  describe('timeToMinutes', () => {
    it('converts HH:MM to minutes since midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('07:30')).toBe(450);
      expect(timeToMinutes('12:00')).toBe(720);
      expect(timeToMinutes('23:59')).toBe(1439);
    });

    it('returns 9999 for null (anytime)', () => {
      expect(timeToMinutes(null)).toBe(9999);
    });

    it('returns 9999 for invalid time strings', () => {
      expect(timeToMinutes('')).toBe(9999);
      expect(timeToMinutes('invalid')).toBe(9999);
      expect(timeToMinutes('25:00')).toBe(9999);
    });
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
