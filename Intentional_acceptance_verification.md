# INTENTIONAL — Acceptance verification (Expo)

**Codebase:** `intentional-expo/` (React Native + Expo). Native Swift in this repo is **out of scope** for this checklist.

**Legend:** **Met** · **Partial** · **Not met**

**Last reviewed:** 2026-04-13 · Wave 8 — US-040 Smart Suggestion Engine (against `intentional-expo` source).



## Table of contents

- [How to use this file](#toc-how-to-use)
- [Summary](#toc-summary)
- [1. Onboarding](#toc-1-onboarding)
- [2. Data layer](#toc-2-data-layer)
- [3. Meta goals](#toc-3-meta-goals)
- [4. Daily actions](#toc-4-daily-actions)
- [5. Focus session](#toc-5-focus-session)
- [6. Insights](#toc-6-insights)
- [7. Ambient layer](#toc-7-ambient-layer)
- [8. Settings & account](#toc-8-settings-account)
- [9. Monetisation](#toc-9-monetisation)
- [10. Onboarding & entry (edge cases)](#toc-10-onboarding-entry-edge-cases)
- [Change log](#toc-change-log)

*Section numbers and groupings match `[Intentional_user_stories.md](Intentional_user_stories.md)` — on purpose.*

---



## How to use this file

1. When you implement or fix a story, update its **Status** and **Verification** rows.
2. Prefer **Partial** when some acceptance criteria are still missing or stubbed.
3. Manual checks assume a **device or simulator** with a fresh install or known data state.

---



## Summary


| Version      | Met | Partial                                                                             | Not met |
| ------------ | --- | ----------------------------------------------------------------------------------- | ------- |
| **MVP** (37) | 34  | 2 (US-024 pause partial; US-026 FamilyControls — compiled, pending real EAS build test) | 1 (US-024 blocking copy) |
| **v1.1+**    | 13 *(US-030/044 early + Wave 3–5 + US-006/007 MVP closed)* | 2 (US-047/048 — RevenueCat stub, Partial pending real API keys) | CloudKit remain |
| **v2.0**     | 1 (US-040 suggestion engine) | — | 1 (US-043 iCloud sync — deferred) |


**MVP gaps remaining:** US-026 (FamilyControls module written + wired, but EAS iOS build required to test on device); US-024 (pause works, OS blocking copy only). All other MVP stories are **Met**.

---



## 1. ONBOARDING


| ID     | Version | Status      | How to verify                                                                                                                                                              |
| ------ | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-001 | MVP     | **Met**     | Cold start with onboarding not completed: brutalist welcome, quote, body copy, **Begin** → problem → system flow; **Skip to setup** after problem jumps to meta goal step. |
| US-002 | MVP     | **Met**     | On meta goal step: name max 30, ≥7 colors, preview pill, cannot continue empty; primary CTA reflects accent.                                                               |
| US-003 | MVP     | **Met**     | Habit/session, parent pill, presets 25/45/60/90/120, **Custom** chip + text input for arbitrary minutes.                                                                   |
| US-004 | MVP     | **Met**     | Why step: 140 cap, live counter, example block, **Skip for now**; skip still completes flow.                                                                               |
| US-005 | MVP     | **Met**     | Seven segments; active `#e8e4dc` (slightly wider), done `#2e2e2e`, remaining `#1e1e1e`.                                                                                    |
| US-006 | MVP     | **Met**     | **Add another pillar** (up to 5), all saved; already-used swatches dimmed with ✕. Step 4 now cycles through each pillar in sequence — each gets its own action name/type/duration form. Actions for all pillars are saved on `finish`. Draft persists per-pillar action fields (v3 draft format). |


---



## 2. DATA LAYER


| ID     | Version | Status      | How to verify                                                                                                                                                                                            |
| ------ | ------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-007 | MVP     | **Met**     | All tables present; `PRAGMA foreign_keys = ON` at module level. `runMigrations()` in `db/index.native.ts`: reads `db_schema_version` from settings, applies each pending migration in version order, stamps the final version. Fresh installs skip migrations and get stamped at CURRENT\_VERSION (v1) immediately after `initDb()`. Future schema changes add to the `MIGRATIONS` array — no manual `ALTER TABLE` required. |


---



## 3. META GOALS


| ID     | Version | Status      | How to verify                                                                                                                                                                       |
| ------ | ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-008 | MVP     | **Met**     | Goals tab: active goals, color, name, action count, weekly hours, order matches `sort_order`.                                                                                       |
| US-009 | MVP     | **Met**     | **+** or Today FAB → create goal → appears in list; can save with zero actions.                                                                                                     |
| US-010 | MVP     | **Met**     | Long-press goal card → reorder mode → arrows change order; restart app → order persists; Today/Insights order matches.                                                              |
| US-011 | MVP     | **Met**     | Swipe Archive (or web Archive control) → goal hidden from list/Today; archived data not deleted from DB.                                                                            |
| US-012 | v1.1    | **Met**     | Goal Detail → **Edit goal** toggle reveals inline form: name (max 30), emoji icon, 4-color picker, why (max 140). **Save changes** persists immediately; all screens update on refocus. |
| US-013 | v1.1    | **Met**     | Goal Detail shows lifetime hours, current streak (today-aware, max across actions), best streak, why, full action list with ↑/↓ reorder, edit pen, and pause/resume toggle. Session history link present. |


---



## 4. DAILY ACTIONS


| ID     | Version | Status      | How to verify                                                                                                               |
| ------ | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------- |
| US-014 | MVP     | **Met**     | Today: actions grouped under goal headers; type, target, today minutes; completed rows dimmed (~0.45 opacity).              |
| US-015 | MVP     | **Met**     | **START** on session row → Focus prepare with correct goal/action; duration prefilled from action, changeable before start. |
| US-016 | MVP     | **Met**     | Habit row: tap to complete, tap again to undo same day; score ring updates.                                                 |
| US-017 | MVP     | **Met**     | Add/edit actions from Goals sheet (and goal detail → edit flow).                                                            |
| US-018 | MVP     | **Met**     | Goals editor: active action rows show ↑/↓ arrows; order persisted via `reorderActions`; boundary arrows disabled.          |
| US-019 | MVP     | **Met**     | Today: swipe **Off** → deactivate; row gone from Today; restore from Goals editor for that goal.                            |
| US-020 | v1.1    | **Met**     | Daily reminder toggle + HH:MM input in action composer (`goals.tsx`). `scheduleActionReminder` / `cancelActionReminder` in `services/notifications.ts`. Fires daily via `expo-notifications`. |
| US-021 | v1.1    | **Met**     | Goal Detail → pen icon on any action → inline action form on same screen: name, type, duration, reminder toggle/time. History unchanged. Also still available via Goals sheet. |


---



## 5. FOCUS SESSION


| ID     | Version | Status      | How to verify                                                                                                  |
| ------ | ------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| US-022 | MVP     | **Met**     | Run session: countdown, MM:SS or H:MM:SS, goal/action visible, goal accent.                                    |
| US-023 | MVP     | **Met**     | Presets 25/45/60/90/120 + Custom on Focus prepare; aligned with onboarding.                                    |
| US-024 | MVP     | **Partial** | Pause freezes timer; resume continues. **Gap:** no real OS blocking to suspend/resume (copy only).             |
| US-025 | MVP     | **Met**     | **END** → confirm → partial seconds saved → Session Complete.                                                  |
| US-026 | MVP     | **Partial** | Full native module written (`modules/family-controls/`): Swift auth, shields, `FamilyActivityPicker` presenter. Service layer `services/appBlocking.ts` wires apply/remove around every Focus session lifecycle event. Settings screen shows native picker UI when module is compiled in; falls back to checkbox UI in Expo Go / web. Config plugin adds `com.apple.developer.family-controls` entitlement and sets min iOS 16. **Requires EAS iOS build** to exercise on-device — cannot run in Expo Go or web. |
| US-027 | MVP     | **Met**     | Ring tracks elapsed; color matches goal; SVG smooth update each second.                                        |
| US-028 | MVP     | **Met**     | Timer completes → complete screen with burst, time, streak, **Back to Today**.                                 |
| US-029 | MVP     | **Met**     | Optional note ≤280 chars; saved on session; visible in **Session history** screen.                             |


---



## 6. INSIGHTS


| ID     | Version | Status            | How to verify                                                                                                |
| ------ | ------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| US-030 | v1.1    | **Met** *(early)* | Goals / Insights / Goal detail → **Session history**; filter by range + goal; note + partial/complete shown. |
| US-031 | MVP     | **Met**           | Bar chart per goal, goal colors, hours one decimal, max bar = 100% width.                                    |
| US-032 | MVP     | **Met**           | Radar updates with range; vertex colors; imbalanced shape visible (check ≥3 goals).                          |
| US-033 | MVP     | **Met**           | Streak cards: action name in goal color, current + best; habit vs session logic.                             |
| US-034 | MVP     | **Met**           | Three summary cells above chart; update when WK/MO/ALL changes.                                              |
| US-035 | MVP     | **Met**           | WK / MO / ALL toggles; default WK.                                                                           |
| US-036 | v1.1    | **Met**           | `app/weekly-review.tsx`: write three-field reflection for the current week; saves to `weekly_reviews` SQLite table (upsert by `week_start`). Sunday 8 PM notification via `scheduleWeeklyReviewReminder`. Toggle in Settings. Link from Insights. |
| US-037 | v1.1    | **Met**           | `app/reviews-history.tsx`: all past reviews in reverse chron order; each shows all three fields and week label; empty state with CTA. Accessible via **View past reviews** link on the write screen. |


---



## 7. AMBIENT LAYER


| ID     | Version | Status      | How to verify                              |
| ------ | ------- | ----------- | ------------------------------------------ |
| US-038 | v1.1    | **Met**     | Goal Detail → **Create goal wallpaper** → `GoalWallpaperSheet`: renders a 390×844 styled card (icon, name, accent bar, Why, date stamp), captures it with `react-native-view-shot`, saves PNG to Camera Roll via `expo-media-library` (permission-gated) or shares via `expo-sharing`. |
| US-039 | v1.2    | **Dropped** | Removed from scope. The goal wallpaper generator (US-038) covers the same "keep your goals visible" benefit — set it as your lock screen once and it's always present. A home screen widget would duplicate that value at high native implementation cost. |
| US-040 | v2.0    | **Met**     | Rule-based suggestion engine in `services/suggestions.ts` (5 rules: streak_at_risk, best_time, overdue, goal_neglect, momentum). `SuggestionCard` component with slide-in animation shown on Today screen above action list. Dismiss persists for the calendar day via AsyncStorage. CTA navigates directly to the Focus screen or marks a habit done inline. Requires ≥2 days of data for streak rules; ≥7 sessions in 14 days for best_time rule. |


---



## 8. SETTINGS & ACCOUNT


| ID     | Version | Status      | How to verify                                                                                                          |
| ------ | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| US-041 | MVP     | **Partial** | Settings: toggle categories persisted; copy explains iOS behavior. **Gap:** no enforcement in Expo Go / current build. |
| US-042 | v1.1    | **Met**     | Settings → **All actions** section: flat list of every action across all goals, grouped by goal header; flash icon toggles `is_active` inline; shows type, duration, reminder time. |
| US-043 | v2.0    | **Not met** | No iCloud sync.                                                                                                        |
| US-044 | v2.0    | **Met** *(early)* | Settings → **Data** → **Export sessions as CSV** → `expo-file-system` writes CSV (date, goal, action, duration\_minutes, completed, note) to cache; `expo-sharing` opens the share sheet. |
| US-045 | v1.1    | **Met**     | Settings → **Data** section → **Delete all data** → modal with type-"DELETE" confirmation; clears all SQLite tables + onboarding flag → returns to onboarding. |


---



## 9. MONETISATION


| ID     | Version | Status      | How to verify                                    |
| ------ | ------- | ----------- | ------------------------------------------------ |
| US-046 | MVP     | **Met**     | No paywall in MVP flows; no ads in session path. |
| US-047 | v1.1    | **Partial** | `services/purchases.ts` stub with full RevenueCat API shape. `PaywallSheet` shows monthly/annual plans, feature list, Subscribe CTA. Gates: Goal Detail, Session History, Weekly Review, Action Reminders. Swap real keys when RevenueCat account is ready. |
| US-048 | v1.1    | **Partial** | "Restore purchases" in Settings → Subscription section. `restorePurchases()` stub simulates the RevenueCat restore call. Full flow testable end-to-end with DEV toggle. |


---



## 10. ONBOARDING & ENTRY (EDGE CASES)


| ID     | Version | Status      | How to verify                                                                                                                                        |
| ------ | ------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| US-049 | MVP     | **Met**     | With **no active goals that have active actions**, Today shows **Start by adding your first pillar** + **SET UP GOALS** (Goals tab). Goal filter hidden until there is at least one section; stale goal chip resets to **All**. |
| US-050 | MVP     | **Met**     | Why step skippable; lands on Ready / finish path.                                                                                                    |
| US-051 | MVP     | **Met**     | Draft written from step 0 onward; kill and relaunch returns to the exact step with all data intact.                                                  |
| US-052 | MVP     | **Met**     | `hasCompletedOnboarding` false → `/onboarding`; true → `/(tabs)/today`.                                                                              |
| US-053 | MVP     | **Met**     | Settings → **Replay onboarding** → confirm → cold navigation shows onboarding; existing goals: finish without duplicating rows.                      |


---



## Change log


| Date       | Change                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-09 | Initial checklist from `intentional-expo` audit.                                                                                          |
| 2026-04-09 | Table of contents + explicit `toc-…` anchors so jumps work across GitHub / VS Code / Cursor (headings with `&` are awkward to auto-slug). |
| 2026-04-11 | **US-049:** Today empty state for zero actions (`today.tsx`); verification counts updated. |
| 2026-04-12 | **US-018:** Action reorder arrows in Goals editor. **US-003/023:** 45 min preset + Custom in onboarding and Focus. **US-005:** Progress bar spec hex colors. **US-006:** Used-color dimming in onboarding. **US-007:** `PRAGMA foreign_keys = ON`. **US-051:** Step-0 draft persistence. Summary updated. |
| 2026-04-12 | **Wave 3 — v1.1:** **US-020** daily action reminders via `expo-notifications`. **US-036/037** weekly review write screen + history browse. **US-042** all-actions flat list in Settings. **US-045** delete-all-data with type-DELETE modal. |
| 2026-04-12 | **Wave 4 — Polish + Export:** **US-006** onboarding action step now cycles through every pillar. **US-012/013/021** Goal Detail fully rewritten — inline name/color/why/icon edit, current+best streak, inline action edit and reorder. **US-044** CSV export via `expo-file-system` + `expo-sharing` from Settings Data section. |
| 2026-04-12 | **Wave 5 — DB Migrations + Wallpaper:** **US-007** versioned migration runner (`runMigrations`) with `db_schema_version` stamp — schema evolution no longer needs manual SQL. **US-038** `GoalWallpaperSheet` captures a styled 390×844 PNG with `react-native-view-shot` and saves to Camera Roll or shares. |
| 2026-04-13 | **Wave 6 — Branding + Haptics + Polish:** App renamed "Intentional". Splash background `#0e0e0e`. `utils/haptics.ts` wrapper fires haptics on habit check, session start/end, archive, reorder. Onboarding steps slide + fade on every step change (direction-aware). |
| 2026-04-13 | **RevenueCat stub — US-047/048:** `services/purchases.ts` with full RC API shape (stub). `components/PaywallSheet.tsx` shows monthly/annual plans + feature list. `hooks/usePremium.ts` `requirePremium()` helper. Paywall gates wired to Goal Detail, Session History, Weekly Review, Action Reminders. Subscription section added to Settings with Restore + DEV toggle. |
| 2026-04-13 | **Wave 8 — Smart Suggestion Engine (US-040):** Rule-based engine (`services/suggestions.ts`) fires 5 rules in priority order: streak at risk → best focus hour → overdue action → goal neglect → momentum. `SuggestionCard` component slides in on Today screen, shows CTA per rule type, dismiss persists for the rest of the calendar day. DB helpers `isActionLoggedTodaySync`, `getLastSessionDateForAction`, `getRecentSessionsCompact`, `getSessionCountForGoalSince`, `getTotalSessionCountForGoal` added to `db/api.ts`. |
| 2026-04-13 | **Wave 7 — FamilyControls (US-026):** `modules/family-controls/` local Expo module with Swift (`FamilyControlsModule.swift`) implementing `requestAuthorization`, `getAuthorizationStatus`, `applyShields`, `removeShields`, `presentActivityPicker`. `services/appBlocking.ts` service layer. Focus screen wired: shields applied at session start, removed on complete/abort/navigate-away. Settings screen shows dual UI — native `FamilyActivityPicker` button when module is compiled in, checkbox fallback otherwise. Config plugin `plugins/withFamilyControls.js` injects entitlement + iOS 16 deployment target. |


