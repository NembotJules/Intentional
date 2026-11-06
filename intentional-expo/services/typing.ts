/**
 * US-100 · How Flick's speech bubble types itself out: one letter at a time, with a short beat after
 * commas and a longer one after full stops and question marks, so it reads like someone talking.
 * Pure: `typedLength(text, elapsedMs)` → how many characters are visible after `elapsedMs`.
 */

export const MS_PER_CHAR = 26;
const PAUSE_AFTER: Record<string, number> = { ',': 110, '.': 260, '?': 260, '!': 260, '…': 320, ':': 160 };

/** The time each character becomes visible (ms), cumulative. */
export function charTimes(text: string, msPerChar: number = MS_PER_CHAR): number[] {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += msPerChar;
    out.push(t);
    const ch = text[i]!;
    // A pause only between words, not at the very end.
    if (PAUSE_AFTER[ch] && i < text.length - 1 && text[i + 1] === ' ') t += PAUSE_AFTER[ch]!;
  }
  return out;
}

/** How many characters are shown after `elapsedMs`. */
export function typedLength(text: string, elapsedMs: number, msPerChar: number = MS_PER_CHAR): number {
  if (elapsedMs <= 0) return 0;
  const times = charTimes(text, msPerChar);
  let n = 0;
  while (n < times.length && times[n]! <= elapsedMs) n++;
  return n;
}

/** Total time to type the whole text (ms). */
export function typingDuration(text: string, msPerChar: number = MS_PER_CHAR): number {
  const times = charTimes(text, msPerChar);
  return times.length ? times[times.length - 1]! : 0;
}
