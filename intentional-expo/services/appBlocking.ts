/**
 * appBlocking.ts — US-026
 *
 * Service layer between the FamilyControls native module and the rest of
 * the app.  All functions are safe to call on any platform; they no-op
 * silently on web / Android / Expo Go.
 *
 * Key behaviours
 * ──────────────
 * • Authorization is requested lazily on the first call to applyShields()
 *   so the OS permission sheet appears at a meaningful moment (session start).
 * • The encoded FamilyActivitySelection is persisted in the settings table
 *   (key: 'fc_selection') so it survives app restarts.
 * • Authorization status is re-read from the native module on every call;
 *   the user can revoke permission in Settings at any time.
 *
 * US-077 (strict mode on by default)
 * ──────────────────────────────────
 * • syncHabitBlocks() registers one DeviceActivity schedule per strict habit
 *   and weekday; iOS then runs the DeviceActivityMonitor extension
 *   (targets/device-activity-monitor) at those times, which shields the
 *   selected apps without Intentional being open.
 * • The selection is mirrored into the App Group the extension reads.
 * • Setting 'strict_autoblock_active' = '1' only when every window was
 *   registered; the habit notification copy ("Apps blocked. Tap to start…")
 *   depends on it.
 * • endActiveHabitBlock(habitId) lifts a running block ("Skip today", a
 *   habit session ended early) and keeps that habit unblocked for the day.
 */

import { Platform } from 'react-native';
import * as api from '@/db/api';
import { setSetting } from '@/db';
import * as FamilyControls from '../modules/family-controls/index';
import type { ActiveHabitBlock, AuthorizationStatus, HabitBlock } from '../modules/family-controls/index';
import { buildStrictBlocks, type HabitForSchedule, type StrictBlock } from '@/services/habitSchedule';

// Re-export so callers (Settings screen etc.) don't need a direct module import
export type { ActiveHabitBlock, AuthorizationStatus, HabitBlock };

// ─── DB keys ────────────────────────────────────────────────────────────────
const SELECTION_KEY = 'fc_selection';   // base64 FamilyActivitySelection
/** '1' when strict-mode windows are registered with iOS (read by the habit notification copy). */
export const AUTOBLOCK_KEY = 'strict_autoblock_active';

/** iOS refuses more monitored DeviceActivity schedules than this per app (MonitoringError.excessiveActivities). */
export const MAX_MONITORED_ACTIVITIES = 20;
/** iOS refuses DeviceActivity intervals shorter than 15 minutes (MonitoringError.intervalTooShort). */
export const MIN_WINDOW_MINUTES = 15;
const LAST_MINUTE = 23 * 60 + 59;

// ─── Module access (never throws on web/Android/Expo Go) ─────────────────────
// Imported statically: the module guards its own native require, and the
// synchronous status checks below (Settings, Focus "Shield Ready") need it
// loaded before any async call has happened.
function modSync() {
  return Platform.OS === 'ios' ? FamilyControls : null;
}

async function mod() {
  return modSync();
}

// ── Public API ───────────────────────────────────────────────────────────────

/** True when the native module is compiled in AND iOS 16+ is running. */
export function isAvailable(): boolean {
  if (Platform.OS !== 'ios') return false;
  const status = modSync()?.getAuthorizationStatus();
  // 'unsupported' means module not compiled in (Expo Go / old iOS)
  return !!status && status !== 'unsupported';
}

/** Synchronous — use to decide whether to show the blocking UI. */
export function getAuthorizationStatus(): AuthorizationStatus {
  if (Platform.OS !== 'ios') return 'unsupported';
  return modSync()?.getAuthorizationStatus() ?? 'unsupported';
}

/** True when the user has previously saved a FamilyActivitySelection. */
export function hasSelection(): boolean {
  return !!(api.getSetting(SELECTION_KEY));
}

/**
 * Returns the currently stored base64 selection, or null.
 * Used by the Settings screen to show the selection count.
 */
export function getStoredSelection(): string | null {
  return api.getSetting(SELECTION_KEY) ?? null;
}

/**
 * Persist a new selection (base64) coming from presentActivityPicker.
 * Call this whenever the user finishes picking in the native UI.
 */
export function saveSelection(encoded: string): void {
  setSetting(SELECTION_KEY, encoded);
  // US-077: the DeviceActivityMonitor extension reads the selection from the App Group.
  modSync()?.setSharedSelection(encoded);
}

/**
 * Present the native FamilyActivityPicker so the user can choose
 * which apps/categories to block.
 *
 * @returns true if the user confirmed a selection, false if cancelled
 *          or if the module is unavailable.
 */
export async function presentPicker(): Promise<boolean> {
  const m = await mod();
  if (!m) return false;

  const current = getStoredSelection() ?? undefined;
  const result = await m.presentActivityPicker(current);
  if (result) {
    saveSelection(result);
    return true;
  }
  return false;
}

/**
 * Request FamilyControls authorization from the OS.
 * The system permission sheet is shown only the first time.
 */
export async function requestAuthorization(): Promise<AuthorizationStatus> {
  const m = await mod();
  if (!m) return 'unsupported';
  return m.requestAuthorization();
}

