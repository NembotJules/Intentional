import { describe, expect, it } from 'vitest';
import { durationChoices, pickUpNext, upNextWhen, type NextStep, type OpenHabit } from './upNext';

const h = (id: string, time: string | null, extra: Partial<OpenHabit> = {}): OpenHabit => ({ id, name: id, pillarId: 'p', time, type: 'session', minutes: 30, ...extra });
const step: NextStep = { taskId: 't1', title: 'Buy shoes', pillarId: 'p', goalTitle: 'Half marathon', minutes: 45 };
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

describe('Up next (US-098)', () => {
  it('the habit coming up next by its start time', () => {
    const u = pickUpNext([h('read', '20:00'), h('run', '18:00'), h('stretch', null)], [step], at('17:30'));
    expect(u).toMatchObject({ kind: 'habit', habit: { id: 'run' }, when: 'soon', inMinutes: 30 });
    expect(upNextWhen(u!)).toBe('In 30 min · 18:00');
  });
  it('a habit whose time just came is "now" for 30 minutes', () => {
    const u = pickUpNext([h('run', '18:00'), h('read', '20:00')], [], at('18:20'));
    expect(u).toMatchObject({ habit: { id: 'run' }, when: 'now', inMinutes: null });
    expect(upNextWhen(u!)).toBe('Now · 18:00');
    expect(upNextWhen(pickUpNext([h('run', '07:00')], [], at('07:05'))!)).toBe('Now · 7:00');
  });
  it('past the window: the next timed one, then an anytime habit, then a missed one', () => {
    expect(pickUpNext([h('run', '07:00'), h('read', '20:00')], [], at('09:00'))).toMatchObject({ habit: { id: 'read' } });
    expect(pickUpNext([h('run', '07:00'), h('stretch', null)], [], at('09:00'))).toMatchObject({ habit: { id: 'stretch' }, when: 'anytime' });
    const missed = pickUpNext([h('run', '07:00')], [step], at('09:00'));
    expect(missed).toMatchObject({ habit: { id: 'run' }, when: 'missed' });
    expect(upNextWhen(missed!)).toBe('Missed 7:00 · still today');
  });
  it('no habit left: the goal\'s next step; nothing at all: null', () => {
    const u = pickUpNext([], [step], at('09:00'));
    expect(u).toEqual({ kind: 'step', step });
    expect(upNextWhen(u!)).toBe('Next step · Half marathon');
    expect(pickUpNext([], [], 600)).toBeNull();
  });
  it('far-off habits say "At 20:00", not "In 600 min"', () => {
    expect(upNextWhen(pickUpNext([h('read', '20:00')], [], at('08:00'))!)).toBe('At 20:00');
  });
});

describe('Focus sheet durations (US-099)', () => {
  it('presets plus the suggested length, sorted, no duplicates, clamped', () => {
    expect(durationChoices(25)).toEqual([15, 25, 45, 60, 90]);
    expect(durationChoices(30)).toEqual([15, 25, 30, 45, 60, 90]);
    expect(durationChoices(0)).toEqual([15, 25, 45, 60, 90]);
    expect(durationChoices(500)).toEqual([15, 25, 45, 60, 90, 240]);
  });
});
