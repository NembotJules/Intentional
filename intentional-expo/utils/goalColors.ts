export type GoalType = 'physique' | 'finances' | 'skills' | 'mind';

export const GOAL_COLORS: Record<GoalType, {
  primary: string;
  tint: string;
  darkPrimary: string;
}> = {
  physique: { primary: '#D65A31', tint: 'rgba(214,90,49,0.14)', darkPrimary: '#E77752' },
  finances: { primary: '#2F8F5B', tint: 'rgba(47,143,91,0.14)', darkPrimary: '#46AA72' },
  skills:   { primary: '#A66A00', tint: 'rgba(166,106,0,0.14)', darkPrimary: '#C98713' },
  mind:     { primary: '#4C6FFF', tint: 'rgba(76,111,255,0.14)', darkPrimary: '#718BFF' },
};

const toneKeys: GoalType[] = ['physique', 'finances', 'skills', 'mind'];

/** Anything with a goal id and (optionally) the color the user picked for it. */
export type GoalColorSource = { id: string; color?: string | null };

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveGoalTone(seed: string) {
  const key = toneKeys[hashSeed(seed || 'intentional') % toneKeys.length];
  return GOAL_COLORS[key];
}

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The goal's chosen color; falls back to a stable hashed tone for legacy rows without a valid hex. */
export function getGoalColor(goal: GoalColorSource): string {
  if (goal.color && HEX_COLOR.test(goal.color)) return goal.color;
  return resolveGoalTone(goal.id).primary;
}

export function getGoalTint(goal: GoalColorSource): string {
  if (goal.color && HEX_COLOR.test(goal.color)) return hexToRgba(goal.color, 0.14);
  return resolveGoalTone(goal.id).tint;
}
