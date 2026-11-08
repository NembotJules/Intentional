import { describe, expect, it } from 'vitest';
import { CLIP_FACE, CLIP_MOODS, LOOP_MOODS, ONCE, flameScale, loopScale, usesLoop } from './flickLoop';
import { existsSync, readFileSync } from 'node:fs';
import { BLOCK_PRESETS } from './blockPresets';
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
  it('US-123: the unlock clips always animate, play once where they should, and hand over to a real loop', () => {
    for (const m of CLIP_MOODS) {
      expect(usesLoop({ mood: m, intensity: 0.2 })).toBe(true); // even when the flame is low
      expect(usesLoop({ mood: m, intensity: 0.9, bob: false })).toBe(false); // a still Flick stays still
      expect(existsSync(join(__dirname, '..', 'assets', 'lottie', `flick-${m}.json`))).toBe(true);
      expect(CLIP_FACE[m]).toBeTruthy();
    }
    expect(ONCE).toEqual({ deflate: null, victory: 'proud', key: 'hourglass', cheer: 'proud' });
    for (const next of Object.values(ONCE)) if (next) expect([...LOOP_MOODS, ...CLIP_MOODS]).toContain(next);
  });
  it('US-123: one-shot clips stop at their end, loops close seamlessly', () => {
    const read = (m: string) => JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'lottie', `flick-${m}.json`), 'utf8'));
    expect(read('victory').op).toBe(150);
    expect(read('cheer').op).toBe(110); // US-126
    expect(read('deflate').op).toBe(54);
    expect(read('key').op).toBe(120);
    for (const m of ['guard', 'remind', 'watch', 'hourglass']) expect(read(m).op).toBe(240);
  });
  it('US-124: every Block preset has its scene of Flick acting it out (a seamless 4 s loop)', () => {
    for (const p of BLOCK_PRESETS) {
      const file = join(__dirname, '..', 'assets', 'lottie', `flick-preset-${p.id}.json`);
      expect(existsSync(file)).toBe(true);
      expect(JSON.parse(readFileSync(file, 'utf8')).op).toBe(240);
    }
  });
});
