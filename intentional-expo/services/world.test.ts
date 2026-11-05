import { describe, expect, it } from 'vitest';
import { mix, skyPhase, worldLook, worldWarmth } from './world';
import { WORLD_THEMES, worldTheme } from './worldThemes';

describe('Flick\'s world: the sky follows the time of day (US-098)', () => {
  it('night, dawn, day, dusk at the boundaries', () => {
    expect([0, 4, 5, 7, 8, 12, 16, 17, 18, 20, 21, 23].map(skyPhase)).toEqual(['night', 'night', 'dawn', 'dawn', 'day', 'day', 'day', 'dusk', 'dusk', 'dusk', 'night', 'night']);
    expect(skyPhase(24)).toBe('night');
    expect(skyPhase(-1)).toBe('night');
  });
  it('a moon and many stars at night; the sun by day, high at noon, low at dawn and dusk', () => {
    const night = worldLook({ hour: 23, warmth: 0 });
    expect(night.body.kind).toBe('moon');
    expect(night.stars).toBeGreaterThan(10);
    const noon = worldLook({ hour: 13, warmth: 0.5 });
    const dawn = worldLook({ hour: 6, warmth: 0.5 });
    const dusk = worldLook({ hour: 19, warmth: 0.5 });
    expect(noon.body.kind).toBe('sun');
    expect(noon.stars).toBe(0);
    expect(noon.body.y).toBeLessThan(dawn.body.y);
    expect(noon.body.y).toBeLessThan(dusk.body.y);
    expect(dawn.body.x).toBeLessThan(noon.body.x);
    expect(dusk.body.x).toBeGreaterThan(noon.body.x);
  });
});

describe('Flick\'s world: it warms with today\'s hours (US-098)', () => {
  it('warmth: 0 with nothing given, 1 once the plan is given, eased in between; no plan → an hour is a full day', () => {
    expect(worldWarmth(0, 120)).toBe(0);
    expect(worldWarmth(-5, 120)).toBe(0);
    expect(worldWarmth(120, 120)).toBe(1);
    expect(worldWarmth(300, 120)).toBe(1);
    expect(worldWarmth(30, 120)).toBe(0.5); // a quarter of the plan already shows as half the warmth
    expect(worldWarmth(60, 0)).toBe(1);
    expect(worldWarmth(15, 0)).toBe(0.5);
  });
  it('cold at 0 (the theme\'s grey palette), warm at 1 (its saturated palette); flowers and glow grow', () => {
    const theme = WORLD_THEMES.hill!;
    const cold = worldLook({ hour: 12, warmth: 0 });
    const warm = worldLook({ hour: 12, warmth: 1 });
    expect(cold.hillFront).toBe(theme.cold.day.hillFront.toUpperCase());
    expect(warm.hillFront).toBe(theme.warm.day.hillFront.toUpperCase());
    expect(cold.blooms).toBe(0);
    expect(warm.blooms).toBe(9);
    expect(warm.glow).toBeGreaterThan(cold.glow);
    expect(worldLook({ hour: 12, warmth: 0.5 }).blooms).toBe(5);
  });
  it('colour mixing', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#000000', '#FFFFFF', 2)).toBe('#FFFFFF');
  });
  it('themes: one place, the default world when unknown, every phase defined in both moods', () => {
    expect(worldTheme('nope').id).toBe('hill');
    for (const t of Object.values(WORLD_THEMES)) {
      for (const p of ['night', 'dawn', 'day', 'dusk'] as const) {
        expect(t.warm[p].skyTop).toMatch(/^#[0-9A-F]{6}$/i);
        expect(t.cold[p].hillFront).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });
});
