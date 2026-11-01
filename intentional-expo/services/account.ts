/**
 * US-088 · Accounts (optional). Email one-time code (8 digits on this project) on every platform; Sign in with Apple on
 * iOS once the Apple provider is configured (`APPLE_SIGN_IN_ENABLED`).
 *
 * Signing in creates the person's `profiles` row (display name from onboarding). Signing out and deleting the account
 * never touch local data: the phone stays the source of truth (local-first).
 * Every function takes the client, so the logic is unit-tested with a fake one.
 */
import type { Session, User } from '@supabase/supabase-js';
import type { Supa } from '@/services/supabase';

/** Flip on once Supabase → Auth → Apple has the Team ID, Key ID and .p8 key (founder's Apple Developer account). */
export const APPLE_SIGN_IN_ENABLED = false;

/** This project's email codes are 8 digits; accept 6–10 so a project change doesn't break sign-in. */
export const CODE_MIN = 6;
export const CODE_MAX = 10;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmail(raw));
}

/** Digits only, capped: pasting "1234 5678" or "Code: 12345678" works. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_MAX);
}

export function isValidCode(code: string): boolean {
  return code.length >= CODE_MIN && code.length <= CODE_MAX && /^\d+$/.test(code);
}

/** The profile's display name: the onboarding name, trimmed to the 1–30 the table allows. */
export function displayNameFrom(userName: string | null | undefined, email?: string | null): string {
  const n = (userName ?? '').trim().slice(0, 30);
  if (n) return n;
  const local = (email ?? '').split('@')[0]?.trim().slice(0, 30);
  return local || 'Me';
}

/** Plain words for the errors people hit; never a raw server message as the only text. */
export function friendlyAuthError(e: unknown): string {
  const msg = (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)).toLowerCase();
  if (msg.includes('expired') || msg.includes('invalid') || msg.includes('otp')) return 'That code didn’t work. Check it, or send a new one.';
  if (msg.includes('rate') || msg.includes('too many') || msg.includes('seconds')) return 'Too many tries. Wait a minute, then send a new code.';
  if (msg.includes('network') || msg.includes('fetch')) return 'No connection. Your data is safe on this phone; try again when you’re online.';
  return 'Something went wrong. Try again in a moment.';
}

export async function sendCode(client: Supa, email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email: normalizeEmail(email), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(client: Supa, email: string, code: string): Promise<Session> {
  const { data, error } = await client.auth.verifyOtp({ email: normalizeEmail(email), token: cleanCode(code), type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('invalid: no session');
  return data.session;
}

/** The phone's time zone (IANA), so a witness's "this week" is the owner's week (US-090). */
export function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Creates the profile on first sign-in; later sign-ins keep the name the person may have changed. */
export async function ensureProfile(
  client: Supa,
  user: Pick<User, 'id' | 'email'>,
  userName: string | null,
  flickStage: number,
  timezone: string | null = deviceTimeZone()
): Promise<void> {
  const { data, error } = await client.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (data) {
    const { error: e2 } = await client.from('profiles').update({ flick_stage: Math.max(0, Math.min(5, flickStage)), timezone }).eq('id', user.id);
    if (e2) throw e2;
    return;
  }
  const { error: e3 } = await client
    .from('profiles')
    .insert({ id: user.id, display_name: displayNameFrom(userName, user.email), flick_stage: Math.max(0, Math.min(5, flickStage)), timezone });
  if (e3) throw e3;
}

export async function updateDisplayName(client: Supa, userId: string, name: string): Promise<string> {
  const display = name.trim().slice(0, 30);
  if (!display) throw new Error('A name is needed.');
  const { error } = await client.from('profiles').update({ display_name: display }).eq('id', userId);
  if (error) throw error;
  return display;
}

export async function getProfile(client: Supa, userId: string): Promise<{ display_name: string } | null> {
  const { data, error } = await client.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

/** Sign out on this phone only; local data stays. */
export async function signOut(client: Supa): Promise<void> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

/** Deletes the server data and the account (`delete_my_account`), then signs out. Local data stays. */
export async function deleteAccount(client: Supa): Promise<void> {
  const { error } = await client.rpc('delete_my_account');
  if (error) throw error;
  await client.auth.signOut({ scope: 'local' });
}
