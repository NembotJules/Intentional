/**
 * US-090 · A witness: one person (with an account) who sees your commitment — your pledge (pillars and goals),
 * Flick's stage, your hours per pillar this week, your goals and their pace. Never task names or notes.
 *
 * Invite by code or link (share sheet) → they accept → they see you in "You witness". Either side can end it.
 * The server only answers through membership-checked RPCs (supabase/migrations/…_witness.sql); the witness sees
 * what your last backup holds (US-089), so inviting backs up first.
 */
import { APP_LINK } from '@/constants/links';
import type { Supa } from '@/services/supabase';
import { listOf } from '@/services/pledge';

export const CODE_LENGTH = 8;

export interface WitnessLink {
  id: string;
  role: 'owner' | 'witness';
  status: 'pending' | 'active';
  invite_code: string | null;
  other_id: string | null;
  other_name: string | null;
  created_at: string;
}

export interface WitnessSummary {
  display_name: string | null;
  flick_stage: number | null;
  week_start: string;
  timezone: string;
  last_backup: string | null;
  pillars: { id: string; name: string; color: string; icon: string; minutes: number }[];
  goals: { title: string; pillar_id: string; deadline: string | null; progress: number | null; pace: 'ahead' | 'on_track' | 'behind' | 'unknown' }[];
}

/** "abcd-2345 ", "ABCD2345" → "ABCD2345" (letters and digits, upper case, max 8). */
export function cleanInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

/** "ABCD 2345": easier to read aloud. */
export function prettyCode(code: string): string {
  const c = cleanInviteCode(code);
  return c.length > 4 ? `${c.slice(0, 4)} ${c.slice(4)}` : c;
}

/** Opens the app straight on the invite (scheme `intentional`). */
export function inviteDeepLink(code: string): string {
  return `intentional://witness?code=${cleanInviteCode(code)}`;
}

export function inviteMessage(opts: { userName?: string | null; code: string; pillars: string[] }): string {
  const who = opts.userName?.trim() ? opts.userName.trim() : 'I';
  const lines = [
    `${who === 'I' ? 'I’d' : `${who} would`} like you to be ${who === 'I' ? 'my' : 'their'} witness on Intentional${opts.pillars.length ? `, for ${listOf(opts.pillars)}` : ''}.`,
    'You’ll see the hours I give each week and how my goals are going. Never my tasks or notes.',
    `Code: ${prettyCode(opts.code)}`,
    `Open it: ${inviteDeepLink(opts.code)}`,
    `No app yet? ${APP_LINK}`,
  ];
  return lines.join('\n');
}

/** Pace in plain words, never shame. */
export function paceLabel(p: WitnessSummary['goals'][number]['pace']): string {
  switch (p) {
    case 'ahead':
      return 'Ahead';
    case 'on_track':
      return 'On track';
    case 'behind':
      return 'Needs a push';
    default:
      return 'No measure yet';
  }
}

export function weekTotal(s: Pick<WitnessSummary, 'pillars'>): number {
  return s.pillars.reduce((n, p) => n + (p.minutes ?? 0), 0);
}

/** Plain words for the RPC errors people can hit. */
export function friendlyWitnessError(e: unknown): string {
  const m = (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)).toLowerCase();
  if (m.includes('already have a witness')) return 'You already have a witness. End it first to invite someone else.';
  if (m.includes('invite not found')) return 'That code isn’t valid any more. Ask for a new one.';
  if (m.includes('your own invite')) return 'That’s your own code. Send it to the person you choose.';
  if (m.includes('not their witness')) return 'You’re not witnessing this person any more.';
  if (m.includes('not signed in')) return 'Sign in first.';
  if (m.includes('fetch') || m.includes('network')) return 'No connection. Try again when you’re online.';
  return 'Something went wrong. Try again in a moment.';
}

export async function createInvite(client: Supa): Promise<string> {
  const { data, error } = await client.rpc('create_witness_invite');
  if (error) throw error;
  return String(data);
}

export async function acceptInvite(client: Supa, code: string): Promise<string> {
  const { data, error } = await client.rpc('accept_witness', { code: cleanInviteCode(code) });
  if (error) throw error;
  return String(data);
}

export async function endLink(client: Supa, linkId: string): Promise<void> {
  const { error } = await client.rpc('end_witness', { link_id: linkId });
  if (error) throw error;
}

export async function getLinks(client: Supa): Promise<WitnessLink[]> {
  const { data, error } = await client.rpc('witness_links');
  if (error) throw error;
  return (data ?? []) as WitnessLink[];
}

export async function getSummary(client: Supa, ownerId: string, weekStart: string): Promise<WitnessSummary> {
  const { data, error } = await client.rpc('witness_summary', { owner: ownerId, week_start: weekStart });
  if (error) throw error;
  return data as unknown as WitnessSummary;
}
