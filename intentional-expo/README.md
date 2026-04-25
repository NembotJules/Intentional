# Intentional (Expo)

Intentional is an iPhone-first, local-first attention ledger:

```text
life pillars -> daily actions -> focus sessions -> insights
```

- **Stack:** Expo SDK 54, React Native, Expo Router, expo-sqlite, NativeWind
- **Design:** Quiet Ledger tokens and fonts in `constants/design.ts` and `tailwind.config.js`
- **Node:** 20.19.4+ required
- **Run:** `npm install`, then `npm start`
- **Test:** `npm test` and `npx tsc --noEmit`

Android and web are development/demo surfaces for v1. iOS Family Controls app blocking requires a custom iOS build; it is not available in Expo Go.

## Structure

- `app/` — Expo Router screens and tabs
- `db/` — SQLite schema, migrations, API helpers, and web test stub
- `services/` — notifications, focus/session helpers, and app blocking
- `components/` — shared Quiet Ledger primitives
- `constants/design.ts` — color, radius, spacing, and font tokens

## MVP Notes

The MVP has no premium gates. Real RevenueCat subscriptions, accounts, cloud sync, widgets, and Android app-blocking parity are out of scope until product explicitly promotes them.
