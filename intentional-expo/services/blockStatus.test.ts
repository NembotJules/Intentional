import { describe, expect, it } from 'vitest';
import { blockingNow, untilLabel } from './blockStatus';
import { BLOCK_PRESETS, addPreset, presetIsOn, presetWhen, removePreset, type PresetRule } from './blockPresets';
import { ruleStrictBlocks } from './blockRules';

// Thursday 2026-11-05
const at = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m);
const ids = (k: number) => `r${k}`;

describe('block presets (US-103)', () => {
  it('Bedtime is two same-day rules, every day; it reads as one window', () => {
    const rules = addPreset([], 'bedtime', ids);
    expect(rules.map((r) => `${r.start}-${r.end}/${r.days_mask}`)).toEqual(['22:00-23:59/127', '00:00-07:00/127']);
    expect(rules.every((r) => r.preset === 'bedtime' && r.enabled)).toBe(true);
    expect(presetWhen(BLOCK_PRESETS[0]!)).toBe('Every day · 22:00–7:00');
    // both become iOS windows
    expect(ruleStrictBlocks(rules)).toHaveLength(2);
  });
  it('adding is idempotent, removing takes only its rules', () => {
    const mine: PresetRule = { id: 'x', days_mask: 1, start: '10:00', end: '11:00', enabled: true };
    let rules = addPreset([mine], 'work', ids);
    rules = addPreset(rules, 'work', (k) => `again${k}`);
    expect(rules.filter((r) => r.preset === 'work')).toHaveLength(1);
    expect(presetIsOn(rules, 'work')).toBe(true);
    expect(presetIsOn(rules, 'bedtime')).toBe(false);
    rules = removePreset(rules, 'work');
    expect(rules).toEqual([mine]);
  });
  it('a preset with a rule switched off is not "on"', () => {
    const rules = addPreset([], 'bedtime', ids).map((r, k) => (k === 1 ? { ...r, enabled: false } : r));
    expect(presetIsOn(rules, 'bedtime')).toBe(false);
  });
});

describe('Blocking now (US-103)', () => {
  const base = { rules: [] as PresetRule[], duringHabits: false, strictHabits: [], unlockUntil: null };
  it('focus sessions are always there', () => {
    expect(blockingNow({ ...base, now: at(12) })).toEqual([{ id: 'focus', title: 'Focus sessions', sub: 'While a session runs', pill: { text: 'Always', tone: 'always' }, sticker: 'stopwatch' }]);
  });
  it('Work hours: active on a weekday at 10:00, next at 9:00 before, next Mon after on Friday evening', () => {
    const rules = addPreset([], 'work', ids);
    expect(blockingNow({ ...base, rules, now: at(10) })[1]).toMatchObject({ title: 'Work hours', sub: 'Mon–Fri · 9:00–17:00', pill: { text: 'Active', tone: 'active' } });
    expect(blockingNow({ ...base, rules, now: at(8, 30) })[1]!.pill).toEqual({ text: 'Next at 9:00', tone: 'next' });
    expect(blockingNow({ ...base, rules, now: at(18, 0, 6) })[1]!.pill).toEqual({ text: 'Next Mon 9:00', tone: 'next' });
  });
  it('Bedtime is one card; active at 23:00 and at 06:00, next at 22:00 in the afternoon', () => {
    const rules = addPreset([], 'bedtime', ids);
    const c = (d: Date) => blockingNow({ ...base, rules, now: d }).filter((x) => x.id === 'preset_bedtime');
    expect(c(at(23))).toHaveLength(1);
    expect(c(at(23))[0]!.pill.tone).toBe('active');
    expect(c(at(6))[0]!.pill.tone).toBe('active');
    expect(c(at(15))[0]!.pill.text).toBe('Next at 22:00');
  });
  it('an unlock running shows "Unlocked · until 18:05" on the active window', () => {
    const rules = addPreset([], 'work', ids);
    const until = at(10, 5).getTime();
    expect(blockingNow({ ...base, rules, now: at(10), unlockUntil: until })[1]!.pill).toEqual({ text: `Unlocked · until ${untilLabel(until)}`, tone: 'unlocked' });
    expect(untilLabel(at(18, 5).getTime())).toBe('18:05');
  });
  it('the person\'s own block hours get their own card', () => {
    const own: PresetRule = { id: 'own', days_mask: 127, start: '13:00', end: '14:00', enabled: true };
    const cards = blockingNow({ ...base, rules: [own, { ...own, id: 'off', enabled: false }], now: at(13, 30) });
    // US-107: a switched-off rule stays on the tab, "Paused"
    expect(cards.map((c) => c.title)).toEqual(['Focus sessions', 'Block hours', 'Block hours']);
    expect(cards[1]!.pill.tone).toBe('active');
    expect(cards[2]!.pill).toEqual({ text: 'Paused', tone: 'off' });
  });
  it('during my habits: only timed habits; active inside one, next otherwise; nothing when off', () => {
    const strictHabits = [
      { id: 'h1', name: 'Gym', reminder_time: '18:00', target_minutes: 60, days_mask: 127 },
      { id: 'h2', name: 'Read', reminder_time: null, target_minutes: 20, days_mask: 127 },
    ];
    const c = (d: Date, on = true) => blockingNow({ ...base, duringHabits: on, strictHabits, now: d }).find((x) => x.id === 'habits');
    expect(c(at(18, 30))).toMatchObject({ sub: '1 habit with a start time', pill: { tone: 'active' } });
    expect(c(at(12))!.pill.text).toBe('Next at 18:00');
    expect(c(at(12), false)).toBeUndefined();
  });
});
