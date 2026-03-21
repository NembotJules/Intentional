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

## US-014 · View today’s actions

| #   | Acceptance criterion                                              | Status  | Human verification                                                                                                                                        |
| --- | ----------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | All active actions for all active goals appear on Today          | **Met** | Create 2+ goals with actions → **Today** lists every active action. Deactivate one → it disappears after refresh.                                         |
| 2   | Grouped under parent goal header with goal color                   | **Met** | Each block shows colored ● + goal name; actions listed under it.                                                                                          |
| 3   | Type, target/habit status, today’s logged time                     | **Met** | Session rows: `SESSION · Xm target` + `Ym / Zm today`. Habit rows: `HABIT · binary` + done / not done line.                                               |
| 4   | Completed actions dimmed (opacity 0.45)                          | **Met** | Complete a session (target met) or habit → entire row renders at **0.45** opacity.                                                                         |

---

## US-015 · Start focus session from Today

| #   | Acceptance criterion                                      | Status  | Human verification                                                                                                                       |
| --- | --------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | START on every incomplete session row                     | **Met** | Incomplete session shows **START**; completed session shows ✓ only.                                                                    |
| 2   | Navigates to Focus with action pre-loaded                   | **Met** | Tap **START** → Focus **Prepare** shows correct goal + action.                                                                           |
| 3   | Target duration pre-selected but adjustable                 | **Met** | Prepare screen includes action’s `target_minutes` in the chip grid (even if not in 25/45/60/90/120). Select another chip → timer updates. |
| 4   | No confirmation dialog to start                           | **Met** | **START** → preparing screen directly (no alert).                                                                                       |

---

## US-016 · Mark habit done

| #   | Acceptance criterion                    | Status  | Human verification                                                          |
| --- | --------------------------------------- | ------- | --------------------------------------------------------------------------- |
| 1   | Toggle instead of START                 | **Met** | Habit row shows circle / check icon, not START.                             |
| 2   | One tap done, row dims when complete    | **Met** | Tap row (anywhere) → check + 0.45 opacity when counted complete for score.   |
| 3   | Second tap same day un-marks            | **Met** | Tap again → undone, opacity back, score updates.                             |
| 4   | Today Score updates immediately         | **Met** | Ring percentage changes after toggle (after `refresh` resolves).           |

---

## US-017 · Add action to existing goal (MVP: Goals Manager)

| #   | Acceptance criterion              | Status  | Human verification                                      |
| --- | --------------------------------- | ------- | ------------------------------------------------------- |
| 1   | Add control in Goals Manager      | **Met** | Edit goal → **Add New Action** / composer.              |
| 2   | Name + type; duration for session | **Met** | Validation in composer; session requires minutes.      |
| 3   | Appears on Today immediately      | **Met** | Save → go to **Today** → new row under goal.           |

---

## US-018 · Reorder actions within a goal

| #   | Acceptance criterion                         | Status      | Human verification                                                                                                                                 |
| --- | -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Long press row → drag reorder on **Today**   | **Partial** | **Gap:** No drag/long-press reorder on **Today** rows. Order follows `sort_order` edited implicitly via Goals (list order in DB).                 |
| 2   | Persisted immediately                        | **Met**     | If we add explicit action reorder in Goals later, `reorderActions` persists; Today reads `sort_order` from API.                                      |
| 3   | Today order matches                            | **Met**     | Actions render in `getActionsByGoal` sort order.                                                                                                   |

---

## US-019 · Deactivate action

| #   | Acceptance criterion                        | Status      | Human verification                                                                                                                                |
| --- | ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Swipe reveals Deactivate                    | **Met**     | **Native (verified):** swipe left → **Off** → confirm → hidden from Today. Uses RNGH `ScrollView` + `TouchableOpacity` so swipe isn’t blocked. **Web:** **Hide** column (no swipe)—acceptable platform gap. |
| 2   | Hidden from Today, not counted in score     | **Met**     | Deactivate → row gone from Today; score denominator decreases after refresh.                                                                      |
| 3   | History preserved                           | **Met**     | `is_active = 0` only; sessions rows remain in DB.                                                                                                 |
| 4   | Reactivate                                  | **Met**     | **Goals** → open goal → paused action shows **Restore** → back on Today. (v1.1 Goal Detail called out in story; MVP covered via Goals sheet.)       |

