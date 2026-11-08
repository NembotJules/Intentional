import { describe, expect, it } from 'vitest';
import { blockerError, blockerWhen, blockersFromRules, newBlocker, removeBlocker, rulesForBlocker, upsertBlocker, type Blocker } from './blockers';
import { addPreset, presetIsOn, type PresetRule } from './blockPresets';
import { blockingNow } from './blockStatus';
import { ruleStrictBlocks } from './blockRules';

const ids = (p: string) => (k: number) => `${p}${k}`;
const b = (o: Partial<Blocker>): Blocker => ({ ...newBlocker('g1'), name: 'Study', ...o });

describe('blockers (US-107)', () => {
  it('a preset reads back as one blocker with its name, sticker and window (Bedtime across midnight)', () => {
    const [bed] = blockersFromRules(addPreset([], 'bedtime', ids('r')));
    expect(bed).toMatchObject({ id: 'preset:bedtime', name: 'Bedtime', sticker: 'moon', allDay: false, start: '22:00', end: '07:00', days_mask: 127, enabled: true, preset: 'bedtime' });
    expect(blockerWhen(bed!)).toBe('Every day · 22:00–7:00');
  });
  it('a window across midnight becomes two same-day rules; a normal one, one; all day is 00:00–23:59', () => {
    expect(rulesForBlocker(b({ start: '23:00', end: '06:30' }), ids('x')).map((r) => `${r.start}-${r.end}`)).toEqual(['23:00-23:59', '00:00-06:30']);
    expect(rulesForBlocker(b({ start: '22:00', end: '00:00' }), ids('x')).map((r) => `${r.start}-${r.end}`)).toEqual(['22:00-23:59']);
    expect(rulesForBlocker(b({ start: '09:00', end: '12:00' }), ids('x')).map((r) => `${r.start}-${r.end}`)).toEqual(['09:00-12:00']);
    const all = rulesForBlocker(b({ allDay: true, days_mask: 0b0011111 }), ids('x'));
    expect(all.map((r) => `${r.start}-${r.end}`)).toEqual(['00:00-23:59']);
    expect(blockersFromRules(all)[0]).toMatchObject({ allDay: true, name: 'Study', sticker: 'lock' });
    expect(blockerWhen(blockersFromRules(all)[0]!)).toBe('Mon–Fri · All day');
    expect(blockerWhen({ allDay: true, start: '', end: '', days_mask: 127 })).toBe('All day');
    // every rule is a real iOS window
    expect(ruleStrictBlocks(rulesForBlocker(b({ start: '23:00', end: '06:30' }), ids('x')))).toHaveLength(2);
  });
  it('save, edit in place, delete', () => {
    const own: PresetRule = { id: 'old', days_mask: 1, start: '10:00', end: '11:00', enabled: true };
    let rules = upsertBlocker([own], b({ id: 'g1', start: '13:00', end: '14:00' }), ids('a'));
    rules = addPreset(rules, 'work', ids('w'));
    rules = upsertBlocker(rules, b({ id: 'g1', name: 'Deep work', sticker: 'laptop', start: '22:00', end: '01:00' }), ids('b'));
    expect(blockersFromRules(rules).map((x) => x.name)).toEqual(['Block hours', 'Deep work', 'Work hours']);
    expect(blockersFromRules(rules)[1]).toMatchObject({ sticker: 'laptop', start: '22:00', end: '01:00' });
    rules = removeBlocker(rules, 'g1');
    expect(blockersFromRules(rules).map((x) => x.name)).toEqual(['Block hours', 'Work hours']);
    expect(presetIsOn(rules, 'work')).toBe(true);
  });
  it('editing a preset keeps it a preset, with the new times', () => {
    let rules = addPreset([], 'bedtime', ids('r'));
    const [bed] = blockersFromRules(rules);
    rules = upsertBlocker(rules, { ...bed!, start: '23:00' }, ids('e'));
    expect(blockersFromRules(rules)).toHaveLength(1);
    expect(blockersFromRules(rules)[0]).toMatchObject({ name: 'Bedtime', start: '23:00', end: '07:00', preset: 'bedtime' });
    expect(presetIsOn(rules, 'bedtime')).toBe(true);
  });
  it('errors: no days, same start and end, too short across midnight; all day only needs days', () => {
    expect(blockerError(b({ days_mask: 0 }))).toBe("Tap the days it's on.");
    expect(blockerError(b({ start: '10:00', end: '10:00' }))).toBe('Pick an end time.');
    expect(blockerError(b({ start: '23:50', end: '06:00' }))).toBe('At least 15 minutes.');
    expect(blockerError(b({ start: '9:7', end: '10:00' }))).toBe('Use the HH:MM format, like 09:00.');
    expect(blockerError(b({ allDay: true, start: 'x', end: 'y' }))).toBeNull();
    expect(blockerError(b({ start: '22:00', end: '07:00' }))).toBeNull();
  });
  it('Blocking now shows each blocker with its own name and sticker, editable', () => {
    const rules = upsertBlocker([], b({ id: 'g1', name: 'Study', sticker: 'book', start: '13:00', end: '14:00' }), ids('a'));
    const card = blockingNow({ now: new Date(2026, 10, 5, 13, 30), rules, duringHabits: false, strictHabits: [], unlockUntil: null })[1]!;
    expect(card).toMatchObject({ id: 'rule_g1', title: 'Study', sub: 'Every day · 13:00–14:00', sticker: 'book', blockerId: 'g1', pill: { tone: 'active' } });
  });
});
