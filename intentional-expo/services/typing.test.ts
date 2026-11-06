import { describe, expect, it } from 'vitest';
import { MS_PER_CHAR, charTimes, typedLength, typingDuration } from './typing';

describe('Flick types his words out (US-100)', () => {
  it('one letter every few milliseconds', () => {
    expect(typedLength('Hello', 0)).toBe(0);
    expect(typedLength('Hello', MS_PER_CHAR)).toBe(1);
    expect(typedLength('Hello', MS_PER_CHAR * 3)).toBe(3);
    expect(typedLength('Hello', 10_000)).toBe(5);
  });
  it('a beat after a comma, a longer one after a full stop or question, none at the very end', () => {
    const t = charTimes('Hi, you. Ok?', 10);
    // "Hi," → 3 chars at 10,20,30; then a 110 ms pause before " "
    expect(t.slice(0, 4)).toEqual([10, 20, 30, 150]);
    // "you." ends at index 7; the next space waits 260 ms more
    expect(t[8]! - t[7]!).toBe(270);
    expect(typingDuration('Ok?', 10)).toBe(30);
  });
  it('the whole sentence takes about a second and a half', () => {
    const d = typingDuration('Do you really need this app now?');
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(1500);
    expect(typedLength('Do you really need this app now?', d)).toBe(32);
    expect(typedLength('', 500)).toBe(0);
  });
});
