/**
 * US-101 · Which of Flick's worlds is shown, stored as a setting. Only an unlocked world can be chosen
 * (services/worldUnlocks, from lifetime hours); a stored choice that's no longer unlocked shows Flick's hill.
 */
import * as api from '@/db/api';
import { setSetting } from '@/db';
import { WORLD_SETTING, effectiveWorld, isWorldUnlocked, worldStatuses } from '@/services/worldUnlocks';

export function lifetimeHours(): number {
  return api.getFlickState().lifetimeHours;
}

/** The world to draw on Today and in the unlock scene. */
export function getSelectedWorld(): string {
  return effectiveWorld(api.getSetting(WORLD_SETTING), unlockHours());
}

type Listener = (id: string) => void;
const listeners = new Set<Listener>();

/** Today listens, so "Try it" on the unlock celebration (drawn over Today) moves Flick at once. */
export function onWorldChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** US-125 · the founder's testing switch (Settings, development builds only): every world unlocked while it's on. */
export const TRY_ALL_WORLDS_SETTING = 'worlds_try_all';
export function tryAllWorlds(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && api.getSetting(TRY_ALL_WORLDS_SETTING) === '1';
}
export function setTryAllWorlds(on: boolean): void {
  setSetting(TRY_ALL_WORLDS_SETTING, on ? '1' : '0');
  for (const fn of [...listeners]) fn(getSelectedWorld());
}
/** The hours that unlock worlds: the real lifetime hours, or all of them while trying every world. */
function unlockHours(): number {
  return tryAllWorlds() ? Number.MAX_SAFE_INTEGER : lifetimeHours();
}

/** Choose a world. Refused (false) when it isn't unlocked yet. */
export function setSelectedWorld(id: string): boolean {
  if (!isWorldUnlocked(id, unlockHours())) return false;
  setSetting(WORLD_SETTING, id);
  for (const fn of [...listeners]) fn(id);
  return true;
}

export function getWorldStatuses() {
  return worldStatuses(unlockHours());
}
