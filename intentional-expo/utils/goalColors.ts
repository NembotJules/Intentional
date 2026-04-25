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

export function getGoalColor(seed: string): string {
  return resolveGoalTone(seed).primary;
}

export function getGoalTint(seed: string): string {
  return resolveGoalTone(seed).tint;
}
