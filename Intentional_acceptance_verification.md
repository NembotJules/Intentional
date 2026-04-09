# INTENTIONAL — Acceptance verification (Expo)

**Codebase:** `intentional-expo/` (React Native + Expo). Native Swift in this repo is **out of scope** for this checklist.

**Legend:** **Met** · **Partial** · **Not met**

**Last reviewed:** 2026-04-09 (against `intentional-expo` source).

<a id="toc-table-of-contents"></a>

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

*Section numbers and groupings match [`Intentional_user_stories.md`](Intentional_user_stories.md) — on purpose.*

---

<a id="toc-how-to-use"></a>

## How to use this file

1. When you implement or fix a story, update its **Status** and **Verification** rows.
2. Prefer **Partial** when some acceptance criteria are still missing or stubbed.
3. Manual checks assume a **device or simulator** with a fresh install or known data state.

---

<a id="toc-summary"></a>

## Summary

| Version   | Met | Partial | Not met |
|----------|-----|---------|---------|
| **MVP** (37) | 26 | 9 | 2 |
| **v1.1+**    | —  | several implemented early (e.g. session history); most v1.1 items still **Not met** | |

**MVP gaps to prioritize:** US-018 (action reorder UI), US-049 (Today empty state), US-026 (real blocking — likely deferred in Expo); then polish **Partial** items: US-003, US-005, US-006, US-007, US-023, US-024, US-041, US-051.

---

<a id="toc-1-onboarding"></a>

## 1. ONBOARDING

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-001 | MVP | **Met** | Cold start with onboarding not completed: brutalist welcome, quote, body copy, **Begin** → problem → system flow; **Skip to setup** after problem jumps to meta goal step. |
| US-002 | MVP | **Met** | On meta goal step: name max 30, ≥7 colors, preview pill, cannot continue empty; primary CTA reflects accent. |
| US-003 | MVP | **Partial** | Habit/session and parent pill OK. Session durations: 25/45/60/90/120 presets OK. **Gap:** no **custom** minutes on onboarding action step. |
| US-004 | MVP | **Met** | Why step: 140 cap, live counter, example block, **Skip for now**; skip still completes flow. |
| US-005 | MVP | **Partial** | Seven segments visible across steps. **Gap:** segment colors not the spec hex (`#e8e4dc` / `#2e2e2e` / `#1e1e1e`). |
| US-006 | MVP | **Partial** | **Add another pillar** (up to 5), all saved. **Gaps:** no unique-color / already-used indication; only **first** pillar receives the single onboarding **daily action**. |

---

<a id="toc-2-data-layer"></a>

## 2. DATA LAYER

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-007 | MVP | **Partial** | Inspect `intentional-expo/db/index.native.ts`: core tables + `habit_completions` + `settings`. **Gaps:** `PRAGMA foreign_keys` not enabled; no versioned migration runner (only `CREATE IF NOT EXISTS`). |

---

<a id="toc-3-meta-goals"></a>

## 3. META GOALS

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-008 | MVP | **Met** | Goals tab: active goals, color, name, action count, weekly hours, order matches `sort_order`. |
| US-009 | MVP | **Met** | **+** or Today FAB → create goal → appears in list; can save with zero actions. |
| US-010 | MVP | **Met** | Long-press goal card → reorder mode → arrows change order; restart app → order persists; Today/Insights order matches. |
| US-011 | MVP | **Met** | Swipe Archive (or web Archive control) → goal hidden from list/Today; archived data not deleted from DB. |
| US-012 | v1.1 | **Partial** | Name/color editable via **Goals** modal (**Edit goal**), not strictly inline on `goal/[id].tsx`. |
| US-013 | v1.1 | **Partial** | Goal detail: why, actions list, lifetime hours, best streak, session history link. **Gaps:** no full **current** streak on detail; action reorder inline; wallpaper is placeholder. |

---

<a id="toc-4-daily-actions"></a>

## 4. DAILY ACTIONS

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-014 | MVP | **Met** | Today: actions grouped under goal headers; type, target, today minutes; completed rows dimmed (~0.45 opacity). |
| US-015 | MVP | **Met** | **START** on session row → Focus prepare with correct goal/action; duration prefilled from action, changeable before start. |
| US-016 | MVP | **Met** | Habit row: tap to complete, tap again to undo same day; score ring updates. |
| US-017 | MVP | **Met** | Add/edit actions from Goals sheet (and goal detail → edit flow). |
| US-018 | MVP | **Not met** | `reorderActions` exists in `db/api.ts` but **no UI** (no long-press or arrows for actions). |
| US-019 | MVP | **Met** | Today: swipe **Off** → deactivate; row gone from Today; restore from Goals editor for that goal. |
| US-020 | v1.1 | **Not met** | No `expo-notifications` reminder UI or scheduling found. |
| US-021 | v1.1 | **Partial** | Edit action name/type/duration in Goals modal; history sessions unchanged. |

