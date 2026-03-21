export type GoalType = 'physique' | 'finances' | 'skills' | 'mind';

export const GOAL_COLORS: Record<GoalType, {
  primary: string;
  tint: string;
  darkPrimary: string;
}> = {
  physique: { primary: '#4A9EED', tint: 'rgba(74,158,237,0.10)', darkPrimary: '#60AEFF' },
  finances: { primary: '#22C55E', tint: 'rgba(34,197,94,0.10)', darkPrimary: '#34D366' },
  skills:   { primary: '#8B5CF6', tint: 'rgba(139,92,246,0.10)', darkPrimary: '#A78BFA' },
  mind:     { primary: '#F59E0B', tint: 'rgba(245,158,11,0.10)', darkPrimary: '#FBBF24' },
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
