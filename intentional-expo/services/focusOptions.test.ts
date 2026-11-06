import { describe, expect, it, vi } from 'vitest';

// focusOptions imports the database layer for loadFocusOptions; the pure builder doesn't need it.
vi.mock('@/db/api', () => ({}));
vi.mock('@/utils/goalColors', () => ({ getGoalColor: () => '#000000' }));

const { buildFocusOptions } = await import('./focusOptions');
const { focusStartHref } = await import('./focusSheet');

const pillars = [
  { id: 'p1', name: 'Body', color: '#D65A31', icon: 'dumbbell' },
  { id: 'p2', name: 'Craft', color: '#A66A00', icon: 'hammer' },
];

describe('the Start focusing sheet: options and suggestion (US-099)', () => {
  it('timed habits, then next steps, then free time per pillar; check-off habits are not sessions', () => {
    const { options, suggested } = buildFocusOptions({
      pillars,
      habits: [
        { id: 'run', name: 'Run', pillarId: 'p1', time: '18:00', type: 'session', minutes: 30 },
        { id: 'stretch', name: 'Stretch', pillarId: 'p1', time: null, type: 'habit', minutes: 10 },
      ],
      steps: [{ taskId: 't1', title: 'Write chapter 2', pillarId: 'p2', goalTitle: 'Finish the book', minutes: 45 }],
      nowMinutes: 17 * 60 + 30,
    });
    expect(options.map((o) => o.key)).toEqual(['habit:run', 'step:t1', 'free:p1', 'free:p2']);
    expect(options[0]).toMatchObject({ title: 'Run', subtitle: 'Body · 18:00 · 30 min', minutes: 30, actionId: 'run' });
    expect(options[1]).toMatchObject({ subtitle: 'Next step · Finish the book', minutes: 45, taskId: 't1' });
    expect(options[2]).toMatchObject({ title: 'Free time for Body', minutes: 25 });
    expect(suggested?.key).toBe('habit:run');
  });
  it('no habit due: the next step is suggested; nothing at all: free time on the first pillar', () => {
    expect(buildFocusOptions({ pillars, habits: [], steps: [{ taskId: 't1', title: 'X', pillarId: 'p2', goalTitle: 'G', minutes: 5 }], nowMinutes: 600 }).suggested).toMatchObject({ key: 'step:t1', minutes: 15 });
    expect(buildFocusOptions({ pillars, habits: [], steps: [], nowMinutes: 600 }).suggested?.key).toBe('free:p1');
    expect(buildFocusOptions({ pillars: [], habits: [], steps: [], nowMinutes: 600 }).suggested).toBeNull();
  });
});

describe('the sheet\'s Start goes to the running-session screen (US-099)', () => {
  it('habit, task or free time, with minutes, start and block', () => {
    expect(focusStartHref({ pillarId: 'p1', actionId: 'run', minutes: 30, block: true, now: 5 })).toBe('/(tabs)/focus?goalId=p1&actionId=run&minutes=30&start=1&block=1&ts=5');
    expect(focusStartHref({ pillarId: 'p2', taskId: 't 1', minutes: 45.4, block: false, now: 5 })).toBe('/(tabs)/focus?goalId=p2&taskId=t%201&minutes=45&start=1&block=0&ts=5');
    expect(focusStartHref({ pillarId: 'p1', minutes: 0, block: true, now: 5 })).toBe('/(tabs)/focus?goalId=p1&minutes=1&start=1&block=1&ts=5');
  });
});
