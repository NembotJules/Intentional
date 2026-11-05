import { describe, expect, it } from 'vitest';
import {
  MAX_UNLOCK_MINUTES,
  UNLOCK_MINUTES,
  buildReminder,
  minutesWords,
  nextStep,
  reminderHeadline,
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
    expect(UNLOCK_MINUTES).toEqual([5, 10, 15, 20, 30]);
    expect(Math.max(...UNLOCK_MINUTES)).toBe(MAX_UNLOCK_MINUTES);
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

describe('unlock with intention: the steps (US-096, founder\'s flow)', () => {
  it('ask → remind → duration → type → done; "no" at any step keeps it blocked', () => {
    expect(nextStep('ask', 'yes')).toBe('remind');
    expect(nextStep('remind', 'yes')).toBe('duration');
    expect(nextStep('duration', 'yes')).toBe('type');
    expect(nextStep('type', 'yes')).toBe('done');
    for (const s of ['ask', 'remind', 'duration', 'type'] as const) expect(nextStep(s, 'no')).toBe('kept');
    expect(nextStep('done', 'no')).toBe('done');
    expect(nextStep('kept', 'yes')).toBe('kept');
  });
});

describe('unlock with intention: the pillar reminder (US-096)', () => {
  const input = {
    pillars: [
      { id: 'p1', name: 'Craft', color: '#A66A00' },
      { id: 'p2', name: 'Body', color: '#D65A31' },
    ],
    minutesToday: { p1: 25.4 },
    goals: { p1: 'Ship the app', p2: 'Half marathon' },
    nextTasks: { p1: 'Write the onboarding', p2: null },
    habitsLeft: { p2: ['Gym (18:00)'] },
    blocked: { name: 'Gym', pillarId: 'p2' },
  };
  it('the pillar blocking now comes first, with its goal, next step, habits left and minutes today', () => {
    const rows = buildReminder(input);
    expect(rows.map((r) => r.name)).toEqual(['Body', 'Craft']);
    expect(rows[0]).toMatchObject({ isNow: true, minutesToday: 0, goal: 'Half marathon', next: null, habitsLeft: ['Gym (18:00)'] });
    expect(rows[1]).toMatchObject({ isNow: false, minutesToday: 25, goal: 'Ship the app', next: 'Write the onboarding', habitsLeft: [] });
  });
  it('the headline: what is running now, else what today got', () => {
    expect(reminderHeadline(buildReminder(input), input.blocked)).toBe('Right now is Gym, for Body.');
    const free = { ...input, blocked: null };
    expect(reminderHeadline(buildReminder(free), null)).toBe('Today you gave your pillars 25 min.');
    expect(reminderHeadline(buildReminder({ ...free, minutesToday: {} }), null)).toBe('Your pillars got 0 minutes from you today.');
  });
  it('minutes in words', () => {
    expect(minutesWords(0)).toBe('0 min');
    expect(minutesWords(45)).toBe('45 min');
    expect(minutesWords(80)).toBe('1 h 20 min');
    expect(minutesWords(120)).toBe('2 h');
  });
});
