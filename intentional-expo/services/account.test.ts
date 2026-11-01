import { describe, expect, it, vi } from 'vitest';
import {
  cleanCode,
  deleteAccount,
  displayNameFrom,
  ensureProfile,
  friendlyAuthError,
  isValidCode,
  isValidEmail,
  normalizeEmail,
  sendCode,
  signOut,
  updateDisplayName,
  verifyCode,
} from './account';
import type { Supa } from './supabase';

/** A fake Supabase client: auth calls + a `profiles` table in memory. */
function fake(opts: { profiles?: { id: string; display_name: string; flick_stage: number }[]; authError?: string; rpcError?: string } = {}) {
  const profiles = [...(opts.profiles ?? [])];
  const calls: string[] = [];
  const err = opts.authError ? { message: opts.authError } : null;
  const table = () => {
    let filterId: string | null = null;
    let patch: Record<string, unknown> | null = null;
    const q = {
      select: () => q,
      eq: (_c: string, v: string) => {
        filterId = v;
        if (patch) {
          for (const p of profiles) if (p.id === filterId) Object.assign(p, patch);
          calls.push(`update ${JSON.stringify(patch)}`);
          return Promise.resolve({ error: null });
        }
        return q;
      },
      maybeSingle: () => Promise.resolve({ data: profiles.find((p) => p.id === filterId) ?? null, error: null }),
      insert: (row: { id: string; display_name: string; flick_stage: number }) => {
        profiles.push(row);
        calls.push(`insert ${row.display_name}`);
        return Promise.resolve({ error: null });
      },
      update: (p: Record<string, unknown>) => {
        patch = p;
        return q;
      },
    };
    return q;
  };
  const client = {
    auth: {
      signInWithOtp: vi.fn(async () => ({ error: err })),
      verifyOtp: vi.fn(async () => (err ? { data: { session: null }, error: err } : { data: { session: { access_token: 't' } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => table()),
    rpc: vi.fn(async () => ({ error: opts.rpcError ? { message: opts.rpcError } : null })),
  };
  return { client: client as unknown as Supa, raw: client, profiles, calls };
}

describe('account input (US-088)', () => {
  it('emails: trimmed, lower-case, basic shape', () => {
    expect(normalizeEmail('  Jules@Mail.COM ')).toBe('jules@mail.com');
    expect(isValidEmail('jules@mail.com')).toBe(true);
    expect(isValidEmail('jules@mail')).toBe(false);
    expect(isValidEmail('jules mail.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
  it('codes: digits only from a paste, 8 digits valid, capped at 10', () => {
    expect(cleanCode('Code: 1234 5678')).toBe('12345678');
    expect(isValidCode('12345678')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(cleanCode('123456789012')).toBe('1234567890');
  });
  it('display name: onboarding name, else the email name, never empty, max 30', () => {
    expect(displayNameFrom('  Jules ', 'x@y.z')).toBe('Jules');
    expect(displayNameFrom('', 'sam.k@mail.com')).toBe('sam.k');
    expect(displayNameFrom(null, null)).toBe('Me');
    expect(displayNameFrom('A'.repeat(40))).toHaveLength(30);
  });
  it('errors in plain words', () => {
    expect(friendlyAuthError({ message: 'Token has expired or is invalid' })).toMatch(/code didn’t work/);
    expect(friendlyAuthError(new Error('For security purposes, you can only request this after 39 seconds.'))).toMatch(/Too many tries/);
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toMatch(/No connection/);
    expect(friendlyAuthError('weird')).toMatch(/Something went wrong/);
  });
});

describe('account flows (US-088)', () => {
  it('sendCode asks for a code (creating the account if new), with the email normalized', async () => {
    const f = fake();
    await sendCode(f.client, ' Jules@Mail.com ');
    expect(f.raw.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'jules@mail.com', options: { shouldCreateUser: true } });
  });
  it('sendCode / verifyCode throw the server error', async () => {
    const f = fake({ authError: 'Token has expired or is invalid' });
    await expect(sendCode(f.client, 'a@b.co')).rejects.toMatchObject({ message: 'Token has expired or is invalid' });
    await expect(verifyCode(f.client, 'a@b.co', '12345678')).rejects.toBeTruthy();
  });
  it('verifyCode sends the cleaned code as an email OTP', async () => {
    const f = fake();
    const s = await verifyCode(f.client, 'a@b.co', '1234 5678');
    expect(s).toEqual({ access_token: 't' });
    expect(f.raw.auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.co', token: '12345678', type: 'email' });
  });
  it('ensureProfile: first sign-in creates it from the onboarding name', async () => {
    const f = fake();
    await ensureProfile(f.client, { id: 'u1', email: 'j@x.co' }, 'Jules', 2, 'Europe/Paris');
    expect(f.profiles).toEqual([{ id: 'u1', display_name: 'Jules', flick_stage: 2, timezone: 'Europe/Paris' }]);
  });
  it('ensureProfile: later sign-ins keep the chosen name, refresh the stage', async () => {
    const f = fake({ profiles: [{ id: 'u1', display_name: 'J.', flick_stage: 1 }] });
    await ensureProfile(f.client, { id: 'u1', email: 'j@x.co' }, 'Jules', 9, 'Africa/Douala');
    expect(f.profiles).toEqual([{ id: 'u1', display_name: 'J.', flick_stage: 5, timezone: 'Africa/Douala' }]);
    expect(f.calls.some((c) => c.startsWith('insert'))).toBe(false);
  });
  it('updateDisplayName trims and refuses empty', async () => {
    const f = fake({ profiles: [{ id: 'u1', display_name: 'J.', flick_stage: 1 }] });
    expect(await updateDisplayName(f.client, 'u1', '  Jules  ')).toBe('Jules');
    expect(f.profiles[0].display_name).toBe('Jules');
    await expect(updateDisplayName(f.client, 'u1', '   ')).rejects.toThrow('A name is needed.');
  });
  it('signOut is local to this phone', async () => {
    const f = fake();
    await signOut(f.client);
    expect(f.raw.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('deleteAccount calls delete_my_account then signs out; a failure stops before signing out', async () => {
    const f = fake();
    await deleteAccount(f.client);
    expect(f.raw.rpc).toHaveBeenCalledWith('delete_my_account');
    expect(f.raw.auth.signOut).toHaveBeenCalledTimes(1);
    const g = fake({ rpcError: 'not signed in' });
    await expect(deleteAccount(g.client)).rejects.toMatchObject({ message: 'not signed in' });
    expect(g.raw.auth.signOut).not.toHaveBeenCalled();
  });
});