/**
 * Apply OS-level shields using the stored selection.
 *
 * Called at focus session start.  If authorization hasn't been granted yet
 * this function requests it first; the OS may show a permission sheet.
 *
 * @returns 'applied'      — shields are now active
 * @returns 'no_selection' — user hasn't configured anything to block
 * @returns 'denied'       — user denied FamilyControls permission
 * @returns 'unsupported'  — not on a native iOS 16+ build
 */
export async function applyShields(): Promise<
  'applied' | 'no_selection' | 'denied' | 'unsupported'
> {
  const m = await mod();
  if (!m) return 'unsupported';

  // Ensure we have permission
  let status = m.getAuthorizationStatus();
  if (status === 'notDetermined') {
    status = await m.requestAuthorization();
  }
  if (status !== 'approved') return 'denied';

  const selection = getStoredSelection();
  if (!selection) return 'no_selection';

  const ok = m.applyShields(selection);
  return ok ? 'applied' : 'no_selection';
}

/**
 * Remove all active shields.
 *
 * Called on focus session end (completed, abandoned, or timer screen unmount).
 * Safe to call even when no shields are active.
 */
export async function removeShields(): Promise<void> {
  const m = await mod();
  m?.removeShields();
}

// ── US-077: strict mode ──────────────────────────────────────────────────────

/**
 * Flattens strict windows into the per-activity blocks iOS monitors:
 *  - a habit scheduled every day → one block with weekday null (saves 6 of the 20 slots);
 *  - otherwise one block per weekday (1 = Sunday … 7 = Saturday);
 *  - windows shorter than 15 min are lengthened (iOS minimum); one that would cross midnight
 *    starts earlier instead, so it still ends at 23:59;
 *  - at most `max` blocks, in habit order (the rest are reported as dropped).
 */
export function toHabitBlocks(strict: StrictBlock[], max = MAX_MONITORED_ACTIVITIES): { blocks: HabitBlock[]; dropped: number } {
  const all: HabitBlock[] = [];
  for (const s of strict) {
    let start = s.startHour * 60 + s.startMinute;
    let end = s.endHour * 60 + s.endMinute;
    if (end - start < MIN_WINDOW_MINUTES) {
      end = start + MIN_WINDOW_MINUTES;
      if (end > LAST_MINUTE) {
        end = LAST_MINUTE;
        start = LAST_MINUTE - MIN_WINDOW_MINUTES;
      }
    }
    const window = {
      startHour: Math.floor(start / 60),
      startMinute: start % 60,
      endHour: Math.floor(end / 60),
      endMinute: end % 60,
    };
    const days = [...new Set(s.weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
    if (days.length === 7) {
      all.push({ id: s.habitId, weekday: null, ...window });
    } else {
      for (const weekday of days) all.push({ id: s.habitId, weekday, ...window });
    }
  }
  return { blocks: all.slice(0, max), dropped: Math.max(0, all.length - max) };
}

function strictHabits(): HabitForSchedule[] {
  return api.getAllActionsWithGoal().map((a) => ({
    id: a.id,
    name: a.name,
    pillarName: a.goal_name,
    target_minutes: a.target_minutes,
    reminder_time: a.reminder_time,
    days_mask: a.days_mask,
    is_active: a.is_active,
    strict: a.strict,
  }));
}

/**
 * US-077: keep the strict-mode windows registered with iOS in step with the habits.
 * Called through services/habitSync.syncHabits(). Never throws.
 */
export async function syncHabitBlocks(): Promise<void> {
  const m = modSync();
  try {
    if (!m || !isAvailable()) {
      setSetting(AUTOBLOCK_KEY, '0');
      return;
    }
    const selection = getStoredSelection();
    m.setSharedSelection(selection);
    // No apps picked yet, or permission not granted: nothing could be shielded. Habits fall back to the
    // notification flow (and the notification doesn't claim apps are blocked).
    if (!selection || m.getAuthorizationStatus() !== 'approved') {
      m.clearHabitBlocks();
      setSetting(AUTOBLOCK_KEY, '0');
      return;
    }
    const { blocks, dropped } = toHabitBlocks(buildStrictBlocks(strictHabits()));
    if (!blocks.length) {
      m.clearHabitBlocks();
      setSetting(AUTOBLOCK_KEY, '0');
      return;
    }
    const result = await m.scheduleHabitBlocks(blocks);
    const ok = !result.error && dropped === 0 && result.scheduled === blocks.length;
    setSetting(AUTOBLOCK_KEY, ok ? '1' : '0');
  } catch {
    try {
      setSetting(AUTOBLOCK_KEY, '0');
    } catch {
      // DB unavailable: nothing more to do
    }
  }
}

/** True when the last sync registered every strict window with iOS. */
export function isAutoBlockActive(): boolean {
  return api.getSetting(AUTOBLOCK_KEY) === '1';
}

/** The strict window running right now (apps shielded by the extension), or null. */
export function getActiveHabitBlock(): ActiveHabitBlock | null {
  return modSync()?.getActiveHabitBlock() ?? null;
}

/**
 * Lift a strict block now: "Skip today" or ending a habit's session early.
 * With a habitId, that habit also stays unblocked for the rest of today (even if a later sync
 * re-registers its window); a block running for another habit is left alone.
 */
export function endActiveHabitBlock(habitId?: string): void {
  modSync()?.endActiveHabitBlock(habitId);
}
