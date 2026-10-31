import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', async () => import('@/db/index.web'));

const ritual = await import('./ritual');
const db = await import('@/db/index.web');

// 2026-10-19 is a Monday.
const SUN_10 = new Date(2026, 9, 25, 10, 0);
const SUN_18 = new Date(2026, 9, 25, 18, 0);
const MON = new Date(2026, 9, 26, 9, 0);
const WED = new Date(2026, 9, 21, 9, 0);

describe('Sunday ritual', () => {
  beforeEach(() => {
    db.setSetting('ritual_done_2026-10-19', '');
    db.setSetting(ritual.RITUAL_TIME_SETTING, '');
    db.setSetting(ritual.RITUAL_REMINDER_SETTING, '');
  });

  it('looks at the week that just ended on Sunday and Monday, this week otherwise', () => {
    expect(ritual.ritualWeek(SUN_18)).toBe('2026-10-19');
    expect(ritual.ritualWeek(MON)).toBe('2026-10-19');
    expect(ritual.ritualWeek(WED)).toBe('2026-10-19');
    expect(ritual.ritualWeek(new Date(2026, 9, 28, 9))).toBe('2026-10-26');
  });

  it('is due from Sunday noon through Monday until done', () => {
    expect(ritual.isRitualDue(SUN_10)).toBe(false);
    expect(ritual.isRitualDue(SUN_18)).toBe(true);
    expect(ritual.isRitualDue(MON)).toBe(true);
    expect(ritual.isRitualDue(WED)).toBe(false);
    ritual.markRitualDone('2026-10-19');
    expect(ritual.isRitualDue(SUN_18)).toBe(false);
    expect(ritual.isRitualDue(MON)).toBe(false);
  });

  it('reminder is on by default at 6:00 PM, and names the partner', () => {
    expect(ritual.isRitualReminderOn()).toBe(true);
    expect(ritual.ritualTime()).toEqual({ hour: 18, minute: 0, label: '6:00 PM' });
    db.setSetting(ritual.RITUAL_TIME_SETTING, '20:30');
    expect(ritual.ritualTime().label).toBe('8:30 PM');
    db.setSetting(ritual.RITUAL_REMINDER_SETTING, '0');
    expect(ritual.isRitualReminderOn()).toBe(false);
    expect(ritual.ritualReminderContent('Sam').body).toContain('send it to Sam');
    expect(ritual.ritualReminderContent(null).body).not.toContain('send it');
  });
});
