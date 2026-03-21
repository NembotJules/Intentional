# Intentional (Expo)

Cross-platform version of **Intentional** — goal and focus tracking for iOS and Android.

- **Stack:** Expo SDK 55, React Native, Expo Router, expo-sqlite (local DB)
- **Node:** 20.19.4+ required (or use Node 18 with the postinstall patch). Prefer: `nvm use` if you have `.nvmrc`, or install from [nodejs.org](https://nodejs.org).
- **Run:** `npm install` (applies Node 18 patch if needed), then `npm start` — press `i` for iOS or `a` for Android, or scan with Expo Go
- **First launch:** Onboarding (4 steps) → Today tab. Add goals in Goals, start sessions from Today or Focus

## Structure

- `app/` — Expo Router: `index` (redirect), `onboarding`, `(tabs)/today|focus|insights|goals`
- `db/` — SQLite schema, `api.ts` (CRUD), `hooks.ts` (useGoals, useTodaySections, etc.)
- `components/` — GoalChip, PrimaryButton, ActionRow, TodayScoreRing
- `constants/design.ts` — Colors, Spacing, Radius, FontSize

## Migration

This app is the Expo migration of the native iOS (Swift/SwiftUI) version. See `Intentional_Expo_Migration_Plan.md` in the repo root.
