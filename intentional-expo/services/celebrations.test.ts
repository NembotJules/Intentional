import { describe, expect, it, vi } from 'vitest';
import { _celebrationPending, celebrationsHeld, holdCelebrations, onCelebrationCheck, requestCelebrationCheck } from './celebrations';

describe('celebration hand-off (US-084)', () => {
  it('a check asked while held waits; the release runs it once', () => {
    const fn = vi.fn();
    const off = onCelebrationCheck(fn);
    const release = holdCelebrations();
    expect(celebrationsHeld()).toBe(true);
    requestCelebrationCheck();
    expect(fn).not.toHaveBeenCalled();
    expect(_celebrationPending()).toBe(true);
    release();
    expect(fn).toHaveBeenCalledTimes(1);
    release(); // twice is a no-op
    expect(fn).toHaveBeenCalledTimes(1);
    expect(celebrationsHeld()).toBe(false);
    off();
  });

  it('nested holds: only the last release checks', () => {
    const fn = vi.fn();
    const off = onCelebrationCheck(fn);
    const a = holdCelebrations();
    const b = holdCelebrations();
    a();
    expect(fn).not.toHaveBeenCalled();
    b();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it('not held: a check runs straight away', () => {
    const fn = vi.fn();
    const off = onCelebrationCheck(fn);
    requestCelebrationCheck();
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });
});
