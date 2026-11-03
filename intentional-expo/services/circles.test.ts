import { describe, expect, it, vi } from 'vitest';
import {
  circleDeepLink,
  circleFormError,
  circleInviteMessage,
  collectiveLabel,
  collectiveProgress,
  createCircle,
  friendlyCircleError,
  getMyCircles,
  hoursLabel,
  joinCircle,
  memberHours,
  suggestPillar,
  targetMinutes,
} from './circles';
import { weekStartOf } from './weekSummary';
import type { Supa } from './supabase';

const fake = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { client: { rpc } as unknown as Supa, rpc };
};

describe('circles: words and numbers (US-091)', () => {
  it('hours: short, readable', () => {
    expect(hoursLabel(0)).toBe('0 h');
    expect(hoursLabel(45)).toBe('45 min');
    expect(hoursLabel(90)).toBe('1.5 h');
    expect(hoursLabel(2520)).toBe('42 h');
    expect(hoursLabel(-5)).toBe('0 h');
  });
  it('collective progress: "42 h of 50 h to Craft this week", capped at full', () => {
    const c = { total_minutes: 2520, weekly_target_minutes: 3000, pillar_label: 'Craft' };
    expect(collectiveLabel(c)).toBe('42 h of 50 h to Craft this week');
    expect(collectiveProgress(c)).toBeCloseTo(0.84);
    expect(collectiveProgress({ total_minutes: 4000, weekly_target_minutes: 3000 })).toBe(1);
    expect(collectiveProgress({ total_minutes: 10, weekly_target_minutes: 0 })).toBe(0);
  });
  it('a member\'s hours carry a rank only when ranking is on', () => {
    expect(memberHours({ minutes: 360, rank: 1 }, true)).toBe('#1 · 6 h');
    expect(memberHours({ minutes: 360, rank: 1 }, false)).toBe('6 h');
    expect(memberHours({ minutes: 360, rank: null }, true)).toBe('6 h');
  });
  it('suggests your pillar that fits the circle\'s label', () => {
    const ps = [{ id: 'a', name: 'Body' }, { id: 'b', name: 'Craft & code' }, { id: 'c', name: 'craft' }];
    expect(suggestPillar('Craft', ps)?.id).toBe('c');
    expect(suggestPillar('code', ps)?.id).toBe('b');
    expect(suggestPillar('Faith', ps)?.id).toBe('a');
    expect(suggestPillar('Craft', [])).toBeNull();
  });
  it('the create form: plain-word problems, in order', () => {
    const good = { name: 'Makers', label: 'Craft', targetHours: '50', pillarId: 'p1' };
    expect(circleFormError(good)).toBeNull();
    expect(circleFormError({ ...good, name: ' ' })).toMatch(/name/);
    expect(circleFormError({ ...good, name: 'x'.repeat(41) })).toMatch(/40/);
    expect(circleFormError({ ...good, label: '' })).toMatch(/pillar/);
    expect(circleFormError({ ...good, targetHours: '0' })).toMatch(/between 1 and 1000/);
    expect(circleFormError({ ...good, targetHours: 'abc' })).toMatch(/between/);
    expect(circleFormError({ ...good, pillarId: null })).toMatch(/your pillars/);
    expect(targetMinutes('12,5')).toBe(750);
  });
  it('the invite: who, what the circle sees (never tasks), the code, the link', () => {
    const m = circleInviteMessage({ userName: 'Jules', code: 'abcd2345', name: 'Makers', label: 'Craft', targetMinutes: 3000 });
    expect(m).toContain('Jules invites you to their circle “Makers” on Intentional: 50 h a week to Craft, together.');
    expect(m).toContain('Never your tasks or notes.');
    expect(m).toContain('Code: ABCD 2345');
    expect(m).toContain('intentional://circles?code=ABCD2345');
    expect(circleInviteMessage({ code: 'X', name: 'M', label: 'C', targetMinutes: 60 })).toMatch(/^Join my circle/);
    expect(circleDeepLink(' abcd-2345')).toBe('intentional://circles?code=ABCD2345');
  });
  it('errors in plain words', () => {
    expect(friendlyCircleError({ message: 'circle is full' })).toMatch(/full \(8 people\)/);
    expect(friendlyCircleError({ message: 'circle not found' })).toMatch(/isn’t valid/);
    expect(friendlyCircleError({ message: 'only the owner' })).toMatch(/owner/);
    expect(friendlyCircleError(new Error('Failed to fetch'))).toMatch(/No connection/);
    expect(friendlyCircleError('weird')).toMatch(/Something went wrong/);
  });
});

describe('circles: week boundaries (US-091)', () => {
  it('the week sent to the server is the local Monday, whatever the day', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02'); // Sunday: still the same week
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09'); // next Monday: the ranking resets
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28'); // across a year
  });
});

describe('circles: RPC calls (US-091)', () => {
  it('create sends trimmed fields and minutes', async () => {
    const { client, rpc } = fake({ data: { id: 'c1', invite_code: 'ABCD2345' } });
    await expect(createCircle(client, { name: ' Makers ', label: ' Craft', targetMinutes: 3000, pillarId: 'p1' })).resolves.toEqual({ id: 'c1', invite_code: 'ABCD2345' });
    expect(rpc).toHaveBeenCalledWith('create_circle', { name: 'Makers', pillar_label: 'Craft', weekly_target_minutes: 3000, my_pillar_id: 'p1' });
  });
  it('join cleans the code; errors are thrown', async () => {
    const ok = fake({ data: 'c1' });
    await joinCircle(ok.client, 'abcd-2345', 'p1');
    expect(ok.rpc).toHaveBeenCalledWith('join_circle', { code: 'ABCD2345', my_pillar_id: 'p1' });
    const bad = fake({ error: { message: 'circle is full' } });
    await expect(joinCircle(bad.client, 'X', 'p1')).rejects.toMatchObject({ message: 'circle is full' });
  });
  it('my circles: an empty answer is an empty list', async () => {
    const { client, rpc } = fake({ data: null });
    await expect(getMyCircles(client, '2026-11-02')).resolves.toEqual([]);
    expect(rpc).toHaveBeenCalledWith('my_circles', { week_start: '2026-11-02' });
  });
});
