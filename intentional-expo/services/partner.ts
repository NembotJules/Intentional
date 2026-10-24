/**
 * One accountability partner (local-first, no account needed).
 *
 * The person picks one human. Every Sunday the app has their week ready (card + text) and they send it,
 * by the share sheet (WhatsApp, iMessage, …) or straight to the partner's number by SMS. The partner
 * doesn't need the app. What the app keeps: who the partner is and which weeks were sent, so it can say
 * "Sent 5 weeks in a row" and remind gently on Sunday and Monday when this week's report is still unsent.
 *
 * Upgrade path (US-090, Supabase): the same Partner record gets a witness id and the partner sees the
 * week in their own app. Nothing here needs to change for that; sending stays the fallback.
 */
import { getSetting, setSetting } from '@/db';
import { localDayKey, localDayStart, shiftDayKey } from '@/utils/dates';
import { weekStartOf } from '@/services/weekSummary';

export interface Partner {
  name: string;
  /** Digits and an optional leading +, or null (share sheet only). */
  phone: string | null;
  /** When they were chosen (ISO). */
  since: string;
  /** When the invite message was sent (ISO), if it was. */
  invitedAt: string | null;
}

const PARTNER_KEY = 'partner';
const SENT_KEY = 'partner_sent_weeks';
const PROMPT_DISMISSED_KEY = 'partner_prompt_dismissed';

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Keeps a phone number usable in an sms: link: digits, one leading +. Returns null when too short. */
export function cleanPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return null;
  return (plus ? '+' : '') + digits;
}

/** sms: link with a prefilled body (iOS uses "&body=", Android "?body="). */
export function smsUrl(phone: string, body: string, os: 'ios' | 'android' | 'web' = 'ios'): string {
  return `sms:${phone}${os === 'ios' ? '&' : '?'}body=${encodeURIComponent(body)}`;
}

/**
 * The week the person reports on `now`: on Sunday it's this week (nearly over), Monday → Saturday it's
 * last week. The report is "due" on Sunday and Monday while unsent; after that it quietly lapses.
 */
export function reportWeek(now: Date = new Date()): { weekStart: string; due: boolean } {
  const today = localDayKey(now);
  const dow = now.getDay();
  const thisWeek = weekStartOf(today);
  if (dow === 0) return { weekStart: thisWeek, due: true };
  return { weekStart: shiftDayKey(thisWeek, -7), due: dow === 1 };
}

/** Consecutive weeks sent, counting back from the latest week that could have been sent by `now`. */
export function sentStreak(sentWeeks: string[], now: Date = new Date()): number {
  const sent = new Set(sentWeeks);
  const { weekStart } = reportWeek(now);
  // This week's report not sent yet (still due) doesn't break the run.
  let week = sent.has(weekStart) ? weekStart : shiftDayKey(weekStart, -7);
  let n = 0;
  for (let guard = 0; guard < 520 && sent.has(week); guard++, week = shiftDayKey(week, -7)) n++;
  return n;
}

/** The invite: who you are, what you're building, what you'll send, what you ask of them. */
export function inviteMessage(opts: { userName?: string; partnerName: string; pillars: string[]; goals?: string[] }): string {
  const pillarList = opts.pillars.length ? listJoin(opts.pillars) : 'what matters to me';
  const lines = [
    `Hey ${opts.partnerName}! I'm giving my hours to ${pillarList}${opts.goals && opts.goals.length ? ` (${listJoin(opts.goals)})` : ''}.`,
    '',
    `I picked you as my accountability partner. Every Sunday I'll send you my week: the hours I actually gave, the habits I kept and how my goals are going.`,
    '',
    `You don't need to do anything. Just read it, and if I go quiet or my week looks empty, ask me why.`,
  ];
  if (opts.userName) lines.push('', `— ${opts.userName}`);
  return lines.join('\n');
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Since Oct 4" */
export function sinceLabel(iso: string): string {
  return `Since ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** "Sunday, Oct 26" for the next report day. */
export function nextReportLabel(now: Date = new Date()): string {
  const today = localDayKey(now);
  const dow = now.getDay();
  const sunday = dow === 0 ? today : shiftDayKey(today, 7 - dow);
  if (sunday === today) return 'Today';
  return localDayStart(sunday).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ─── Stored state (settings) ─────────────────────────────────────────────────

export function getPartner(): Partner | null {
  try {
    const raw = getSetting(PARTNER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Partner>;
    if (!p || typeof p.name !== 'string' || !p.name.trim()) return null;
    return { name: p.name.trim(), phone: cleanPhone(p.phone ?? null), since: p.since ?? new Date().toISOString(), invitedAt: p.invitedAt ?? null };
  } catch {
    return null;
  }
}

export function savePartner(input: { name: string; phone?: string | null }): Partner {
  const name = input.name.trim().slice(0, 30);
  if (!name) throw new Error('Your partner needs a name');
  const current = getPartner();
  const partner: Partner = {
    name,
    phone: cleanPhone(input.phone ?? null),
    since: current?.since ?? new Date().toISOString(),
    invitedAt: current && current.name === name ? current.invitedAt : null,
  };
  setSetting(PARTNER_KEY, JSON.stringify(partner));
  return partner;
}

export function markInvited(): void {
  const p = getPartner();
  if (!p) return;
  setSetting(PARTNER_KEY, JSON.stringify({ ...p, invitedAt: new Date().toISOString() }));
}

/** Ends the partnership. The sent history is kept (it's the person's own record). */
export function removePartner(): void {
  setSetting(PARTNER_KEY, '');
}

export function getSentWeeks(): string[] {
  try {
    const v = JSON.parse(getSetting(SENT_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markWeekSent(weekStart: string): void {
  const weeks = new Set(getSentWeeks());
  weeks.add(weekStart);
  setSetting(SENT_KEY, JSON.stringify([...weeks].sort()));
}

export function isWeekSent(weekStart: string): boolean {
  return getSentWeeks().includes(weekStart);
}

/** Today shows "Who will you send your week to?" until it's answered or put off (for 14 days). */
export function isPartnerPromptSnoozed(now: Date = new Date()): boolean {
  const raw = getSetting(PROMPT_DISMISSED_KEY);
  if (!raw) return false;
  const t = Date.parse(raw);
  return Number.isFinite(t) && now.getTime() - t < 14 * 864e5;
}

export function snoozePartnerPrompt(): void {
  setSetting(PROMPT_DISMISSED_KEY, new Date().toISOString());
}
