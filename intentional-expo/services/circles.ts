/**
 * US-091 · Circles: a small private group (max 8) around a shared pillar label ("Craft"). Each member maps one of
 * their own pillars; the circle sees everyone's hours this week on that pillar, the collective total against the
 * weekly target, and Flick stages. Ranking is off by default (the owner can turn on a weekly ranking, reset Monday).
 *
 * The server answers only through membership-checked RPCs (supabase/migrations/…_circles.sql); hours come from the
 * backup (US-089), so creating or joining backs up first, and they follow the honest-numbers rules (60 s–4 h a
 * session, overlaps once, ≤ 16 h a day).
 */
import { APP_LINK } from '@/constants/links';
import type { Supa } from '@/services/supabase';
import { cleanInviteCode, prettyCode } from '@/services/witness';

export { cleanInviteCode, prettyCode };

export const MAX_MEMBERS = 8;
export const NAME_MAX = 40;
export const LABEL_MAX = 30;
export const TARGET_HOURS_MIN = 1;
export const TARGET_HOURS_MAX = 1000;

export interface CircleSummary {
  id: string;
  name: string;
  pillar_label: string;
  weekly_target_minutes: number;
  ranking_enabled: boolean;
  my_role: 'owner' | 'member';
  member_count: number;
  total_minutes: number;
}

export interface CircleMember {
  user_id: string;
  display_name: string | null;
  flick_stage: number | null;
  role: 'owner' | 'member';
  minutes: number;
  rank: number | null;
  is_me: boolean;
  /** Only filled for you. */
  pillar_id: string | null;
}

export interface CircleWeek extends Omit<CircleSummary, 'member_count'> {
  invite_code: string;
  week_start: string;
  members: CircleMember[];
}

/** "45 min", "1.5 h", "42 h": short enough for "42 h of 50 h". */
export function hoursLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes || 0));
  if (m === 0) return '0 h';
  if (m < 60) return `${m} min`;
  const h = m / 60;
  if (h < 10) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h)} h`;
}

/** "42 h of 50 h to Craft this week". */
export function collectiveLabel(c: Pick<CircleSummary, 'total_minutes' | 'weekly_target_minutes' | 'pillar_label'>): string {
  return `${hoursLabel(c.total_minutes)} of ${hoursLabel(c.weekly_target_minutes)} to ${c.pillar_label} this week`;
}

export function collectiveProgress(c: Pick<CircleSummary, 'total_minutes' | 'weekly_target_minutes'>): number {
  if (!c.weekly_target_minutes) return 0;
  return Math.max(0, Math.min(1, c.total_minutes / c.weekly_target_minutes));
}

/** The member's line: "#1 · 6 h" with ranking on, "6 h" without. */
export function memberHours(m: Pick<CircleMember, 'minutes' | 'rank'>, rankingOn: boolean): string {
  return rankingOn && m.rank ? `#${m.rank} · ${hoursLabel(m.minutes)}` : hoursLabel(m.minutes);
}

/** Your pillar that best fits the circle's label: same name, else one containing it, else the first. */
export function suggestPillar<P extends { id: string; name: string }>(label: string, pillars: P[]): P | null {
  const l = label.trim().toLowerCase();
  if (!pillars.length) return null;
  if (!l) return pillars[0]!;
  return pillars.find((p) => p.name.trim().toLowerCase() === l) ?? pillars.find((p) => p.name.toLowerCase().includes(l) || l.includes(p.name.toLowerCase())) ?? pillars[0]!;
}

export interface CircleForm {
  name: string;
  label: string;
  targetHours: string;
  pillarId: string | null;
}

