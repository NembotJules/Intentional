/**
 * Default entry: re-exports native implementation.
 * Metro resolves to index.native.ts (iOS/Android) or index.web.ts (web).
 */
// Metro resolves index.native.ts on iOS/Android and index.web.ts on web.
export { initDb, runMigrations, db, getSetting, setSetting } from './index.native';
