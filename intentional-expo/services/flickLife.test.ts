import { describe, expect, it } from 'vitest';
import { flickLines, flickMoodOfDay, greetingFor, lineAt, type FlickDay } from './flickLife';

const day: FlickDay = {
  hour: 10,
  userName: 'Alex',
  minutesToday: 0,
  allDone: false,
  pillarsAtZero: ['Body', 'Craft'],
  nextHabit: { name: 'Gym', time: '18:00' },
  stageName: 'Spark',
  toNextStage: '9h to Flame',
};

describe('Flick\'s mood follows the day (US-097)', () => {
  it('sleepy at night, proud when all is done, worried by the evening with nothing given, calm before, happy once given', () => {
    expect(flickMoodOfDay({ hour: 23, minutesToday: 50, allDone: true })).toBe('sleepy');
    expect(flickMoodOfDay({ hour: 3, minutesToday: 0, allDone: false })).toBe('sleepy');
    expect(flickMoodOfDay({ hour: 14, minutesToday: 60, allDone: true })).toBe('proud');
    expect(flickMoodOfDay({ hour: 19, minutesToday: 0, allDone: false })).toBe('worried');
    expect(flickMoodOfDay({ hour: 9, minutesToday: 0, allDone: false })).toBe('calm');
    expect(flickMoodOfDay({ hour: 9, minutesToday: 25, allDone: false })).toBe('happy');
  });
});

describe('What Flick says (US-097)', () => {
  it('greets by the time of day, with the name', () => {
    expect(greetingFor(8, 'Alex')).toBe('Good morning, Alex!');
    expect(greetingFor(14, ' ')).toBe('Hey!');
    expect(greetingFor(20, 'Alex')).toBe('Good evening, Alex.');
    expect(greetingFor(1, null)).toMatch(/half asleep/);
  });
  it('nothing given yet: the next habit, the first pillar at zero, the stage', () => {
    expect(flickLines(day)).toEqual([
      'Good morning, Alex!',
      'Gym at 18:00. I’ll be ready.',
      'Nothing given yet. Body would love ten minutes.',
      'I’m a Spark. 9h to Flame.',
    ]);
  });
  it('some given: the minutes, then which pillar is still at zero', () => {
    const l = flickLines({ ...day, hour: 15, minutesToday: 85, pillarsAtZero: ['Craft'], nextHabit: { name: 'Read', time: null } });
    expect(l).toContain('1h 25m given today. I can feel it.');
    expect(l).toContain('Read is still waiting for us.');
    expect(l).toContain('Craft hasn’t had a minute yet today.');
  });
  it('all done: glowing; at the last stage: as bright as it gets', () => {
    const l = flickLines({ ...day, allDone: true, minutesToday: 120, nextHabit: null, stageName: 'Sun', toNextStage: null });
    expect(l).toEqual(['Good morning, Alex!', 'Everything done today. I’m glowing!', '2h given today. That’s what makes me grow.', 'I’m a Sun. As bright as I get!']);
  });
  it('at night: no nudge about pillars, a word about sleep', () => {
    const l = flickLines({ ...day, hour: 0 });
    expect(l.some((x) => x.includes('would love ten minutes'))).toBe(false);
    expect(l).toContain('Tomorrow’s a fresh day. Sleep is good for flames too.');
  });
  it('taps cycle through the lines', () => {
    const l = ['a', 'b', 'c'];
    expect([0, 1, 2, 3, 4].map((n) => lineAt(l, n))).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(lineAt([], 3)).toBe('');
  });
});
