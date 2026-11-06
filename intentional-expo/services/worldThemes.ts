/**
 * US-098 · Flick's worlds, in one place. Each world is a palette for every time of day, in two moods:
 * `cold` (nothing given yet today: grey-blue, quiet) and `warm` (today's plan given: saturated, alive).
 * `services/world.ts` blends them by the hour and today's warmth.
 * US-101: four more worlds, each earned at one of Flick's stages with REAL lifetime hours given
 * (services/worldUnlocks), never by opening the app. Their `cold` palettes are derived from `warm` (a quiet,
 * grey-blue version), so each world only defines how it looks when alive. Signature drawings: ThemeDecor.
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
  /** One line for the unlock celebration and the picker. */
  tagline: string;
  /** The full-colour background of its unlock celebration. */
  celebrate: string;
}

function hx(n: string): [number, number, number] {
  const v = n.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
/** The quiet version of a colour: half-way to a cool grey of the same lightness. */
function quiet(c: string): string {
  const [r, g, b] = hx(c);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  const grey: [number, number, number] = [l * 0.96, l * 0.99, l * 1.06];
  const out = [r, g, b].map((x, i) => Math.max(0, Math.min(255, Math.round(x + (grey[i]! - x) * 0.6))));
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
function coldOf(warm: Record<SkyPhase, WorldPalette>): Record<SkyPhase, WorldPalette> {
  const out = {} as Record<SkyPhase, WorldPalette>;
  for (const k of Object.keys(warm) as SkyPhase[]) {
    const p = warm[k];
    out[k] = { skyTop: quiet(p.skyTop), skyBottom: quiet(p.skyBottom), hillBack: quiet(p.hillBack), hillFront: quiet(p.hillFront) };
  }
  return out;
}

const FOREST_WARM: Record<SkyPhase, WorldPalette> = {
  night: { skyTop: '#0F1A2E', skyBottom: '#2B3F57', hillBack: '#1C3A2E', hillFront: '#163024' },
  dawn: { skyTop: '#A9B8E0', skyBottom: '#F6D6B8', hillBack: '#4F8A5B', hillFront: '#3E7A4A' },
  day: { skyTop: '#86C5E8', skyBottom: '#DDF1F5', hillBack: '#4E9A5E', hillFront: '#3B8549' },
  dusk: { skyTop: '#4F5996', skyBottom: '#F0A37E', hillBack: '#3F6E4A', hillFront: '#2F5A3B' },
};
const BEACH_WARM: Record<SkyPhase, WorldPalette> = {
  night: { skyTop: '#121A3C', skyBottom: '#2E3A6E', hillBack: '#1E3B5C', hillFront: '#6B6378' },
  dawn: { skyTop: '#F2B8C6', skyBottom: '#FFE1B5', hillBack: '#5FB3C9', hillFront: '#F2D7A6' },
  day: { skyTop: '#5EC4F0', skyBottom: '#D8F3FA', hillBack: '#2FA8C9', hillFront: '#F4DCA8' },
  dusk: { skyTop: '#6B4E9A', skyBottom: '#FF9E6B', hillBack: '#3C7FA6', hillFront: '#E8BE8A' },
};
const LAKE_WARM: Record<SkyPhase, WorldPalette> = {
  night: { skyTop: '#0E1630', skyBottom: '#283A5E', hillBack: '#3A4A66', hillFront: '#24403A' },
  dawn: { skyTop: '#B9C4EA', skyBottom: '#FAD9C2', hillBack: '#8B9BB8', hillFront: '#7DB07A' },
  day: { skyTop: '#78B8EC', skyBottom: '#E4F1FB', hillBack: '#7E93B5', hillFront: '#6FAE6C' },
  dusk: { skyTop: '#55508F', skyBottom: '#F3A88A', hillBack: '#6E6F96', hillFront: '#557E57' },
};
const ROOFTOP_WARM: Record<SkyPhase, WorldPalette> = {
  night: { skyTop: '#0D0F24', skyBottom: '#33285A', hillBack: '#1B1B33', hillFront: '#3A3446' },
  dawn: { skyTop: '#B7A9DA', skyBottom: '#FFC9A8', hillBack: '#6E6A8A', hillFront: '#8A7F86' },
  day: { skyTop: '#8CB8E6', skyBottom: '#E6EEF6', hillBack: '#7D8AA6', hillFront: '#9C928C' },
  dusk: { skyTop: '#3E3473', skyBottom: '#FF8E72', hillBack: '#3D3858', hillFront: '#6A5C66' },
};

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
    tagline: 'Where it all starts: a hearth on a hill.',
    celebrate: '#FF7A3A',
  },
  forest: {
    id: 'forest',
    name: 'The Forest',
    unlockHours: 10,
    warm: FOREST_WARM,
    cold: coldOf(FOREST_WARM),
    bloom: ['#E8443A', '#FFFFFF', '#FFD23F', '#C77DFF'],
    tagline: 'Tall pines and a camp in the trees.',
    celebrate: '#2F8F55',
  },
  beach: {
    id: 'beach',
    name: 'The Beach',
    unlockHours: 50,
    warm: BEACH_WARM,
    cold: coldOf(BEACH_WARM),
    bloom: ['#FF8A65', '#FFFFFF', '#FFD166', '#F78FB3'],
    tagline: 'A fire on the sand, the sea behind.',
    celebrate: '#1FA2C7',
  },
  lake: {
    id: 'lake',
    name: 'The Mountain lake',
    unlockHours: 150,
    warm: LAKE_WARM,
    cold: coldOf(LAKE_WARM),
    bloom: ['#9AD0FF', '#FFFFFF', '#FFD23F', '#B39DDB'],
    tagline: 'Snowy peaks over still water.',
    celebrate: '#4C6FD9',
  },
  rooftop: {
    id: 'rooftop',
    name: 'The Rooftop',
    unlockHours: 500,
    warm: ROOFTOP_WARM,
    cold: coldOf(ROOFTOP_WARM),
    bloom: ['#FFD23F', '#FF8FA3', '#7FDBFF', '#FFB547'],
    tagline: 'The city lights at your feet.',
    celebrate: '#5B3FB8',
  },
};

export const DEFAULT_WORLD = 'hill';

export function worldTheme(id: string | null | undefined): WorldTheme {
  return (id && WORLD_THEMES[id]) || WORLD_THEMES[DEFAULT_WORLD]!;
}
