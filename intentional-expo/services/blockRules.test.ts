import { describe, expect, it } from 'vitest';
import { blockingWhenSummary, describeRule, isRuleBlockId, parseRules, ruleError, ruleStrictBlocks, type BlockRule } from './blockRules';

const rule = (o: Partial<BlockRule> = {}): BlockRule => ({ id: 'r1', days_mask: 31, start: '09:00', end: '12:00', enabled: true, ...o });

describe('blocking rules', () => {
  it('describes a rule the way people say it', () => {
    expect(describeRule(rule())).toBe('Mon–Fri · 9:00–12:00');
    expect(describeRule(rule({ days_mask: 96, start: '20:30', end: '23:59' }))).toBe('Weekends · 20:30–23:59');
  });

  it('refuses rules iOS could not run', () => {
    expect(ruleError(rule())).toBeNull();
    expect(ruleError(rule({ days_mask: 0 }))).toBe("Tap the days it's on.");
    expect(ruleError(rule({ start: '9am' }))).toBe('Use the HH:MM format, like 09:00.');
    expect(ruleError(rule({ start: '22:00', end: '06:00' }))).toBe('The end must be after the start (same day).');
    expect(ruleError(rule({ start: '09:00', end: '09:10' }))).toBe('At least 15 minutes.');
  });

  it('turns enabled rules into weekly windows with a rule_ id (Sunday = 1)', () => {
    const blocks = ruleStrictBlocks([rule(), rule({ id: 'off', enabled: false }), rule({ id: 'sun', days_mask: 64, start: '10:00', end: '11:30' })]);
    expect(blocks).toEqual([
      { habitId: 'rule_r1', weekdays: [2, 3, 4, 5, 6], startHour: 9, startMinute: 0, endHour: 12, endMinute: 0 },
      { habitId: 'rule_sun', weekdays: [1], startHour: 10, startMinute: 0, endHour: 11, endMinute: 30 },
    ]);
    expect(isRuleBlockId('rule_r1')).toBe(true);
    expect(isRuleBlockId('h_run')).toBe(false);
  });

  it('reads saved rules defensively', () => {
    expect(parseRules(null)).toEqual([]);
    expect(parseRules('nope')).toEqual([]);
    expect(parseRules(JSON.stringify([rule(), { id: 'x' }]))).toEqual([rule()]);
  });

  it('summarises when apps are blocked', () => {
    expect(blockingWhenSummary({ duringHabits: true, strictHabitCount: 3, rules: [rule()] })).toBe('Focus sessions · 3 habits · Mon–Fri 9:00–12:00');
    expect(blockingWhenSummary({ duringHabits: false, strictHabitCount: 3, rules: [] })).toBe('Focus sessions');
    expect(blockingWhenSummary({ duringHabits: true, strictHabitCount: 1, rules: [rule(), rule({ id: 'b' })] })).toBe('Focus sessions · 1 habit · 2 block hours');
  });
});
