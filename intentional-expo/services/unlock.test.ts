import { describe, expect, it } from 'vitest';
import {
  UNLOCK_MINUTES,
  clockLabel,
  normalizeSentence,
  sentenceMatches,
  sentenceOffTrack,
  sentenceProgress,
  unlockErrorText,
  unlockScreenState,
  unlockSentence,
} from './unlock';

describe('unlock with intention: the sentence (US-096)', () => {
  it('names the pillar and the minutes; "my goals" when there is no habit', () => {
    expect(unlockSentence('Body', 10)).toBe('I choose my phone over Body for 10 minutes.');
    expect(unlockSentence(' ', 5)).toBe('I choose my phone over my goals for 5 minutes.');
    expect(unlockSentence(null, 15)).toBe('I choose my phone over my goals for 15 minutes.');
    expect(UNLOCK_MINUTES).toEqual([5, 10, 15]);
  });
  it('case, spaces, curly quotes and the final full stop don\'t matter', () => {
    const target = unlockSentence('Body', 10);
    expect(sentenceMatches('i choose my phone over body for 10 minutes', target)).toBe(true);
    expect(sentenceMatches('  I  choose my phone over Body for 10 minutes.  ', target)).toBe(true);
    expect(normalizeSentence('It’s ok!')).toBe("it's ok");
  });
  it('every word matters: a different pillar, minutes or a missing word fails', () => {
    const target = unlockSentence('Body', 10);
    expect(sentenceMatches('I choose my phone over Body for 15 minutes.', target)).toBe(false);
    expect(sentenceMatches('I choose my phone over Craft for 10 minutes.', target)).toBe(false);
    expect(sentenceMatches('I choose phone over Body for 10 minutes.', target)).toBe(false);
    expect(sentenceMatches('', target)).toBe(false);
    expect(sentenceMatches('.', target)).toBe(false);
  });
  it('progress and off-track hints while typing', () => {
    const target = unlockSentence('Body', 5);
    expect(sentenceProgress('', target)).toBe(0);
    expect(sentenceProgress('I choose', target)).toBeGreaterThan(0.1);
    expect(sentenceProgress(target, target)).toBe(1);
    expect(sentenceOffTrack('I choose', target)).toBe(false);
    expect(sentenceOffTrack('I chose', target)).toBe(true);
    expect(sentenceOffTrack('', target)).toBe(false);
  });
});

describe('unlock with intention: which screen (US-096)', () => {
  const now = Date.parse('2026-11-03T17:00:00');
  const base = { native: true, focusShieldsOn: false, unlockUntil: null, activeBlock: null, now };
  it('Expo Go / web: a preview, nothing unlocks', () => {
    expect(unlockScreenState({ ...base, native: false, activeBlock: { habitId: 'h1' } })).toEqual({ kind: 'preview' });
  });
  it('a focus session can\'t be unlocked with a sentence', () => {
    expect(unlockScreenState({ ...base, focusShieldsOn: true, activeBlock: { habitId: 'h1' } })).toEqual({ kind: 'focus' });
  });
  it('already unlocked: until when; an unlock that ended counts as none', () => {
    expect(unlockScreenState({ ...base, unlockUntil: now + 60000, activeBlock: { habitId: 'h1' } })).toEqual({ kind: 'unlocked', until: now + 60000 });
    expect(unlockScreenState({ ...base, unlockUntil: now - 1, activeBlock: { habitId: 'h1' } }).kind).toBe('blocked');
  });
  it('nothing blocked, or a window that already ended', () => {
    expect(unlockScreenState(base)).toEqual({ kind: 'not-blocked' });
    expect(unlockScreenState({ ...base, activeBlock: { habitId: 'h1', until: now - 1000 } })).toEqual({ kind: 'not-blocked' });
  });
  it('blocked: the habit (or none, for block hours) and when the window ends', () => {
    expect(unlockScreenState({ ...base, activeBlock: { habitId: 'h1', until: now + 3600000 } })).toEqual({ kind: 'blocked', habitId: 'h1', until: now + 3600000 });
    expect(unlockScreenState({ ...base, activeBlock: {} })).toEqual({ kind: 'blocked', habitId: null, until: null });
  });
  it('words: the clock and errors', () => {
    expect(clockLabel(Date.parse('2026-11-03T18:05:00'))).toBe('18:05');
    expect(unlockErrorText('unauthorized')).toMatch(/Screen Time/);
    expect(unlockErrorText(undefined)).toMatch(/didn’t unlock/);
  });
});

describe('unlock with intention: the block screen\'s notification (US-096)', () => {
  it('a tap on "Unlock with intention" opens the unlock screen, whatever the button', async () => {
    const { intentFromResponse } = await import('./habitSchedule');
    const now = new Date();
    expect(intentFromResponse({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', data: { kind: 'unlock' }, now })).toEqual({ type: 'open-unlock' });
    expect(intentFromResponse({ actionIdentifier: 'x', data: {}, now })).toEqual({ type: 'open-today' });
  });
});