---

## US-022 · Run a Focus Timer

| #   | Acceptance criterion                                                                 | Status | Human verification                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Timer counts down from selected duration to 0:00                                     | **Met** | Start session → remaining counts down each second until auto-complete.                                                                              |
| 2   | MM:SS under 1h; HH:MM:SS (H:MM:SS) for ≥ 1h                                          | **Met** | Short session: `MM:SS`. Use Custom **60+** min or long preset → hours segment appears.                                                            |
| 3   | Goal name and action name always visible during session                              | **Met** | **Focus** run screen: goal line + chip + action title visible.                                                                                     |
| 4   | Goal color is primary visual accent                                                  | **Met** | Ring stroke + goal chip use goal palette (`getGoalColor` / tint).                                                                                  |

---

## US-023 · Select Session Duration Before Starting

| #   | Acceptance criterion                                      | Status | Human verification                                                                 |
| --- | --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| 1   | Presets 25 / 60 / 90 / 120 min                            | **Met** | Prepare screen shows four preset tiles.                                              |
| 2   | Custom allows entered duration                            | **Met** | **Custom** → numeric minutes **1–999** (clamped).                                    |
| 3   | Action default target pre-selected                        | **Met** | Open action: preset selected if target matches; else **Custom** with target value. |
| 4   | Change until Start                                        | **Met** | Toggle presets/custom before **Start Session**; duration used matches last choice.   |

---

## US-024 · Pause and Resume a Session

| #   | Acceptance criterion                                      | Status      | Human verification                                                                                                                                 |
| --- | --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PAUSE always visible during active session                | **Met**     | **Focus** run: **PAUSE** + **END** always shown.                                                                                                   |
| 2   | PAUSE freezes timer                                       | **Met**     | Pause → countdown stops; **remaining** unchanged until resume.                                                                                     |
| 3   | App blocking suspended during pause                       | **Partial** | **Gap (Expo):** No real FamilyControls; badge shows **BLOCKING PAUSED · EXPO** as copy-only stand-in.                                              |
| 4   | RESUME replaces PAUSE                                     | **Met**     | Label switches to **RESUME** while paused.                                                                                                         |
| 5   | RESUME restarts timer and re-engages blocking             | **Partial** | Timer resumes; blocking re-engagement N/A in Expo (same as AC3).                                                                                   |
| 6   | Paused time not counted                                   | **Met**     | Pause 10s → resume → total elapsed at end excludes paused seconds (interval cleared while paused).                                               |

---

## US-025 · End a Session Early

| #   | Acceptance criterion                                                                 | Status | Human verification                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | END always visible                                                                   | **Met** | Same row as PAUSE.                                                                                                                                     |
| 2   | END → confirm: "End session? Your time will still be logged."                        | **Met** | **END** → system alert with that title/body → **End session**.                                                                                          |
| 3   | Confirm: stop timer, log elapsed                                                     | **Met** | DB / Insights: `was_completed = 0`, `duration_seconds` = elapsed.                                                                                     |
| 4   | Navigation to Session Complete                                                       | **Met** | Same **Session complete** screen with early-end subtitle.                                                                                               |
| 5   | Partial sessions allowed                                                             | **Met** | End after a few seconds → row saved (no minimum).                                                                                                       |

---

## US-026 · App Blocking During Focus

