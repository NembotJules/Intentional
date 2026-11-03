import { describe, expect, it, vi } from 'vitest';
import {
  acceptInvite,
  cleanInviteCode,
  createInvite,
  endLink,
  friendlyWitnessError,
  getSummary,
  inviteDeepLink,
  inviteMessage,
  paceLabel,
  prettyCode,
  weekTotal,
} from './witness';
import type { Supa } from './supabase';

const fake = (result: { data?: unknown; error?: { message: string } | null }) => {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { client: { rpc } as unknown as Supa, rpc };
};

describe('witness codes and words (US-090)', () => {
  it('codes: cleaned from what people type or paste', () => {
    expect(cleanInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(cleanInviteCode('Code: ABCD 2345 extra')).toBe('CODEABCD');
    expect(prettyCode('abcd2345')).toBe('ABCD 2345');
    expect(inviteDeepLink('abcd 2345')).toBe('intentional://witness?code=ABCD2345');
  });
  it('the invite: who, what they will see (never tasks), the code, the link', () => {
    const m = inviteMessage({ userName: 'Jules', code: 'ABCD2345', pillars: ['Body', 'Craft'] });
    expect(m).toContain('Jules would like you to be their witness on Intentional, for Body and Craft.');
    expect(m).toContain('Never my tasks or notes.');
    expect(m).toContain('Code: ABCD 2345');
    expect(m).toContain('intentional://witness?code=ABCD2345');
    expect(inviteMessage({ code: 'ABCD2345', pillars: [] })).toContain('I’d like you to be my witness on Intentional.');
  });
  it('pace in plain words, no shame', () => {
    expect(paceLabel('behind')).toBe('Needs a push');
    expect(paceLabel('on_track')).toBe('On track');
    expect(paceLabel('unknown')).toBe('No measure yet');
  });
  it('week total adds the pillars', () => {
    expect(weekTotal({ pillars: [{ minutes: 30 }, { minutes: 45 }] as never })).toBe(75);
  });
  it('errors in plain words', () => {
    expect(friendlyWitnessError({ message: 'you already have a witness' })).toMatch(/already have a witness/);
    expect(friendlyWitnessError({ message: 'invite not found' })).toMatch(/isn’t valid/);
    expect(friendlyWitnessError({ message: 'that is your own invite' })).toMatch(/your own code/);
    expect(friendlyWitnessError({ message: 'not their witness' })).toMatch(/not witnessing/);
  });
});

describe('witness calls (US-090)', () => {
  it('each call goes to its RPC with cleaned arguments', async () => {
    const a = fake({ data: 'ABCD2345' });
    expect(await createInvite(a.client)).toBe('ABCD2345');
    expect(a.rpc).toHaveBeenCalledWith('create_witness_invite');
    const b = fake({ data: 'link-1' });
    expect(await acceptInvite(b.client, 'abcd 2345')).toBe('link-1');
    expect(b.rpc).toHaveBeenCalledWith('accept_witness', { code: 'ABCD2345' });
    const c = fake({});
    await endLink(c.client, 'link-1');
    expect(c.rpc).toHaveBeenCalledWith('end_witness', { link_id: 'link-1' });
    const d = fake({ data: { pillars: [] } });
    await getSummary(d.client, 'owner-1', '2026-10-26');
    expect(d.rpc).toHaveBeenCalledWith('witness_summary', { owner: 'owner-1', week_start: '2026-10-26' });
  });
  it('server errors are thrown', async () => {
    await expect(createInvite(fake({ error: { message: 'you already have a witness' } }).client)).rejects.toMatchObject({ message: 'you already have a witness' });
  });
});
