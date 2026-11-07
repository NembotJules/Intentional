/**
 * US-103 · One-tap presets on the Block tab, made of ordinary block hours (services/blockRules).
 * A preset's rules carry `preset: <id>` so the card knows it's on and can remove exactly its rules.
 * Block hours can't cross midnight (iOS windows are same-day), so Bedtime is two rules:
 * 22:00–23:59 and 00:00–07:00, every day.
 */
import { describeRule, type BlockRule } from '@/services/blockRules';

export type PresetArt = 'moon' | 'briefcase' | 'sunrise';
/** US-107: the preset's 3D sticker (components/ui/Sticker keys; kept as strings so this file stays pure). */
export type PresetSticker = 'moon' | 'briefcase' | 'sunrise' | 'teacup' | 'utensils' | 'lock' | 'bed';

export interface BlockPreset {
  id: string;
  name: string;
  tagline: string;
  art: PresetArt;
  sticker: PresetSticker;
  /** Colours of its illustrated card: background and accent. */
  bg: string;
  accent: string;
  rules: Pick<BlockRule, 'days_mask' | 'start' | 'end'>[];
}

/**
 * A stored rule. US-107: rules are grouped into named blockers (services/blockers): `group` ties the rules of one
 * blocker together (Bedtime is two), `name` and `sticker` are what its card shows.
 */
export type PresetRule = BlockRule & { preset?: string; group?: string; name?: string; sticker?: string };

const EVERY_DAY = 127;
const WEEKDAYS = 0b0011111;

export const BLOCK_PRESETS: BlockPreset[] = [
  {
    id: 'bedtime',
    name: 'Bedtime',
    tagline: 'Wind down, sleep well',
    art: 'moon',
    sticker: 'moon',
    bg: '#E6E3F5',
    accent: '#5B4FB5',
    rules: [
      { days_mask: EVERY_DAY, start: '22:00', end: '23:59' },
      { days_mask: EVERY_DAY, start: '00:00', end: '07:00' },
    ],
  },
  {
    id: 'work',
    name: 'Work hours',
    tagline: 'Deep work, no scrolling',
    art: 'briefcase',
    sticker: 'briefcase',
    bg: '#DDEFE6',
    accent: '#2E7D5B',
    rules: [{ days_mask: WEEKDAYS, start: '09:00', end: '17:00' }],
  },
  {
    id: 'morning',
    name: 'Morning focus',
    tagline: 'Your best hours first',
    art: 'sunrise',
    sticker: 'sunrise',
    bg: '#FCE7D2',
    accent: '#C8641E',
    rules: [{ days_mask: EVERY_DAY, start: '06:00', end: '09:00' }],
  },
  {
    id: 'winddown',
    name: 'Evening wind-down',
    tagline: 'Screens off before bed',
    art: 'moon',
    sticker: 'teacup',
    bg: '#EDE1F7',
    accent: '#8048B8',
    rules: [{ days_mask: EVERY_DAY, start: '21:00', end: '22:00' }],
  },
  {
    id: 'dinner',
    name: 'Dinner time',
    tagline: 'Eat with the people you love',
    art: 'briefcase',
    sticker: 'utensils',
    bg: '#FBE3E6',
    accent: '#C2456E',
    rules: [{ days_mask: EVERY_DAY, start: '19:00', end: '20:00' }],
  },
];

export function presetById(id: string): BlockPreset | null {
  return BLOCK_PRESETS.find((p) => p.id === id) ?? null;
}

/** "Every day · 22:00–7:00", "Mon–Fri · 9:00–17:00". Bedtime reads as one window across midnight. */
export function presetWhen(p: BlockPreset): string {
  if (p.id === 'bedtime') return 'Every day · 22:00–7:00';
  return describeRule({ id: '', enabled: true, ...p.rules[0]! });
}

/** On when every one of its rules is there and enabled. */
export function presetIsOn(rules: PresetRule[], presetId: string): boolean {
  const p = presetById(presetId);
  if (!p) return false;
  const mine = rules.filter((r) => r.preset === presetId);
  return mine.length === p.rules.length && mine.every((r) => r.enabled);
}

/** Adds the preset's rules (replacing any half-there copy). `makeId` gives each new rule its id. */
export function addPreset(rules: PresetRule[], presetId: string, makeId: (k: number) => string): PresetRule[] {
  const p = presetById(presetId);
  if (!p) return rules;
  const rest = rules.filter((r) => r.preset !== presetId);
  return [...rest, ...p.rules.map((r, k) => ({ id: makeId(k), enabled: true, preset: presetId, ...r }))];
}

export function removePreset(rules: PresetRule[], presetId: string): PresetRule[] {
  return rules.filter((r) => r.preset !== presetId);
}
