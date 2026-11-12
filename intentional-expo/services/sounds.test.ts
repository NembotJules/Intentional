import { describe, expect, it } from 'vitest';
import { SOUNDS_SETTING, soundsEnabled } from './sounds';

describe('US-129 celebration sounds', () => {
  it('are on unless turned off in Settings', () => {
    expect(soundsEnabled(() => null)).toBe(true);
    expect(soundsEnabled(() => '1')).toBe(true);
    expect(soundsEnabled((k) => (k === SOUNDS_SETTING ? '0' : null))).toBe(false);
  });
  it('stay on if the setting cannot be read', () => {
    expect(soundsEnabled(() => { throw new Error('no db'); })).toBe(true);
  });
});
