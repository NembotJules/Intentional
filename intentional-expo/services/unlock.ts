/**
 * US-096 · Unlock with intention. A blocked app's screen (targets/shield-config) offers "Unlock with
 * intention"; Intentional then asks for one typed sentence — "I choose my phone over Body for 10 minutes." —
 * before the apps open for 5, 10 or 15 minutes. iOS blocks them again on its own when the time is up.
 *
 * Only strict-mode and block-hours shields can be unlocked this way. A focus session's shields are
 * lifted by ending the session (in Focus), so a session can't be skipped with a sentence.
 * Pure: the screen (app/unlock.tsx) gives it what the phone knows.
 */

export const UNLOCK_MINUTES = [5, 10, 15] as const;
export type UnlockMinutes = (typeof UNLOCK_MINUTES)[number];
export const DEFAULT_UNLOCK_MINUTES: UnlockMinutes = 5;

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
