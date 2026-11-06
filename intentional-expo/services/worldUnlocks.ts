/**
 * US-101 · Flick's worlds are earned with REAL lifetime hours given, never by opening the app.
 * Each world unlocks at one of Flick's stages (services/lifeLedger STAGES): Flick's hill from the start,
 * the Forest at Flame (10 h), the Beach at Torch (50 h), the Mountain lake at Bonfire (150 h), the Rooftop at
 * Beacon (500 h). A world is celebrated right after its stage-up (CelebrationHost); the picker (app/worlds.tsx)
 * shows the locked ones as silhouettes with the hours still to give.
 * Pure: give it lifetime hours (and the chosen id), get the answer.
 */
import { DEFAULT_WORLD, WORLD_THEMES } from '@/services/worldThemes';

export const WORLD_SETTING = 'world_theme';

export interface WorldStatus {
  id: string;
  name: string;
  unlockHours: number;
  unlocked: boolean;
  /** Hours still to give (0 when unlocked), rounded up. */
  hoursToUnlock: number;
}

/** Every world, in the order they're earned. */
export function worldOrder(): string[] {
  return Object.values(WORLD_THEMES)
    .sort((a, b) => a.unlockHours - b.unlockHours || a.id.localeCompare(b.id))
    .map((w) => w.id);
}

export function isWorldUnlocked(id: string, lifetimeHours: number): boolean {
  const w = WORLD_THEMES[id];
  return !!w && Math.max(0, lifetimeHours) >= w.unlockHours;
}

export function worldStatuses(lifetimeHours: number): WorldStatus[] {
  const h = Math.max(0, lifetimeHours);
  return worldOrder().map((id) => {
    const w = WORLD_THEMES[id]!;
    const unlocked = h >= w.unlockHours;
    return { id, name: w.name, unlockHours: w.unlockHours, unlocked, hoursToUnlock: unlocked ? 0 : Math.max(1, Math.ceil(w.unlockHours - h - 1e-9)) };
  });
}

/** The world a stage unlocks (the one whose threshold is exactly that stage's hours), if any. */
export function worldForStageHours(stageHours: number): string | null {
  const w = Object.values(WORLD_THEMES).find((t) => t.unlockHours > 0 && t.unlockHours === stageHours);
  return w ? w.id : null;
}

/** The world to draw: the chosen one if it exists and is unlocked, else Flick's hill. */
export function effectiveWorld(chosen: string | null | undefined, lifetimeHours: number): string {
  return chosen && isWorldUnlocked(chosen, lifetimeHours) ? chosen : DEFAULT_WORLD;
}

/** "12 h to unlock" */
export function unlockLabel(s: Pick<WorldStatus, 'unlocked' | 'hoursToUnlock'>): string {
  return s.unlocked ? 'Unlocked' : `${s.hoursToUnlock.toLocaleString('en-US')} h to unlock`;
}
