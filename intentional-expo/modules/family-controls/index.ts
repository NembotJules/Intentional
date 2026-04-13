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

// ── Lazy native module loader (safe — never throws on non-iOS) ────────────
let _native: {
  requestAuthorization: () => Promise<string>;
  getAuthorizationStatus: () => string;
  applyShields: (encoded: string) => boolean;
  removeShields: () => void;
  presentActivityPicker: (current: string | null) => Promise<string | null>;
} | null = null;

function native() {
  if (Platform.OS !== 'ios') return null;
  if (!_native) {
    try {
      // requireNativeModule throws if the module wasn't compiled in —
      // e.g. inside Expo Go or a stale build without the local module.
      const { requireNativeModule } = require('expo-modules-core');
      _native = requireNativeModule('FamilyControls');
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
  native()?.removeShields();
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
