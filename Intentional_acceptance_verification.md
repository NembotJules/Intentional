# Intentional — Acceptance criteria verification

**Purpose:** For every user story, each acceptance criterion (AC) must have an explicit **status** and **human-verifiable** steps. Agents should update this file when implementation changes. Humans use this as a QA script.

---

## Status labels


| Label       | Meaning                                                                        |
| ----------- | ------------------------------------------------------------------------------ |
| **Met**     | Behaviour matches the AC in production build / Expo Go on device or simulator. |
| **Not met** | Missing or wrong behaviour.                                                    |
| **Partial** | Works on some platforms or edge cases fail; note **Gap**.                      |


**How to record:** Copy the AC verbatim (or cite `Intentional_user_stories.md` §) and assign one status per bullet. Never mark **Met** without a human (or scripted) check.

---

## How a human runs a check (general)

1. **Environment:** Expo Go or dev client on **real device or simulator** (gestures differ on web).
2. **Data:** Use a **fresh install** or clear app data when testing first-launch / onboarding stories.
3. **Evidence:** For each AC: perform the steps → observe UI or DB → tick **Met** / **Not met** / **Partial** in your tracker.
4. **Persistence:** Background the app (home button) and reopen when the AC mentions relaunch.

---

## Product owner validation (sign-off)

Use this block when **you** (product owner / human) confirm the app matches the stories below. Run the **Human verification** steps in each section above; tick only after you have **personally** seen the behaviour on your target platform (iOS simulator, device, or web).

### Bundle: Data layer + Goals Manager + entry routing (current scope)

**Status: signed off** — Product owner confirmed this bundle is acceptable (verbal / chat), March 2026. Scripted line-by-line QA optional for a future pass.

| Story                                    | Engineering status                                                                   | Your validation |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | --------------- |
| **US-007** · SQLite schema               | All AC **Met**                                                                       | ☑ **Accepted** — PO sign-off |
| **US-008** · View all goals              | All AC **Met**                                                                       | ☑ **Accepted** — PO sign-off |
| **US-009** · Add goal after onboarding   | All AC **Met**                                                                       | ☑ **Accepted** — PO sign-off |
| **US-010** · Reorder goals               | AC1 **Partial** (reorder **mode + ↑↓**, not free drag; Expo Go–safe) · AC2–4 **Met** | ☑ **Accepted** — PO accepts reorder mode + arrows (not literal drag) |
| **US-011** · Archive goal                | AC1 **Partial** on web (button vs swipe) · AC2–4 **Met**                             | ☑ **Accepted** — PO sign-off |
| **US-052** · Onboarding navigation guard | All AC **Met**                                                                       | ☑ **Accepted** — PO sign-off |


### Explicitly **not** in this “implemented successfully” bundle


| Story                                  | Status                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **US-051** · Onboarding draft persists | **Not met** — do **not** sign off until AsyncStorage (or equivalent) is implemented and AC rows are updated to **Met**. |


### Sign-off

| Field | Your entry |
| ----- | ---------- |
| **Validated by** | Product owner (Nembot Jules) |
| **Date** | 2026-03-21 |
| **Build** | Expo Go / `intentional-expo` — see git commit on `develop` after this sign-off |
| **Notes** | PO confirmed “OK” via project chat; full checkbox walkthrough deferred for time. **US-010:** accepted reorder mode + ↑/↓. **US-051** still not in scope. |


**Definition of “successfully implemented” for the table above:** Every story marked **Met** (or **Partial** where you ticked acceptance) has been exercised using the human steps in this document; **US-051** is out of scope until its rows read **Met**.

---

## US-007 · SQLite schema (core entities)


| #   | Acceptance criterion                                                                                     | Status  | Human verification                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Three core tables: `meta_goals`, `daily_actions`, `focus_sessions`                                       | **Met** | Complete onboarding once. In code review: open `intentional-expo/db/index.native.ts` and confirm three `CREATE TABLE` statements exist. Optional: inspect DB with a SQLite viewer on rooted/sim exports. |
| 2   | `meta_goals` has id, name, color, icon, sort_order, why_statement, is_archived                           | **Met** | Create a goal with name/color/why in app; kill app and reopen → goal still listed with same fields.                                                                                                      |
| 3   | `daily_actions` has id, goal_id, name, type, target_minutes, reminder_time, is_active, sort_order        | **Met** | Add a session and a habit action; reopen app → both still appear under the goal on Goals and Today.                                                                                                      |
| 4   | `focus_sessions` has id, action_id, goal_id, started_at, ended_at, duration_seconds, note, was_completed | **Met** | Run a focus session to completion; open Insights or DB → a row exists with plausible timestamps and duration.                                                                                            |
| 5   | Every `daily_actions.goal_id` references `meta_goals.id`                                                 | **Met** | Code: `REFERENCES meta_goals(id)` in schema. Runtime: add action only via UI (should always attach to valid goal).                                                                                       |
| 6   | Schema idempotent on launch; upgrades don’t wipe data without migration                                  | **Met** | Cold start app twice; data unchanged. (Full migration testing needs version bumps—document when you add migrations.)                                                                                     |
| 7   | Supporting tables allowed (habits, settings)                                                             | **Met** | Toggle a habit done → persists after relaunch. Complete onboarding → `hasCompletedOnboarding` survives relaunch.                                                                                         |


---

## US-008 · View all goals