/** First problem with the create form, in plain words; null when it's good to go. */
export function circleFormError(f: CircleForm): string | null {
  if (!f.name.trim()) return 'Give the circle a name.';
  if (f.name.trim().length > NAME_MAX) return `A name of ${NAME_MAX} characters at most.`;
  if (!f.label.trim()) return 'Which pillar do you share? For example Craft.';
  if (f.label.trim().length > LABEL_MAX) return `A pillar of ${LABEL_MAX} characters at most.`;
  const h = Number(f.targetHours.replace(',', '.'));
  if (!Number.isFinite(h) || h < TARGET_HOURS_MIN || h > TARGET_HOURS_MAX) return `A weekly target between ${TARGET_HOURS_MIN} and ${TARGET_HOURS_MAX} hours.`;
  if (!f.pillarId) return 'Pick which of your pillars counts.';
  return null;
}

export function targetMinutes(targetHours: string): number {
  return Math.round(Number(targetHours.replace(',', '.')) * 60);
}

/** Opens the app straight on the join screen (scheme `intentional`). */
export function circleDeepLink(code: string): string {
  return `intentional://circles?code=${cleanInviteCode(code)}`;
}

export function circleInviteMessage(opts: { userName?: string | null; code: string; name: string; label: string; targetMinutes: number }): string {
  const who = opts.userName?.trim() || 'I';
  return [
    `${who === 'I' ? 'Join my circle' : `${who} invites you to their circle`} “${opts.name}” on Intentional: ${hoursLabel(opts.targetMinutes)} a week to ${opts.label}, together.`,
    'The circle sees the hours you give your pillar each week. Never your tasks or notes.',
    `Code: ${prettyCode(opts.code)}`,
    `Open it: ${circleDeepLink(opts.code)}`,
    `No app yet? ${APP_LINK}`,
  ].join('\n');
}

export function friendlyCircleError(e: unknown): string {
  const m = (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)).toLowerCase();
  if (m.includes('circle is full')) return `That circle is full (${MAX_MEMBERS} people).`;
  if (m.includes('circle not found')) return 'That code isn’t valid any more. Ask for a new one.';
  if (m.includes('pillar not found')) return 'That pillar isn’t backed up yet. Try again in a moment.';
  if (m.includes('too many circles')) return 'You’re in 10 circles already. Leave one first.';
  if (m.includes('only the owner')) return 'Only the circle’s owner can do that.';
  if (m.includes('not a member')) return 'You’re not in this circle any more.';
  if (m.includes('not signed in')) return 'Sign in first.';
  if (m.includes('fetch') || m.includes('network')) return 'No connection. Try again when you’re online.';
  return 'Something went wrong. Try again in a moment.';
}

const call = async <T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> => {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
};

export const createCircle = (client: Supa, f: { name: string; label: string; targetMinutes: number; pillarId: string }) =>
  call<{ id: string; invite_code: string }>(
    client.rpc('create_circle', { name: f.name.trim(), pillar_label: f.label.trim(), weekly_target_minutes: f.targetMinutes, my_pillar_id: f.pillarId })
  );
export const joinCircle = (client: Supa, code: string, pillarId: string) =>
  call<string>(client.rpc('join_circle', { code: cleanInviteCode(code), my_pillar_id: pillarId }));
export const getMyCircles = async (client: Supa, weekStart: string) =>
  ((await call<CircleSummary[] | null>(client.rpc('my_circles', { week_start: weekStart }))) ?? []);
export const getCircleWeek = (client: Supa, circleId: string, weekStart: string) =>
  call<CircleWeek>(client.rpc('circle_week', { circle_id: circleId, week_start: weekStart }));
export const setRanking = (client: Supa, circleId: string, enabled: boolean) =>
  call<void>(client.rpc('set_circle_ranking', { circle_id: circleId, enabled }));
export const removeMember = (client: Supa, circleId: string, memberId: string) =>
  call<void>(client.rpc('remove_circle_member', { circle_id: circleId, member_id: memberId }));
export const leaveCircle = (client: Supa, circleId: string) => call<void>(client.rpc('leave_circle', { circle_id: circleId }));
export const deleteCircle = (client: Supa, circleId: string) => call<void>(client.rpc('delete_circle', { circle_id: circleId }));
