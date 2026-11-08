import { describe, expect, it } from 'vitest';
import { LOOP_MOODS, flameScale, loopScale, usesLoop } from './flickLoop';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('flickLoop', () => {
  it('matches Mascot’s flame scale at the edges and is continuous at 0.6', () => {
    expect(flameScale(0)).toBeCloseTo(0.42);
    expect(flameScale(1)).toBeCloseTo(1.06);
    expect(flameScale(0.6 - 1e-9)).toBeCloseTo(flameScale(0.6), 6);
  });
  it('uses a loop only for a living, healthy Flick in a looped mood with its own arms', () => {
    expect(usesLoop({ mood: 'happy', intensity: 0.7 })).toBe(true);
    expect(usesLoop({ mood: 'happy', intensity: 0.3 })).toBe(false); // low, smoking flame → SVG
    expect(usesLoop({ mood: 'mystery', intensity: 0.8 })).toBe(false);
    expect(usesLoop({ mood: 'wave', intensity: 0.8 })).toBe(false);
    expect(usesLoop({ mood: 'happy', intensity: 0.8, arms: 'hold' })).toBe(false);
    expect(usesLoop({ mood: 'happy', intensity: 0.8, bob: false })).toBe(false);
  });
  it('scales the loop to 1 at its own intensity, bigger when blazing and by the stage body', () => {
    expect(loopScale(0.75)).toBeCloseTo(1);
    expect(loopScale(1)).toBeGreaterThan(1);
    expect(loopScale(0.75, 0.86)).toBeCloseTo(0.86);
  });
  it('has a built file for every looped mood', () => {
    for (const m of LOOP_MOODS) expect(existsSync(join(__dirname, '..', 'assets', 'lottie', `flick-${m}.json`))).toBe(true);
  });
  it('blinks: the open-eyed loops close the eyes for a moment and open them again', () => {
    for (const m of ['happy', 'worried', 'focus', 'think', 'shock']) {
      const anim = JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'lottie', `flick-${m}.json`), 'utf8'));
      const face = anim.layers.find((l: { nm: string }) => l.nm === 'face');
      const eye = face.shapes.find((g: { nm: string }) => g.nm === 'eye');
      const heights = eye.it[0].s.k.map((k: { s: number[] }) => k.s[1]);
      expect(Math.min(...heights)).toBeLessThan(2);
      expect(Math.max(...heights)).toBeGreaterThan(8);
      expect(heights[0]).toBeCloseTo(heights[heights.length - 1]); // seamless loop
    }
  });
});
