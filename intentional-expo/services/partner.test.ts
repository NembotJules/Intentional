import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/db', async () => import('@/db/index.web'));

const partner = await import('./partner');
const db = await import('@/db/index.web');

// 2026-10-19 is a Monday.
const SUN = new Date(2026, 9, 25, 18, 0);
const MON = new Date(2026, 9, 26, 9, 0);
const TUE = new Date(2026, 9, 27, 9, 0);
const SAT = new Date(2026, 9, 24, 9, 0);

describe('partner helpers', () => {
  it('cleans phone numbers', () => {
    expect(partner.cleanPhone(' +33 6 12 34 56 78 ')).toBe('+33612345678');
    expect(partner.cleanPhone('(555) 123-4567')).toBe('5551234567');
    expect(partner.cleanPhone('12')).toBeNull();
    expect(partner.cleanPhone(null)).toBeNull();
  });

  it('builds sms links per platform', () => {
    expect(partner.smsUrl('+336', 'Hi & bye', 'ios')).toBe('sms:+336&body=Hi%20%26%20bye');
    expect(partner.smsUrl('+336', 'Hi', 'android')).toBe('sms:+336?body=Hi');
  });

  it('reports this week on Sunday, last week afterwards; due Sunday and Monday only', () => {
    expect(partner.reportWeek(SUN)).toEqual({ weekStart: '2026-10-19', due: true });
    expect(partner.reportWeek(MON)).toEqual({ weekStart: '2026-10-19', due: true });
    expect(partner.reportWeek(TUE)).toEqual({ weekStart: '2026-10-19', due: false });
    expect(partner.reportWeek(SAT)).toEqual({ weekStart: '2026-10-12', due: false });
  });

  it('counts weeks sent in a row; an unsent report still due does not break it', () => {
    expect(partner.sentStreak(['2026-10-05', '2026-10-12', '2026-10-19'], SUN)).toBe(3);
    expect(partner.sentStreak(['2026-10-05', '2026-10-12'], SUN)).toBe(2); // this week not sent yet
    expect(partner.sentStreak(['2026-10-05', '2026-10-19'], MON)).toBe(1); // gap on the 12th
    expect(partner.sentStreak([], MON)).toBe(0);
  });

  it('writes an invite that says what they will get and what to do', () => {
    const msg = partner.inviteMessage({ userName: 'Alex', partnerName: 'Sam', pillars: ['Body', 'Craft', 'Mind'], goals: ['Run a half marathon'] });
    expect(msg).toContain("Hey Sam! I'm giving my hours to Body, Craft and Mind (Run a half marathon).");
    expect(msg).toContain('Every Sunday I\'ll send you my week');
    expect(msg).toContain('ask me why');
    expect(msg.endsWith('— Alex')).toBe(true);
  });

  it('labels the next report day', () => {
    expect(partner.nextReportLabel(SUN)).toBe('Today');
    expect(partner.nextReportLabel(SAT)).toBe('Sunday, Oct 25');
  });
});

describe('partner storage', () => {
  beforeEach(() => {
    db.setSetting('partner', '');
    db.setSetting('partner_sent_weeks', '[]');
    db.setSetting('partner_prompt_dismissed', '');
  });

  it('saves, reads back, keeps "since" on edit and resets the invite when the person changes', () => {
    expect(partner.getPartner()).toBeNull();
    const p = partner.savePartner({ name: '  Sam ', phone: '+33 6 12 34 56 78' });
    expect(p).toMatchObject({ name: 'Sam', phone: '+33612345678', invitedAt: null });
    partner.markInvited();
    expect(partner.getPartner()!.invitedAt).not.toBeNull();
    const edited = partner.savePartner({ name: 'Sam', phone: '' });
    expect(edited.since).toBe(p.since);
    expect(edited.phone).toBeNull();
    expect(edited.invitedAt).not.toBeNull();
    expect(partner.savePartner({ name: 'Jo' }).invitedAt).toBeNull();
    expect(() => partner.savePartner({ name: '  ' })).toThrow();
    partner.removePartner();
    expect(partner.getPartner()).toBeNull();
  });

  it('records sent weeks once each', () => {
    partner.markWeekSent('2026-10-19');
    partner.markWeekSent('2026-10-12');
    partner.markWeekSent('2026-10-19');
    expect(partner.getSentWeeks()).toEqual(['2026-10-12', '2026-10-19']);
    expect(partner.isWeekSent('2026-10-19')).toBe(true);
    expect(partner.isWeekSent('2026-10-05')).toBe(false);
  });

  it('snoozes the Today prompt for 14 days', () => {
    expect(partner.isPartnerPromptSnoozed()).toBe(false);
    partner.snoozePartnerPrompt();
    expect(partner.isPartnerPromptSnoozed()).toBe(true);
    expect(partner.isPartnerPromptSnoozed(new Date(Date.now() + 15 * 864e5))).toBe(false);
  });
});
