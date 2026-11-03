/**
 * family-controls — TypeScript interface for the native FamilyControls module.
 *
 * On non-iOS platforms every function is a no-op stub so the JS bundle
 * never crashes on web or Android.
 *
 * The native module (FamilyControlsModule.swift) is only compiled when running
 * `eas build` for iOS; it is NOT available in Expo Go or the web build.
 */
import { Platform } from 'react-native';

export type AuthorizationStatus =
  | 'approved'
  | 'denied'
  | 'notDetermined'
  | 'unsupported'
  | 'unknown';

/** US-077: one strict-mode window. weekday 1 = Sunday … 7 = Saturday; null = every day (one activity instead of 7). */
export interface HabitBlock {
  id: string;
  weekday: number | null;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export interface ScheduleResult {
  /** Habit windows now monitored by iOS. */
  scheduled: number;
  /** Blocks passed in. */
  requested: number;
  /** DeviceActivityCenter.MonitoringError case (excessiveActivities, intervalTooShort, unauthorized, …), 'invalidBlock', 'unsupported' or 'nativeError'. */
  error?: string;
}

export interface ActiveHabitBlock {
  /** DeviceActivityName raw value, e.g. habit-<id>-wd3 */
  activity: string;
  habitId?: string;
  /** ms since epoch the extension shielded the apps */
  since: number;
  /** ms since epoch the window ends (when known) */
  until?: number;
}

// ── Lazy native module loader (safe — never throws on non-iOS) ────────────
let _native: {
  requestAuthorization: () => Promise<string>;
  getAuthorizationStatus: () => string;
  applyShields: (encoded: string) => boolean;
  removeShields: () => void;
  presentActivityPicker: (current: string | null) => Promise<string | null>;
  // US-077 (absent from builds made before it: every call below checks)
  setSharedSelection?: (encoded: string | null) => boolean;
  scheduleHabitBlocks?: (blocks: HabitBlock[]) => Promise<ScheduleResult>;
  clearHabitBlocks?: () => void;
  getActiveHabitBlock?: () => ActiveHabitBlock | null;
  endActiveHabitBlock?: (habitId: string | null) => void;
  // US-096
  unlockFor?: (minutes: number) => { ok: boolean; until?: number; error?: string };
  relockNow?: () => boolean;
  getUnlockUntil?: () => number | null;
  consumeUnlockRequest?: () => boolean;
} | null = null;
let _loaded = false;

function native() {
  if (Platform.OS !== 'ios') return null;
  if (!_loaded) {
    _loaded = true;
    try {
      // null when the module wasn't compiled in — Expo Go, or a build without the local module.
      const { requireOptionalNativeModule } = require('expo');
      _native = requireOptionalNativeModule('FamilyControls');
    } catch {
      _native = null;
    }
  }
  return _native;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Ask the user to grant FamilyControls permission.
 * Must be called before any other API.
 * Resolves with the resulting authorization status.
 */
export async function requestAuthorization(): Promise<AuthorizationStatus> {
  const mod = native();
  if (!mod) return 'unsupported';
  try {
    return (await mod.requestAuthorization()) as AuthorizationStatus;
  } catch {
    return 'denied';
  }
}

/**
 * Returns the current authorization status synchronously.
 * 'unsupported' means the module was not compiled in (Expo Go / web / Android).
 */
export function getAuthorizationStatus(): AuthorizationStatus {
  const mod = native();
  if (!mod) return 'unsupported';
  try {
    return mod.getAuthorizationStatus() as AuthorizationStatus;
  } catch {
    return 'unsupported';
  }
}

/**
 * Apply OS-level shields for the apps/categories encoded in `encodedSelection`.
 * `encodedSelection` is a base64 string produced by presentActivityPicker.
 * Returns true when shields were applied successfully.
 */
export function applyShields(encodedSelection: string): boolean {
  const mod = native();
  if (!mod) return false;
  try {
    return mod.applyShields(encodedSelection);
  } catch {
    return false;
  }
}

/**
 * Remove all active FamilyControls shields.
 * Safe to call even if no shields are currently applied.
 */
export function removeShields(): void {
  try {
    native()?.removeShields();
  } catch {
    // nothing to remove
  }
}

/**
 * Present the native FamilyActivityPicker so the user can choose which
 * apps / categories to block during focus sessions.
 *
 * @param currentEncoded  Optional previously-stored selection to pre-populate.
 * @returns               New base64-encoded selection, or null if the user cancelled.
 */
export async function presentActivityPicker(
  currentEncoded?: string,
): Promise<string | null> {
  const mod = native();
  if (!mod) return null;
  try {
    return await mod.presentActivityPicker(currentEncoded ?? null);
  } catch {
    return null;
  }
}

// ── US-077: strict mode (scheduled blocking via the DeviceActivityMonitor extension) ──

/** Mirror the selection into the App Group the extension reads. null removes it. */
export function setSharedSelection(encoded: string | null): boolean {
  const fn = native()?.setSharedSelection;
  if (!fn) return false;
  try {
    return fn(encoded);
  } catch {
    return false;
  }
}

/**
 * Replace every strict-mode window with `blocks` (iOS keeps at most 20 monitored activities per app).
 * Never throws: failures come back in `error`.
 */
export async function scheduleHabitBlocks(blocks: HabitBlock[]): Promise<ScheduleResult> {
  const fn = native()?.scheduleHabitBlocks;
  if (!fn) return { scheduled: 0, requested: blocks.length, error: 'unsupported' };
  try {
    const r = await fn(blocks);
    return { scheduled: Number(r?.scheduled ?? 0), requested: Number(r?.requested ?? blocks.length), ...(r?.error ? { error: String(r.error) } : {}) };
  } catch {
    return { scheduled: 0, requested: blocks.length, error: 'nativeError' };
  }
}

/** Stop every strict-mode window and lift a block that is running now. */
export function clearHabitBlocks(): void {
  try {
    native()?.clearHabitBlocks?.();
  } catch {
    // nothing scheduled
  }
}

/** The strict window running right now (set by the extension), or null. */
export function getActiveHabitBlock(): ActiveHabitBlock | null {
  const fn = native()?.getActiveHabitBlock;
  if (!fn) return null;
  try {
    return fn() ?? null;
  } catch {
    return null;
  }
}

/** Lift the running habit block now and keep `habitId` (or the running habit) unblocked for the rest of today. */
export function endActiveHabitBlock(habitId?: string): void {
  try {
    native()?.endActiveHabitBlock?.(habitId ?? null);
  } catch {
    // nothing to lift
  }
}

// ── US-096: unlock with intention ─────────────────────────────────────────

export interface UnlockResult {
  ok: boolean;
  /** ms since epoch the apps block again */
  until?: number;
  /** 'notBlocked', a DeviceActivityCenter.MonitoringError case, 'unsupported' or 'nativeError' */
  error?: string;
}

/** Lift the running strict / block-hours shield for `minutes` (1–30, never more); iOS re-blocks on its own. */
export function unlockFor(minutes: number): UnlockResult {
  const fn = native()?.unlockFor;
  if (!fn) return { ok: false, error: 'unsupported' };
  try {
    const r = fn(minutes);
    return { ok: !!r?.ok, ...(r?.until ? { until: Number(r.until) } : {}), ...(r?.error ? { error: String(r.error) } : {}) };
  } catch {
    return { ok: false, error: 'nativeError' };
  }
}

/** End an unlock early and block again. */
export function relockNow(): boolean {
  try {
    return !!native()?.relockNow?.();
  } catch {
    return false;
  }
}

/** ms since epoch the current unlock ends, or null. */
export function getUnlockUntil(): number | null {
  try {
    return native()?.getUnlockUntil?.() ?? null;
  } catch {
    return null;
  }
}

/** True once when "Unlock with intention" was tapped on the block screen in the last 10 minutes. */
export function consumeUnlockRequest(): boolean {
  try {
    return !!native()?.consumeUnlockRequest?.();
  } catch {
    return false;
  }
}
