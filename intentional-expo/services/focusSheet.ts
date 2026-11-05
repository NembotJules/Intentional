/**
 * US-099 · The "Start focusing" sheet's open/closed state, shared by the tab bar's Focus button and any
 * screen that wants to open it. A tiny external store (no context provider needed).
 */
import { useSyncExternalStore } from 'react';

let isOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openFocusSheet(): void {
  isOpen = true;
  emit();
}

export function closeFocusSheet(): void {
  isOpen = false;
  emit();
}

export function focusSheetOpen(): boolean {
  return isOpen;
}

export function useFocusSheetOpen(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => isOpen,
    () => false
  );
}

/** The route the sheet's Start button opens: the running-session screen, starting right away. */
export function focusStartHref(o: { pillarId: string; actionId?: string | null; taskId?: string | null; minutes: number; block: boolean; now?: number }): string {
  const q = [`goalId=${encodeURIComponent(o.pillarId)}`];
  if (o.actionId) q.push(`actionId=${encodeURIComponent(o.actionId)}`);
  else if (o.taskId) q.push(`taskId=${encodeURIComponent(o.taskId)}`);
  q.push(`minutes=${Math.max(1, Math.round(o.minutes))}`, 'start=1', `block=${o.block ? 1 : 0}`, `ts=${o.now ?? Date.now()}`);
  return `/(tabs)/focus?${q.join('&')}`;
}