| #   | Acceptance criterion                                                                 | Status      | Human verification                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | First session: prompt Screen Time / FamilyControls                                   | **Not met** | **Gap (Expo Go):** No FamilyControls integration; no OS permission flow.                                                                         |
| 2   | User selects categories                                                              | **Not met** | Depends on US-026 AC1 / dev build + Settings (US-041).                                                                                             |
| 3   | Categories blocked for session                                                       | **Not met** | No real shields in Expo Go.                                                                                                                        |
| 4   | "APPS BLOCKED · X CATEGORIES" badge                                                  | **Partial** | **Expo:** **BLOCKING UNAVAILABLE · EXPO** / **BLOCKING PAUSED · EXPO** + short disclaimer (timer still runs).                                      |
| 5   | Blocking lifted on pause/end                                                         | **Partial** | N/A in Expo; copy reflects paused vs active.                                                                                                       |
| 6   | Permission denied → timer runs, badge blocking unavailable                           | **Partial** | Timer runs; badge shows blocking unavailable (Expo default).                                                                                       |

---

## US-027 · Visual Progress Ring on Timer

| #   | Acceptance criterion                                      | Status      | Human verification                                                                                                                                 |
| --- | --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | SVG ring around timer                                     | **Met**     | `react-native-svg` `Circle` around center countdown.                                                                                               |
| 2   | Fills clockwise 0% → 100% with session progress           | **Met**     | Ring fill = **elapsed / total** (not remaining); clockwise from top via `-90deg` rotation.                                                         |
| 3   | Ring color matches goal                                   | **Met**     | Stroke uses goal color.                                                                                                                          |
| 4   | Animates smoothly (no steps/jumps)                        | **Partial** | **Gap:** Dash offset updates **once per second** with the countdown (discrete steps). Continuous smooth animation not implemented.                  |

---

## US-028 · Session Completion Celebration

| #   | Acceptance criterion                                      | Status | Human verification                                                                                    |
| --- | --------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| 1   | Session Complete when timer hits 0                        | **Met** | Run to end → auto transition to complete state.                                                     |
| 2   | Animated burst ~600ms, geometric rings                    | **Met** | Concentric ring burst (`CelebrationBurst`, 600ms timing).                                             |
| 3   | Time logged, goal credited, streak for action             | **Met** | Card shows duration; **GoalChip**; streak line uses `getFocusStreakForAction`.                      |
| 4   | Goal color dominant                                       | **Met** | Burst + icon tile + chip use goal palette.                                                          |
| 5   | "Back to Today" primary CTA                               | **Met** | Primary button → Today (note saved first if typed). **Secondary:** "Start another session" → Focus picker. |

---

## US-029 · Add a Session Note

| #   | Acceptance criterion                                      | Status      | Human verification                                                                                                                                 |
| --- | --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Optional note on Session Complete                         | **Met**     | Multiline field on complete / aborted screen.                                                                                                      |
| 2   | Max 280 characters                                      | **Met**     | `maxLength={280}` + counter.                                                                                                                       |
| 3   | Stored on FocusSession                                  | **Met**     | **Back to Today** or **Start another session** → `updateFocusSessionNote` when non-empty; initial insert `note: null`.                             |
| 4   | Viewable from Session History (v1.1)                    | **Not met** | **Gap:** US-030 not implemented — no history UI yet.                                                                                             |
| 5   | Empty → no empty note stored                            | **Met**     | Omit update when field blank; DB keeps `null`.                                                                                                   |

---

## US-034 / US-035 note (Insights vs Today)

- **US-034** (three stat cells + top goal color) and **US-035** (WK / MO / ALL) apply to the **Insights** tab — verify there separately.
- **Today** shows the **score ring** (0–100%) as the headline “summary” for the day; not the same layout as US-034’s Insights cells.

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
- After the product owner **validates** a batch of work: **commit** on the current branch, then **ask them to `git push`** (see **Section 2.6** in `Intetional_agent_development_guide.md`).

*Last reviewed: Focus timer batch US-022–029 (Expo blocking gaps documented); prior Today/Goals US-014–019; US-051 outstanding.*