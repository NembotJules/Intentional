import { describe, expect, it } from 'vitest';
import { listOf, pledgeShareText } from './pledge';

const d = (offset: number) => {
  const x = new Date();
  x.setDate(x.getDate() + offset);
  x.setHours(0, 0, 0, 0);
  return x;
};
const short = (x: Date) => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

describe('pledge text (US-085)', () => {
  it('lists names the way people say them', () => {
    expect(listOf([])).toBe('');
    expect(listOf(['Body'])).toBe('Body');
    expect(listOf(['Body', 'Mind'])).toBe('Body and Mind');
    expect(listOf(['Body', 'Mind', 'Craft'])).toBe('Body, Mind and Craft');
  });

  it('names every goal with its date, stays short and ends on the link', () => {
    const due = d(90);
    const text = pledgeShareText({
      firstName: 'Clinton',
      signedOn: new Date(),
      pillars: [
        { name: 'Body', color: '#D65A31' },
        { name: 'Mind', color: '#4C6FFF' },
      ],
      goals: [
        { title: 'Bench press 100kg', deadline: due, color: '#D65A31' },
        { title: 'Read 12 books', deadline: due, color: '#4C6FFF' },
      ],
    });
    expect(text).toBe(
      [
        'I just signed my pledge: from today, my hours go to Body and Mind.',
        `🎯 Bench press 100kg by ${short(due)} · Read 12 books by ${short(due)}`,
        'Make yours → https://nembotjules.vercel.app/intentional',
      ].join('\n')
    );
    expect(text.split('\n')).toHaveLength(3);
  });

  it('without goals or pillars it still reads well', () => {
    expect(pledgeShareText({ signedOn: new Date(), pillars: [], goals: [] })).toBe(
      'I just signed my pledge: from today, my hours go to the life I chose.\nMake yours → https://nembotjules.vercel.app/intentional'
    );
  });
});
