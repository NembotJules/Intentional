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
 */

import { Platform } from 'react-native';
import * as api from '@/db/api';
import { setSetting } from '@/db';
import type { AuthorizationStatus } from '../modules/family-controls/index';

// Re-export so callers (Settings screen etc.) don't need a direct module import
export type { AuthorizationStatus };

// ─── DB keys ────────────────────────────────────────────────────────────────
const SELECTION_KEY = 'fc_selection';   // base64 FamilyActivitySelection

// ─── Lazy module import (never throws on web/Android/Expo Go) ────────────────
let _mod: typeof import('../modules/family-controls/index') | null = null;

async function mod() {
  if (Platform.OS !== 'ios') return null;
  if (_mod) return _mod;
  try {
    _mod = await import('../modules/family-controls/index');
    return _mod;
  } catch {
    return null;
  }
}

function modSync() {
  return _mod ?? null;
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