| #   | Acceptance criterion                                      | Status  | Human verification                                                                                                                                                     |
| --- | --------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Goals Manager shows all active (non-archived) goals       | **Met** | Open **Goals** tab. Count goals matches DB/active only. Archive one → it **disappears** from this list.                                                                |
| 2   | Each goal: color accent, name, action count, weekly hours | **Met** | For each card: left accent matches goal color; title = name; subtitle shows “N daily action(s)”; right shows “X.Xh” **This Week**.                                     |
| 3   | Goals in user-defined sort order                          | **Met** | Long press → **Reorder goals** mode → **↑ / ↓** to swap → **Done**. Order on list matches. Switch to **Today** → goal groups appear in **same order** (top to bottom). |


---

## US-009 · Add a new goal after onboarding


| #   | Acceptance criterion                               | Status  | Human verification                                                                                                                                                                                                          |
| --- | -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | “+” on Goals Manager opens Create Goal flow        | **Met** | Tap **+** in Goals header **or** **Add Goal** card → sheet opens. **Also:** Today’s floating **+** and Focus empty-state **Add goal** use `?create=1` so the **create sheet opens in one tap** (no second tap on Add Goal). |
| 2   | New goal appears in list immediately after save    | **Met** | Enter name → **Save Goal** → sheet closes and new row appears **without** restarting app.                                                                                                                                   |
| 3   | New goal has zero actions and zero hours initially | **Met** | After save, card shows **0 daily actions** and **0.0h** This Week before adding any action.                                                                                                                                 |


---

## US-010 · Reorder goals


| #   | Acceptance criterion                           | Status      | Human verification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Long press on goal card activates reorder mode | **Partial** | **Implementation:** Long press enters **reorder mode** (not free drag)—use **↑ / ↓** to swap rows; tap **Done** in header to exit. **Why:** `react-native-draggable-flatlist` caused a **Worklets JS/native mismatch in Expo Go**; this flow is Expo Go–safe. **Gap vs literal AC:** story text says “drag-to-reorder”; behaviour is **long press → reorder mode + arrows** (same persistence outcome). **Web:** same long press + arrows (no swipe archive column conflict). Human: long press a goal → title **Reorder goals** → tap arrows → **Done** → order updates on **Today**. |
| 2   | Reordered position persisted immediately       | **Met**     | Reorder → kill app → reopen → order unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 3   | Today reflects new order                       | **Met**     | Reorder goals → open **Today** → sections (goal headers) follow new top-to-bottom order.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 4   | Insights reflects new order                    | **Met**     | Reorder goals → open **Insights** (with session data) → "Time per goal" bars and radar legend follow **goal order** from Goals Manager, not descending hours.                                                                                                                                                                                                                                                                                                                                                                                                                          |


---

## US-011 · Archive a goal


| #   | Acceptance criterion                                      | Status      | Human verification                                                                                                                                                                                                                     |
| --- | --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Swipe left on card reveals Archive                        | **Partial** | **Met** on **iOS/Android** (swipe left → red Archive). **Gap:** **Web**—tap **Archive** column beside card. Human: verify archive **action** exists and works on each platform you ship.                                               |
| 2   | Archived hidden from Today, Insights (active), Goals list | **Met**     | Archive a goal → it vanishes from **Goals** list, **Today** sections, and Insights goal lists.                                                                                                                                         |
| 3   | Historical FocusSessions for goal preserved               | **Met**     | Before archive, note total hours / session count in Insights. Archive → historical totals that include that goal’s past sessions should still be consistent (sessions not deleted). Spot-check via DB or session history if available. |
| 4   | Archived goals never permanently deleted                  | **Met**     | Code review: `archiveGoal` sets `is_archived = 1`; no `DELETE FROM meta_goals`.                                                                                                                                                        |


---

## US-051 · Onboarding draft persists


| #   | Acceptance criterion                                            | Status      | Human verification                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Draft fields saved after each step (AsyncStorage or equivalent) | **Not met** | **Gap:** No `AsyncStorage` usage in `intentional-expo` yet. Human: mid-onboarding enter goal name → background app → force-stop → reopen → **expected after fix:** data restored. |
| 2   | Relaunch mid-onboarding returns to same step with data          | **Not met** | Same as above; currently in-memory state is lost on process death.                                                                                                                |
| 3   | Draft cleared when onboarding completes                         | **Not met** | Depends on (1); after fix, complete onboarding → inspect storage keys cleared.                                                                                                    |


---

## US-052 · Onboarding navigation guard


| #   | Acceptance criterion                                                 | Status  | Human verification                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Until onboarding complete, cold start does not show main tabs        | **Met** | Clear data / fresh install → app opens **onboarding** (not tab shell).                                                                                                                                                      |
| 2   | After onboarding complete, user enters main app even with zero goals | **Met** | Finish onboarding with one goal then delete all actions/goals if possible—or use build with empty post-onboarding; `hasCompletedOnboarding` true → **Today** shows (empty state per US-049), not forced back to onboarding. |
| 3   | Empty post-onboarding UX is US-049, not re-onboarding                | **Met** | With onboarding flag set and no goals, user stays in tabs; empty states show CTAs (verify against US-049 separately).                                                                                                       |


---

## Maintenance rule (agents & humans)

- When you implement or change a feature, **update the row** for that story in this file the same PR/session.
- If a story is not listed here yet, add a section using the same table format before merging “done” work.

*Last reviewed: PO sign-off recorded for US-007–011 + US-052 bundle; US-051 outstanding.*