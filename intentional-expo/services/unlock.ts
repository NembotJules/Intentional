/**
 * US-096 · Unlock with intention. A blocked app's screen (targets/shield-config) asks "Do you really need
 * this app now?"; "Yes, I need it" opens Intentional's unlock flow (founder, 2026-11-03):
 *   1. Do you really need this app now?  No → kept blocked. Yes →
 *   2. a reminder of your pillars: what's running now, each pillar's hours today, its goal, the next step,
 *      the habits still waiting today. Keep it blocked, or "I still want to open it" →
 *   3. for how long: 5–30 min (never more) →
 *   4. type "I choose my phone over Body for 10 minutes." → the apps open; iOS blocks them again on its own.
 *
 * Only strict-mode and block-hours shields can be unlocked this way. A focus session's shields are
 * lifted by ending the session (in Focus), so a session can't be skipped with a sentence.
 * Pure: the screen (app/unlock.tsx) gives it what the phone knows.
 */

export const UNLOCK_MINUTES = [5, 10, 15, 20, 30] as const;
export type UnlockMinutes = (typeof UNLOCK_MINUTES)[number];
/** Never longer than this (the native side clamps too). */
export const MAX_UNLOCK_MINUTES = 30;

export type UnlockStep = 'ask' | 'kept' | 'remind' | 'duration' | 'type' | 'done';

/** The flow, one step at a time. */
export function nextStep(step: UnlockStep, answer: 'yes' | 'no'): UnlockStep {
  if (answer === 'no') return step === 'done' ? 'done' : 'kept';
  switch (step) {
    case 'ask':
      return 'remind';
    case 'remind':
      return 'duration';
    case 'duration':
      return 'type';
    case 'type':
      return 'done';
    default:
      return step;
  }
}

export interface ReminderInput {
  pillars: { id: string; name: string; color: string }[];
  minutesToday: Record<string, number>;
  goals: Record<string, string | null>;
  nextTasks: Record<string, string | null>;
  habitsLeft: Record<string, string[]>;
  /** The habit whose window is blocking the apps right now (none for block hours). */
  blocked: { name: string; pillarId: string } | null;
}

export interface ReminderRow {
  id: string;
  name: string;
  color: string;
  minutesToday: number;
  goal: string | null;
  next: string | null;
  habitsLeft: string[];
  isNow: boolean;
}

/** The pillars, the one blocking now first, each with what's waiting. */
export function buildReminder(i: ReminderInput): ReminderRow[] {
  const rows = i.pillars.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    minutesToday: Math.max(0, Math.round(i.minutesToday[p.id] ?? 0)),
    goal: i.goals[p.id] ?? null,
    next: i.nextTasks[p.id] ?? null,
    habitsLeft: i.habitsLeft[p.id] ?? [],
    isNow: i.blocked?.pillarId === p.id,
  }));
  return [...rows.filter((r) => r.isNow), ...rows.filter((r) => !r.isNow)];
}

/** The sentence that should sting a little: what's running now, or what today got so far. */
export function reminderHeadline(rows: ReminderRow[], blocked: ReminderInput['blocked']): string {
  if (blocked) {
    const p = rows.find((r) => r.id === blocked.pillarId);
    return p ? `Right now is ${blocked.name}, for ${p.name}.` : `Right now is ${blocked.name}.`;
  }
  const total = rows.reduce((n, r) => n + r.minutesToday, 0);
  if (total === 0) return 'Your pillars got 0 minutes from you today.';
  return `Today you gave your pillars ${minutesWords(total)}.`;
}

/** "0 min", "45 min", "1 h 20 min". */
export function minutesWords(total: number): string {
  const m = Math.max(0, Math.round(total));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}

/** What the sentence trades the phone against: the habit's pillar, else "my goals". */
export function unlockSentence(pillarName: string | null | undefined, minutes: number): string {
  const what = pillarName?.trim() ? pillarName.trim() : 'my goals';
  return `I choose my phone over ${what} for ${minutes} minutes.`;
}

/** Case, extra spaces, curly quotes and the final full stop don't matter; every word does. */
export function normalizeSentence(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!\s]+$/, '');
}

export function sentenceMatches(typed: string, target: string): boolean {
  return normalizeSentence(typed).length > 0 && normalizeSentence(typed) === normalizeSentence(target);
}

/** How much of the sentence is typed correctly so far (0–1), for the hint under the field. */
export function sentenceProgress(typed: string, target: string): number {
  const t = normalizeSentence(target);
  const y = normalizeSentence(typed);
  if (!t) return 0;
  let i = 0;
  while (i < y.length && i < t.length && y[i] === t[i]) i++;
  return i / t.length;
}

/** True when what's typed so far has gone off the sentence (a wrong letter, not just unfinished). */
export function sentenceOffTrack(typed: string, target: string): boolean {
  const y = normalizeSentence(typed);
  return y.length > 0 && !normalizeSentence(target).startsWith(y);
}

export type UnlockScreenState =
  | { kind: 'preview' } // Expo Go / web / Android: try the flow, nothing is unlocked
  | { kind: 'focus' } // a focus session's shields are on: end the session in Focus
  | { kind: 'unlocked'; until: number } // already open: "Open until 18:05", Block again now
  | { kind: 'not-blocked' } // nothing is blocked right now
  | { kind: 'blocked'; habitId: string | null; until: number | null }; // the sentence

export function unlockScreenState(p: {
  native: boolean;
  focusShieldsOn: boolean;
  unlockUntil: number | null;
  activeBlock: { habitId?: string; until?: number } | null;
  now: number;
}): UnlockScreenState {
  if (!p.native) return { kind: 'preview' };
  if (p.focusShieldsOn) return { kind: 'focus' };
  if (p.unlockUntil && p.unlockUntil > p.now) return { kind: 'unlocked', until: p.unlockUntil };
  if (!p.activeBlock || (p.activeBlock.until && p.activeBlock.until <= p.now)) return { kind: 'not-blocked' };
  return { kind: 'blocked', habitId: p.activeBlock.habitId ?? null, until: p.activeBlock.until ?? null };
}

/** "18:05" in the phone's clock. */
export function clockLabel(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Plain words for a failed unlock. */
export function unlockErrorText(code: string | undefined): string {
  if (code === 'notBlocked') return 'Nothing is blocked right now.';
  if (code === 'unauthorized') return 'Intentional needs Screen Time permission again: Settings → Blocking rules.';
  if (code === 'excessiveActivities') return 'iPhone is tracking too many blocks. Remove a block hour, then try again.';
  return 'It didn’t unlock. Try again in a moment.';
}
