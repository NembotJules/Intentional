/**
 * Default entry: re-exports native implementation.
 * Metro resolves to index.native.ts (iOS/Android) or index.web.ts (web).
 */
export { initDb, db, getSetting, setSetting } from './index.native';
