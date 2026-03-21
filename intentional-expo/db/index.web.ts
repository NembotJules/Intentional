/**
 * Web stub: expo-sqlite uses WASM on web and causes Metro resolution errors.
 * This file is used when bundling for web so expo-sqlite is never imported.
 * Data is in-memory only; use iOS/Android for full SQLite.
 */

const settings = new Map<string, string>();

const db = {
  getAllSync: <T>(_query: string, _params?: unknown[]): T[] => [],
  getFirstSync: <T>(_query: string, _params?: unknown[]): T | null => null,
  runSync: (_query: string, _params?: unknown[]): void => {},
};

export function initDb(): void {}

export { db };

export function getSetting(key: string): string | null {
  return settings.get(key) ?? null;
}

export function setSetting(key: string, value: string): void {
  settings.set(key, value);
}