---

<a id="toc-5-focus-session"></a>

## 5. FOCUS SESSION

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-022 | MVP | **Met** | Run session: countdown, MM:SS or H:MM:SS, goal/action visible, goal accent. |
| US-023 | MVP | **Partial** | Presets 25/60/90/120 + Custom on Focus prepare. **Gap:** **45** not a preset here (exists in onboarding only). |
| US-024 | MVP | **Partial** | Pause freezes timer; resume continues. **Gap:** no real OS blocking to suspend/resume (copy only). |
| US-025 | MVP | **Met** | **END** → confirm → partial seconds saved → Session Complete. |
| US-026 | MVP | **Not met** | Expo build: badge states blocking unavailable / prefs only; no FamilyControls / Screen Time integration. |
| US-027 | MVP | **Met** | Ring tracks elapsed; color matches goal; SVG smooth update each second. |
| US-028 | MVP | **Met** | Timer completes → complete screen with burst, time, streak, **Back to Today**. |
| US-029 | MVP | **Met** | Optional note ≤280 chars; saved on session; visible in **Session history** screen. |

---

<a id="toc-6-insights"></a>

## 6. INSIGHTS

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-030 | v1.1 | **Met** *(early)* | Goals / Insights / Goal detail → **Session history**; filter by range + goal; note + partial/complete shown. |
| US-031 | MVP | **Met** | Bar chart per goal, goal colors, hours one decimal, max bar = 100% width. |
| US-032 | MVP | **Met** | Radar updates with range; vertex colors; imbalanced shape visible (check ≥3 goals). |
| US-033 | MVP | **Met** | Streak cards: action name in goal color, current + best; habit vs session logic. |
| US-034 | MVP | **Met** | Three summary cells above chart; update when WK/MO/ALL changes. |
| US-035 | MVP | **Met** | WK / MO / ALL toggles; default WK. |
| US-036 | v1.1 | **Not met** | No Sunday review UI or stored reviews. |
| US-037 | v1.1 | **Not met** | Depends on US-036. |

---

<a id="toc-7-ambient-layer"></a>

## 7. AMBIENT LAYER

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-038 | v1.1 | **Not met** | Wallpaper placeholder on goal detail only. |
| US-039 | v1.2 | **Not met** | No WidgetKit / Expo widget implementation. |
| US-040 | v2.0 | **Not met** | No suggestion engine. |

---

<a id="toc-8-settings-account"></a>

## 8. SETTINGS & ACCOUNT

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-041 | MVP | **Partial** | Settings: toggle categories persisted; copy explains iOS behavior. **Gap:** no enforcement in Expo Go / current build. |
| US-042 | v1.1 | **Not met** | No Settings → flat actions list. |
| US-043 | v2.0 | **Not met** | No iCloud sync. |
| US-044 | v2.0 | **Not met** | No CSV export. |
| US-045 | v1.1 | **Not met** | No delete-all-data flow. |

---

<a id="toc-9-monetisation"></a>

## 9. MONETISATION

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-046 | MVP | **Met** | No paywall in MVP flows; no ads in session path. |
| US-047 | v1.1 | **Not met** | No RevenueCat / subscription. |
| US-048 | v1.1 | **Not met** | No restore purchases. |

---

<a id="toc-10-onboarding-entry-edge-cases"></a>

## 10. ONBOARDING & ENTRY (EDGE CASES)

| ID | Version | Status | How to verify |
|----|---------|--------|----------------|
| US-049 | MVP | **Partial** | Insights empty state OK; Goals empty CTA OK. **Gap:** Today with **zero goals/actions** shows **“You crushed today”** instead of setup CTA per spec. |
| US-050 | MVP | **Met** | Why step skippable; lands on Ready / finish path. |
| US-051 | MVP | **Partial** | Kill app mid-onboarding (step ≥1): relaunch returns into flow with draft. **Gap:** step **0** not written to draft payload. |
| US-052 | MVP | **Met** | `hasCompletedOnboarding` false → `/onboarding`; true → `/(tabs)/today`. |
| US-053 | MVP | **Met** | Settings → **Replay onboarding** → confirm → cold navigation shows onboarding; existing goals: finish without duplicating rows. |

---

<a id="toc-change-log"></a>

## Change log

| Date       | Change |
|------------|--------|
| 2026-04-09 | Initial checklist from `intentional-expo` audit. |
| 2026-04-09 | Table of contents + explicit `toc-…` anchors so jumps work across GitHub / VS Code / Cursor (headings with `&` are awkward to auto-slug). |
