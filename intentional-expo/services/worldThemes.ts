/**
 * US-098 · Flick's worlds, in one place. Each world is a palette for every time of day, in two moods:
 * `cold` (nothing given yet today: grey-blue, quiet) and `warm` (today's plan given: saturated, alive).
 * `services/world.ts` blends them by the hour and today's warmth. Later stories add unlockable worlds here
 * (US-101: earned with real hours given, never by opening the app).
 */

export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk';

export interface WorldPalette {
  skyTop: string;
  skyBottom: string;
  hillBack: string;
  hillFront: string;
}

export interface WorldTheme {
  id: string;
  name: string;
  /** Hours given in total before this world can be chosen (0 = always). */
  unlockHours: number;
  warm: Record<SkyPhase, WorldPalette>;
  cold: Record<SkyPhase, WorldPalette>;
  /** The little things that grow as hours are given (flowers on the hill, embers by the hearth…). */
  bloom: string[];
}

export const WORLD_THEMES: Record<string, WorldTheme> = {
  hill: {
    id: 'hill',
    name: 'Flick’s hill',
    unlockHours: 0,
    warm: {
      night: { skyTop: '#151B3A', skyBottom: '#3B3F70', hillBack: '#2E4A45', hillFront: '#233B33' },
      dawn: { skyTop: '#9CB0E6', skyBottom: '#FBD3B0', hillBack: '#9CC27E', hillFront: '#78AE5E' },
      day: { skyTop: '#7FC0F2', skyBottom: '#E2F2FC', hillBack: '#A3D07F', hillFront: '#73B458' },
      dusk: { skyTop: '#5A5C9E', skyBottom: '#F6A27A', hillBack: '#7E9D63', hillFront: '#5C8448' },
    },
    cold: {
      night: { skyTop: '#1D2030', skyBottom: '#33364A', hillBack: '#353C3B', hillFront: '#2B302F' },
      dawn: { skyTop: '#AEB4C4', skyBottom: '#D9D2CC', hillBack: '#AAB3A3', hillFront: '#929C8C' },
      day: { skyTop: '#AFC2D3', skyBottom: '#E3E8EC', hillBack: '#B4BDAA', hillFront: '#9AA591' },
      dusk: { skyTop: '#6E6F86', skyBottom: '#C9A797', hillBack: '#8A9480', hillFront: '#727D6B' },
    },
    bloom: ['#FFD23F', '#FF8FA3', '#FFFFFF', '#FFB547'],
  },
};

export const DEFAULT_WORLD = 'hill';

export function worldTheme(id: string | null | undefined): WorldTheme {
  return (id && WORLD_THEMES[id]) || WORLD_THEMES[DEFAULT_WORLD]!;
}
