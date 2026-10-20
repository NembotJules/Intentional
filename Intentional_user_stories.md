# INTENTIONAL — Complete User Stories
**All versions · MVP flagged explicitly**

---

## How to read this document

Each story follows the format:
> As a [user], I want to [action], so that [benefit].

Every story carries:
- **ID** — unique reference (US-001, US-002…)
- **Version** — MVP | v1.1 | v1.2 | v2.0
- **Acceptance Criteria** — the specific conditions that must be true for this story to be "done"

Stories are grouped by feature area, not by version, so you can see the full evolution of each area in one place.

**Verification:** For **Met / Not met / Partial** per acceptance criterion and **how a human verifies** each one, see `Intentional_acceptance_verification.md` (maintained alongside the codebase).

---

## 1. ONBOARDING

### US-001 · Welcome & Philosophy · **MVP**
As a first-time user, I want to see a welcome screen that explains the app's philosophy before I set anything up, so that I understand why this app is different from other productivity tools before committing.

**Acceptance Criteria:**
- Welcome screen appears on first launch only
- Narrative-first flow (see `intentional_onboarding_full.html`): brutalist welcome with stacked **INTENTIONAL** wordmark, James Clear quote, and short body copy (“Every hour… This is the system.”)
- **The problem** screen: gap / trap / fix cards, then **The system** screen: three levels (Meta Goals → Daily Actions → Focus Sessions) before the Create Goal step
- A single **BEGIN ▶** CTA is the primary action on welcome; optional **Skip to setup** after the problem screen jumps to Create Goal
- No sign-up, no account creation required at this step
- Screen is never shown again after onboarding is completed

---

### US-002 · Create First Meta Goal · **MVP**
As a new user, I want to create my first Meta Goal with a name and color, so that the app has a root to attach my daily actions to.

**Acceptance Criteria:**
- User can type a goal name (max 30 characters)
- User can select a color from a palette of at least 7 options
- A live preview pill shows the goal name and selected color before confirming
- The selected color immediately propagates to the CTA button style
- User cannot proceed without a goal name

---

### US-003 · Add First Daily Action · **MVP**
As a new user, I want to add a daily action to my first goal during onboarding, so that the app is immediately usable when I land on the Today screen.

**Acceptance Criteria:**
- User can name the action (max 30 characters)
- User can select type: Habit or Session
- If Session: user can select a target duration (25 / 45 / 60 / 90 min or custom)
- If Habit: duration selector is hidden
- The parent goal is displayed as a pill for context
- User cannot proceed without an action name

---

### US-004 · Write Why Statement · **MVP**
As a new user, I want to write a one-sentence "Why" for my first goal, so that I have a personal reason to return to the app on hard days.

**Acceptance Criteria:**
- Text input with 140-character maximum
- Live character counter displayed
- An example Why statement is shown to reduce blank-page anxiety
- Field is skippable — ghost CTA "Skip for now" is always visible
- If skipped, the field remains editable in Goal Detail later

---

### US-005 · Onboarding Progress Indicator · **MVP**
As a new user, I want to see how many steps are left in setup, so that I don't feel like the onboarding is endless.

**Acceptance Criteria:**
- **7-segment** progress bar (one per screen: Welcome → Problem → System → Meta goal → Daily action → Why → Ready), always visible during onboarding
- Current segment is wider and highlighted in **#e8e4dc**
- Completed segments use **#2e2e2e**
- Remaining segments are **#1e1e1e**

---

### US-006 · Add Multiple Goals During Onboarding · **MVP**
As a new user who has several life areas to track, I want to add more than one Meta Goal during onboarding, so that my Today screen is fully set up from day one.

**Acceptance Criteria:**
- "Add another goal" ghost CTA appears on the Create Goal step
- Tapping it loops back to a fresh Create Goal form
- Up to 5 goals can be created during onboarding
- Each goal must have a unique color (already-used colors are visually indicated)

---

## 2. DATA LAYER (LOCAL)

### US-007 · SQLite Schema (Core Entities) · **MVP**
As a user, I want my Meta Goals, Daily Actions, and Focus Sessions stored in a structured local database, so that data survives app restarts and every screen reads from a single source of truth.

**Acceptance Criteria:**
- Three core tables exist: `meta_goals`, `daily_actions`, `focus_sessions`
- `meta_goals` includes at minimum: unique `id`, `name`, `color`, `icon`, `sort_order`, `why_statement`, `is_archived` (soft archive per product spec)
- `daily_actions` includes at minimum: unique `id`, `goal_id` (required parent), `name`, `type` (habit vs session), `target_minutes`, optional `reminder_time`, `is_active`, `sort_order`
- `focus_sessions` includes at minimum: unique `id`, `action_id`, `goal_id` (denormalized for query speed per product spec), `started_at`, `ended_at`, `duration_seconds`, optional `note`, `was_completed`
- Parent/child integrity: every `daily_actions.goal_id` must reference an existing `meta_goals.id` (foreign key or equivalent enforced at write time)
- Schema is created idempotently on launch (e.g. `CREATE TABLE IF NOT EXISTS`); upgrading an existing install must not wipe user data without a defined migration
- Supporting tables/indexes are allowed for MVP when required by other stories (e.g. habit completion per calendar day, key/value settings such as onboarding completion), documented alongside the three core tables

*Build order: this story is Sprint 1 foundation in `Intetional_agent_development_guide.md` — before Goals Manager (US-008).*

---

## 3. META GOALS

### US-008 · View All Goals · **MVP**
As a user, I want to see all my Meta Goals in a list, so that I have a clear overview of the life areas I'm investing in.

**Acceptance Criteria:**
- Goals Manager screen shows all active (non-archived) goals
- Each goal displays its color accent, name, action count, and weekly hours logged
- Goals appear in user-defined sort order

---

### US-009 · Add a New Goal After Onboarding · **MVP**
As a user, I want to add a new Meta Goal at any time after setup, so that I can expand my tracking as my life priorities evolve.

**Acceptance Criteria:**
- "+" button on Goals Manager navigates to the Create Goal flow (same as onboarding step 2)
- New goal appears immediately in the list after saving
- New goal has zero actions and zero hours initially

---

### US-010 · Reorder Goals · **MVP**
As a user, I want to change the order my goals appear in, so that my most important goal is always at the top.

**Acceptance Criteria:**
- Long press on a goal card activates drag-to-reorder mode
- Reordered position is persisted immediately
- Today screen and Insights reflect the new order

---

### US-011 · Archive a Goal · **MVP**
As a user, I want to archive a goal I no longer actively pursue, so that it disappears from my daily view without losing all the history I've built up.

**Acceptance Criteria:**
- Swipe left on a goal card reveals an "Archive" action
- Archived goals no longer appear on Today, Insights active filters, or Goals Manager list
- All historical FocusSessions linked to the goal are preserved
- Archived goals are never permanently deleted

---

### US-012 · Edit a Goal's Name and Color · v1.1
As a user, I want to rename or recolor a goal, so that I can refine how I think about a life area as I grow.

**Acceptance Criteria:**
- Tapping a goal on Goals Manager navigates to Goal Detail
- Name and color are editable inline
- Changes propagate immediately to all screens (Today, Insights, streak cards)
- History is not affected by a rename

---

### US-013 · View Goal Detail · v1.1
As a user, I want to tap a goal and see its full detail — Why statement, all actions, lifetime hours, and streak — so that I can understand my relationship with that goal over time.

**Acceptance Criteria:**
- Goal Detail screen shows: Why statement, list of all active actions, total lifetime hours, current best streak
- Actions are editable and reorderable inline
- "Set as Wallpaper" button is available

---

## 4. DAILY ACTIONS

### US-014 · View Today's Actions · **MVP**
As a user, I want to see all my daily actions grouped by goal on the Today screen, so that I know exactly what I need to do today at a glance.

**Acceptance Criteria:**
- All active actions for all active goals appear on Today
- Actions are grouped under their parent goal header with goal color
- Each action shows its type, target duration/habit status, and today's logged time
- Completed actions are visually dimmed (opacity 0.45)

---

### US-015 · Start a Focus Session from Today · **MVP**
As a user, I want to tap START on any session-type action and immediately enter Focus Mode, so that there is no friction between deciding to work and actually working.

**Acceptance Criteria:**
- START button is visible on every incomplete session-type action row
- Tapping START navigates directly to the Focus Session screen with the action pre-loaded
- The target duration from the action's settings is pre-selected but adjustable
- No confirmation dialog required

---

### US-016 · Mark a Habit as Done · **MVP**
As a user, I want to tap a habit action to toggle it done, so that I can quickly log binary completions without entering a full focus session.

**Acceptance Criteria:**
- Habit action rows have a toggle instead of a START button
- One tap marks done (checkmark appears, row dims)
- A second tap on a done habit un-marks it (within the same day)
- The Today Score updates immediately

---

### US-017 · Add a Daily Action to an Existing Goal · **MVP**
As a user, I want to add new actions to my goals at any time, so that I can introduce new habits and work sessions as my routines evolve.

**Acceptance Criteria:**
- "Add action" control is available on Goal Detail (v1.1) and in Goals Manager
- Action requires a name and type; duration is required for Sessions
- New action appears on Today immediately
- For MVP: accessible via Goals Manager screen

---

### US-018 · Reorder Actions Within a Goal · **MVP**
As a user, I want to change the order my actions appear in, so that my most important action for each goal is at the top.

**Acceptance Criteria:**
- Long press on an action row activates drag-to-reorder within that goal's group
- Sort order is persisted immediately
- Affects Today screen display order

---

### US-019 · Deactivate an Action Without Deleting It · **MVP**
As a user, I want to deactivate an action I'm pausing temporarily, so that it disappears from my Today view without losing its streak and history.

**Acceptance Criteria:**
- Swipe left on an action reveals a "Deactivate" option
- Deactivated actions are hidden from Today and not counted in Today Score
- Historical sessions are preserved
- Action can be reactivated from Goal Detail

---

### US-020 · Set Reminder for an Action · v1.1
As a user, I want to set a daily reminder time for any action, so that I get a push notification prompting me to do it at the right time.

**Acceptance Criteria:**
- Each action can have one or more reminder times set
- Reminders use local notifications (UNUserNotificationCenter equivalent in Expo)
- Reminders fire daily at the set time with the action name and parent goal in the notification body
- Reminders respect deactivated actions — no notification fires for deactivated actions

---

### US-021 · Edit Action Name and Target Duration · v1.1
As a user, I want to edit an existing action's name or target duration, so that I can adjust my commitments as I improve.

**Acceptance Criteria:**
- Name and target duration are editable from Goal Detail
- Changes do not affect historical session data
- Today screen reflects the updated target immediately

---

## 5. FOCUS SESSION

### US-022 · Run a Focus Timer · **MVP**
As a user, I want to run a countdown timer for a set duration, so that I know how much time I've committed to working and can stay accountable to it.

**Acceptance Criteria:**
- Timer counts down from selected duration to 0:00
- Timer displays MM:SS format when under 1 hour, HH:MM:SS for sessions 1 hour or longer
- The goal name and action name are always visible during the session
- The goal's color is the primary visual accent throughout the screen

---

### US-023 · Select Session Duration Before Starting · **MVP**
As a user, I want to choose how long my session will be before starting, so that I can adapt my focus time to what I have available right now.

**Acceptance Criteria:**
- Duration presets: 25 min, 60 min, 90 min, 120 min
- A "Custom" option allows any duration to be entered
- The action's default target duration is pre-selected
- Selection can be changed right up until tapping the start button

---

### US-024 · Pause and Resume a Session · **MVP**
As a user, I want to pause a running session, so that I can handle an urgent interruption without ending my session entirely.

**Acceptance Criteria:**
- PAUSE button is always visible during an active session
- Tapping PAUSE freezes the timer
- App blocking (if active) is suspended during pause
- A RESUME button appears, replacing PAUSE
- Tapping RESUME restarts the timer and re-engages app blocking
- Paused time is not counted toward session duration

---

### US-025 · End a Session Early · **MVP**
As a user, I want to end a session before the timer finishes, so that my actual effort is still logged even if I didn't complete the full duration.

**Acceptance Criteria:**
- END button is always visible during an active session
- Tapping END shows a confirmation prompt: "End session? Your time will still be logged."
- On confirm: timer stops, actual elapsed time is logged to the goal
- Navigation proceeds to Session Complete screen
- Partial sessions count — there is no minimum duration threshold

---

### US-026 · App Blocking During Focus · **MVP**
As a user, I want the app to block distracting app categories while I'm in a session, so that I'm not tempted to check social media or games while I'm supposed to be working.

**Acceptance Criteria:**
- On first Focus session, the user is prompted to grant Screen Time / FamilyControls permission
- User selects which app categories to block during setup
- Selected categories are blocked for the session duration
- A "APPS BLOCKED · X CATEGORIES" badge is visible on the Focus screen
- Blocking is lifted immediately when a session is paused or ended
- If permission is denied, the timer still runs but the badge shows "BLOCKING UNAVAILABLE"

---

### US-027 · Visual Progress Ring on Timer · **MVP**
As a user, I want to see a ring that fills as my session progresses, so that I have a visual sense of how much time has passed without having to look at the numbers.

**Acceptance Criteria:**
- SVG ring surrounds the timer display
- Ring fills clockwise from 0% (session start) to 100% (session complete)
- Ring color matches the active goal's color
- Ring animates smoothly (no visible steps or jumps)

---

### US-028 · Session Completion Celebration · **MVP**
As a user, I want to see a celebration screen when I finish a session, so that completing my work feels rewarding and worth coming back for.

**Acceptance Criteria:**
- Session Complete screen appears automatically when the timer reaches 0
- An animated burst visual plays on arrival (600ms, geometric rings — not confetti)
- Screen displays: time logged, goal credited, current streak for the action
- Goal color is the dominant visual throughout the screen
- "Back to Today" CTA is the primary action

---

### US-029 · Add a Session Note · **MVP**
As a user, I want to write a brief note after a session, so that I can capture what I worked on or how the session felt while it's fresh.

**Acceptance Criteria:**
- Optional free-text note field on Session Complete screen
- Maximum 280 characters
- Note is stored with the FocusSession record
- Note is viewable from Session History (v1.1)
- If left empty, no empty note record is stored

---

### US-030 · Session History · v1.1
As a user, I want to see a log of all my past focus sessions, so that I can review what I've worked on and how long each session lasted.

**Acceptance Criteria:**
- Session History accessible from Goal Detail or Insights
- List view sorted by date descending
- Each entry shows: date, action name, duration, note (if any), completion status
- Filterable by goal and by date range

---

## 6. INSIGHTS

### US-031 · View Weekly Hours Per Goal · **MVP**
As a user, I want to see a bar chart of how many hours I've spent on each goal this week, so that I can tell at a glance where my time is actually going.

**Acceptance Criteria:**
- Bar chart displays one bar per active goal
- Bars are color-coded with the goal's color
- Chart updates when time range toggle changes
- Values are displayed as hours with one decimal (e.g. 5.2h)
- Bar width is proportional to the goal with the most hours (that goal = 100% width)

---

### US-032 · View Goal Balance Radar Chart · **MVP**
As a user, I want to see a radar/spider chart showing how balanced my effort is across goals, so that I can immediately feel if I'm neglecting something important.

**Acceptance Criteria:**
- Radar chart has one axis per active goal
- A perfectly balanced week produces a regular polygon
- An imbalanced week produces an irregular shape — this is intentional friction
- The chart updates with the same time range as the bar chart
- Vertex dots are colored with each goal's color

---

### US-033 · View Streak Per Action · **MVP**
As a user, I want to see the current streak for each of my daily actions, so that I feel the weight of not breaking the chain.

**Acceptance Criteria:**
- Streak cards show action name (in goal color), current streak count, and personal best
- A streak increments when an action is completed on consecutive calendar days
- A streak breaks if a day is missed (no partial credit)
- Current streak and best streak are both displayed

---

### US-034 · Summary Stats · **MVP**
As a user, I want to see my total hours, daily average, and top goal for the selected time range, so that I have a quick headline read before looking at the charts.

**Acceptance Criteria:**
- Three stat cells displayed above the bar chart: Total hrs, Daily avg, Top goal
- Top goal value is colored with that goal's color
- All three update when time range toggle changes

---

### US-035 · Time Range Toggle · **MVP**
As a user, I want to switch between This Week, This Month, and All Time views in Insights, so that I can see both my recent momentum and my long-term investment.

**Acceptance Criteria:**
- Three pill toggles: WK, MO, ALL
- Active toggle is highlighted
- All charts and stats update immediately on toggle change
- "This Week" is the default on screen load

---

### US-036 · Weekly Review Prompt · v1.1
As a user, I want to be prompted every Sunday evening to do a structured reflection, so that I regularly step back and assess whether my effort is aligned with my priorities.

**Acceptance Criteria:**
- Sunday evening push notification at user-configurable time (default 8pm)
- Review screen has three fields: "What went well?", "What would I improve?", "Goal adjustments for next week?"
- Each field is free text, no character limit
- Review is saved and browsable from Insights
- Notification can be disabled from Settings

---

### US-037 · Browse Past Weekly Reviews · v1.1
As a user, I want to read my past weekly reviews, so that I can track how my mindset and priorities have evolved over time.

**Acceptance Criteria:**
- Review history accessible from Insights
- Reviews listed in reverse chronological order
- Each entry shows the date and the three field responses
- No editing of past reviews (append-only)

---

## 7. AMBIENT LAYER

### US-038 · Generate Lock Screen Wallpaper · v1.1
As a user, I want to generate a custom lock screen image showing my goals, so that I see my intentions every time I pick up my phone.

**Acceptance Criteria:**
- Wallpaper Generator accessible from Goal Detail and Settings
- Generated image is 1170x2532px (iPhone 14 resolution)
- Shows all active Meta Goals with their colors, icons, and optionally Why statements
- At least 2 layout templates to choose from
- Image is saved directly to Photos via PhotosUI
- User must grant Photos permission before saving

---

### US-039 · Home Screen Widget — Today Progress · v1.2
As a user, I want a home screen widget showing my Today Score and progress, so that I can see my daily status without opening the app.

**Acceptance Criteria:**
- Small widget (2x2) shows Today Score ring and percentage
- Medium widget (2x4) shows score ring + top 3 incomplete actions
- Widget data updates every 15 minutes via background refresh
- Tapping the widget opens the Today screen
- Widget uses the same dark background and goal color system as the app

---

### US-040 · Smart Reminders Based on Completion Patterns · v2.0
As a user, I want the app to suggest reminder times based on when I usually complete each action, so that my reminders feel natural rather than arbitrary.

**Acceptance Criteria:**
- After 2 weeks of data, the app suggests a reminder time per action based on average completion time
- Suggestion is shown as a prompt card on the Today screen
- User can accept, adjust, or dismiss the suggestion
- Suggestion logic uses the median completion time across the last 14 days

---

## 8. SETTINGS & ACCOUNT

### US-041 · Manage Blocked App Categories · **MVP**
As a user, I want to change which app categories get blocked during focus sessions, so that I can tune blocking to what actually distracts me.

**Acceptance Criteria:**
- Blocked categories are configurable from Settings
- Categories use Apple's FamilyControls taxonomy (Social, Games, Entertainment, etc.)
- Changes take effect on the next session start
- Currently selected categories are clearly indicated

---

### US-042 · View and Edit All Actions from Settings · v1.1
As a user, I want a flat list of all my actions across all goals in one place, so that I can quickly audit and clean up what I'm tracking.

**Acceptance Criteria:**
- Settings > Actions shows all actions grouped by goal
- Each action shows its type, target, and active/inactive status
- Tapping an action opens its edit form
- Deactivate toggle available inline

---

### US-043 · iCloud Sync · v2.0
As a user, I want my data synced across my iPhone and iPad, so that I can log sessions on either device and see unified insights.

**Acceptance Criteria:**
- Data syncs via iCloud CloudKit (no third-party backend required)
- Sync happens automatically when both devices are on the same iCloud account
- Conflict resolution: last-write-wins for goal/action edits; sessions are append-only (no conflicts)
- Sync status indicator in Settings

---

### US-044 · Export Data · v2.0
As a user, I want to export all my focus session data as a CSV, so that I can do my own analysis in a spreadsheet.

**Acceptance Criteria:**
- Export option in Settings > Data
- Exports a CSV with columns: date, goal, action, duration (minutes), completed (yes/no), note
- File is shared via iOS Share Sheet
- Export includes all time history, not just the current range

---

### US-045 · Delete All Data · v1.1
As a user, I want the option to wipe all my data and start fresh, so that I can reset if my life priorities change significantly.

**Acceptance Criteria:**
- "Delete all data" option in Settings > Data, behind a confirmation dialog
- Confirmation requires the user to type "DELETE" to proceed
- All SQLite tables are cleared
- App returns to onboarding on next launch
- Action is irreversible — no undo

---

## 9. MONETISATION

### US-046 · Free Core Loop · **MVP**
As a user, I want to use the core focus + goal tracking loop for free, so that I can evaluate whether the app is worth paying for before committing.

**Acceptance Criteria:**
- All MVP features are available without a paywall
- No usage limits on the free tier for MVP launch
- No ads, no tracking, no upsell prompts during the focus session itself

---

### US-047 · Premium Subscription · v1.1
As a user, I want to subscribe to Intentional Pro to unlock advanced features, so that I can get more value while supporting ongoing development.

**Acceptance Criteria:**
- Subscription managed via RevenueCat
- Pricing: monthly and annual options
- Premium features (v1.1): Wallpaper Generator, Weekly Review, Reminders, Session History, Goal Detail
- Free features remain free permanently for existing users
- Subscription can be managed or cancelled from iOS Settings > Subscriptions

---

### US-048 · Restore Purchases · v1.1
As a user, I want to restore my subscription if I reinstall the app or switch devices, so that I don't have to pay again.

**Acceptance Criteria:**
- "Restore purchases" button in Settings > Subscription
- RevenueCat handles restore logic
- Subscription status is re-validated on every app launch
- If validation fails (expired), premium features are gracefully downgraded without data loss

---

## 10. ONBOARDING & APP ENTRY (EDGE CASES)

### US-049 · Empty State Guidance · **MVP**
As a user who has no goals set up, I want the app to guide me toward setup rather than showing a blank screen, so that I always know what to do next.

**Acceptance Criteria:**
- Today screen empty state: text "Start by adding your first pillar" + CTA "SET UP GOALS"
- Insights empty state: "No data yet. Complete your first session to see your stats here."
- Goals Manager empty state: "Add your first pillar" + CTA
- Empty states are shown only when the relevant data truly doesn't exist

---

### US-050 · Onboarding Skip · **MVP**
As a technically confident user, I want to skip parts of onboarding I don't need, so that I can get to using the app faster.

**Acceptance Criteria:**
- The Why statement step (Step 4) can be skipped via ghost CTA
- Skipping any optional step navigates forward, not backward
- Skipped steps are completable later from Goal Detail

---

### US-051 · Onboarding Draft Persists · **MVP**
As a new user, I want my onboarding data to be saved if I background the app mid-setup, so that I don't have to start over.

**Acceptance Criteria:**
- Draft goal name(s), color(s), action name, action type, and duration are saved to AsyncStorage (or equivalent) after each step
- On re-launch mid-onboarding, the user returns to the step they left on with their data intact
- On completing onboarding, draft data is cleared

*Distinct from US-007 (SQLite stores committed entities after onboarding completes).*

---

### US-052 · Onboarding Navigation Guard · **MVP**
As a first-time user, I want the app to keep me in the onboarding flow until setup is finished, so that I never land on tabs with no data model path.

**Acceptance Criteria:**
- Until onboarding is marked complete (persistent flag), cold start opens the onboarding entry (e.g. welcome), not the main tab shell
- After onboarding is complete, the user enters the main app even when they have zero goals; empty lists and CTAs follow **US-049** (this story does not force re-onboarding solely because the goal list is empty)

*Aligns with Sprint 7 routing in `Intetional_agent_development_guide.md` (previously mislabeled US-007).*

---

### US-053 · Replay Onboarding from Settings · **MVP**
As a user or tester, I want to walk through the onboarding flow again after I’ve already completed it, so that I can demo the experience, re-read the copy, or verify draft persistence without losing my tracked data.

**Acceptance Criteria:**
- **Settings** exposes a clear control (e.g. **Replay onboarding**) behind a confirmation dialog
- Confirming clears only the persistent **onboarding-complete** flag and the **onboarding AsyncStorage draft** — SQLite goals, actions, and focus sessions are unchanged
- The next navigation to the app root shows **onboarding** (welcome step) until the user completes the flow again (**US-052**)
- If the user **already has ≥1 active goal**, completing onboarding again **must not** insert duplicate goals or actions; only the completion flag is set and the user returns to the main app

*Pairs with **US-051** (draft key cleared on replay so the user starts at welcome unless they create a new mid-flow draft).*

---

---

## 11. GOALS, TASKS, HABITS & SESSIONS (v2 model)

> Product model, rules, glossary and build order: **`Intentional_goals_model.md`** (read it first).
> UI "Goal" = code `Objective` (`objectives` table). UI "Pillar" = code `MetaGoal` (`meta_goals`; legacy `goal_id` columns mean pillar).
> Every story: one branch, `npx tsc --noEmit` + `npx vitest run` green, works on native SQLite **and** the web shim.

---

### US-054 · Naming aliases & glossary in code · **v2**
As an agent working on the codebase, I want the code to name pillars, goals and habits the way the product does, so that "goal" stops meaning two things.

**Acceptance Criteria:**
- `types/index.ts` exports `type Pillar = MetaGoal` and `type Habit = DailyAction`, each with a doc comment pointing to `Intentional_goals_model.md` § 3
- A header comment in `types/index.ts` reproduces the glossary table (UI word → type → table → FK column)
- No behaviour change; `tsc` and all tests pass

---

### US-055 · Goals data layer (`objectives`) · **v2**
As a user, I want my goals stored safely on my device, so that each pillar can have a definite outcome with a deadline.

**Acceptance Criteria:**
- Migration v2 creates `objectives` exactly as in the model doc § 4; registered in the web shim
- `Objective` type added; `ObjectiveStatus = 'planned' | 'active' | 'completed' | 'dropped'`
- API in `db/api.ts`: `getObjectives(pillarId?)`, `getActiveObjective(pillarId)`, `addObjective(input)`, `updateObjective(id, patch)`, `setObjectiveStatus(id, status, note?)`
- Invariant: adding or activating a goal when the pillar already has an active one throws a typed error (`ActiveObjectiveExistsError`); the UI decides what to do
- Title max 60, done-when max 140, deadline required (`YYYY-MM-DD`, must be today or later on create)
- Completing or dropping sets `closed_at` and `close_note`; nothing is ever deleted
- Unit tests cover create, the one-active invariant, status transitions, and the migration on an existing v1 database

---

### US-056 · Tasks data layer (`tasks`) · **v2**
As a user, I want the steps toward my goal stored, so that I always know the next concrete thing to do.

**Acceptance Criteria:**
- Migration v3 creates `tasks` exactly as in the model doc § 4; registered in the web shim
- `Task` type added
- API: `getTasks(objectiveId)`, `addTask(input)`, `updateTask(id, patch)`, `setTaskDone(id, done)`, `reorderTasks(objectiveId, orderedIds)`, `getNextTask(objectiveId)` (first not-done by `sort_order`), `getTasksPlannedFor(date)`
- Adding a task to a non-existent goal throws
- Title max 60; estimate > 0 (default 30)
- Unit tests for every function, including next-task ordering after reorder and done toggles

---

### US-057 · Link habits and sessions to goals and tasks · **v2**
As a user, I want every hour I focus to count toward the right task and goal, so that progress adds up on its own.

**Acceptance Criteria:**
- Migration v4: `daily_actions.objective_id` (nullable), `daily_actions.days_mask` (default 127), `focus_sessions.task_id` (nullable), `focus_sessions.objective_id` (nullable). Web shim supports these columns (existing rows read as NULL / 127)
- Recording a session with a task sets `task_id`, `objective_id` (from the task) and `goal_id` (the pillar); with a habit linked to a goal it sets `objective_id`
- Rollup API: `getMinutesForTask(taskId)`, `getMinutesForObjective(objectiveId, range?)`, `getMinutesForPillar(pillarId, range?)` (the existing behaviour stays correct)
- Existing sessions and habits are untouched and keep working
- Unit tests for the rollups, including a session with no task and no goal

---

### US-058 · Goal progress & pace (domain) · **v2**
As a user, I want to see whether I'm on track for my goal, so that I can adjust before it's too late.

**Acceptance Criteria:**
- New pure module `services/goalProgress.ts` (no DB access) with:
  - `progressOf(objective, tasks)`: the metric fraction when metric_target is set (handles counting down when current > target at start), else done tasks / total tasks, else `null`
  - `daysLeft(objective, today)`, where a negative value means overdue
  - `paceOf(objective, tasks, today)`: `'ahead' | 'on_track' | 'behind' | 'unknown'`, comparing progress to the elapsed fraction of (created_at → deadline) with a ±10% band
- 100% unit-test coverage of the module, including no tasks, no metric, a past deadline and a same-day deadline

---

### US-059 · Set a goal for a pillar · **v2**
As a user, I want to set a definite goal for a pillar, so that my hours have a finish line to aim at.

**Acceptance Criteria:**
- Entry point: pillar detail (`app/goal/[id].tsx`) shows "Set a goal" when the pillar has no active goal
- Form (bottom sheet or screen, Spark style): **title** ("What will you achieve?"), **done when** ("How will you know it's done?"), **deadline** (chips: 30 days · 90 days · 6 months · Pick a date), optional **metric** (current, target, unit)
- Saving creates an `active` goal; the pillar detail updates immediately
- If the pillar already has an active goal, the form saves the new one as **planned** and labels it "Next up"
- Validation: title required; the deadline can't be in the past
- Copy examples always end with "etc."

---

### US-060 · Goal on pillar cards & pillar detail · **v2**
As a user, I want to see each pillar's goal at a glance, so that I remember what I'm building toward.

**Acceptance Criteria:**
- Goals tab pillar cards show the active goal: title, thin progress bar (pillar color), "N days left", pace word (ahead / on track / behind, where behind is muted orange, never red)
- Pillar detail shows a goal card (title, done-when, progress, days left, pace, hours given) that opens the goal detail, plus a "Next up" list of planned goals
- A pillar without a goal shows a soft "Set a goal" row

---

### US-061 · Goal detail screen · **v2**
As a user, I want one place for everything about a goal, so that I can plan and see progress.

**Acceptance Criteria:**
- New route `app/objective/[id].tsx`
- Header: pillar chip, title, done-when, deadline, days left, pace; a progress ring or bar; hours given (all time and this week)
- Sections: **Tasks** (US-064), **Habits for this goal** (linked habits, with their streaks), **Recent sessions**
- Actions: Edit (title, done-when, deadline, metric), update the metric value, Complete (US-062), Drop (US-063)
- Flick mood reflects pace (happy on track, worried behind, proud when complete)

---

### US-062 · Complete a goal · **v2**
As a user, I want completing a goal to feel like a real moment, so that achievement is remembered and the next goal starts.

**Acceptance Criteria:**
- "Mark as achieved" asks for confirmation, then shows a celebration (reuse `Confetti` + Flick proud, heavy then success haptics)
- Optional one-line reflection ("What made it work?"), saved as `close_note`
- Afterwards: if the pillar has a planned goal, offer "Start next: <title>"; else offer "Set your next goal"
- Unfinished tasks stay attached (history); the goal leaves Today

---

### US-063 · Drop a goal · **v2**
As a user, I want to drop a goal that no longer fits, without guilt, so that my system stays honest.

**Acceptance Criteria:**
- "Drop goal" asks for a one-line reason (optional), sets status `dropped`, and keeps all history
- Copy is respectful ("Changing course is part of being intentional.")
- Same "next goal" follow-up as US-062

---

### US-064 · Add & order tasks in a goal · **v2**
As a user, I want to break my goal into concrete steps, so that I always know what's next.

**Acceptance Criteria:**
- Goal detail lists tasks: not-done first in order, then a collapsible "N done"
- Quick-add row: title, then estimate chips (15 · 30 · 60 · 90 · 120 min · custom) and optional plan (Today · Tomorrow · This week · Pick date)
- Check off, edit, delete (with confirmation) and reorder (up/down buttons like the Goals tab reorder mode)
- Each task shows estimate and minutes given (e.g. "45 / 90 min")
- The first not-done task is labelled **Next**

---

### US-065 · Today: goal line, next task, planned tasks · **v2**
As a user, I want Today to show what moves each goal forward, so that my next hour has a definite target.

**Acceptance Criteria:**
- In each pillar section on Today, above the habits: the **goal line** (title · N days left · progress bar · pace) when an active goal exists
- Below it: the goal's **next task** (title, estimate, ▶ start session, ○ check off) and any other tasks planned for today
- The existing fold rules still apply (all tasks and habits done means the pillar folds; "N done"; "Show N more" past 3 items)
- The header's done/total count includes today's tasks
- Checking off the next task reveals the following task as the new next task, with a short animation

---

### US-066 · Focus on a task · **v2**
As a user, I want to run a focus session on a task, so that the hours count toward my goal.

**Acceptance Criteria:**
- The Focus picker lists, per pillar: next and planned tasks (labelled with their goal), then habits
- Duration defaults to the task's remaining estimate (estimate − minutes given, minimum 15)
- The session saves `task_id`, `objective_id` and `goal_id` (US-057)
- The end screen shows "+45m to <Goal>" and asks "Is this task done?" (Yes / Not yet)
- The "Leave now?" guard still applies

---

### US-067 · Gentle rollover of unfinished planned tasks · **v2**
As a user, I want yesterday's unfinished planned task to show up today, so that nothing silently disappears.

**Acceptance Criteria:**
- A not-done task whose `planned_date` is before today appears in Today with a quiet label ("from Tue")
- One tap offers: Do today · Move to tomorrow · Unplan
- No red, no "overdue" wording

---

### US-068 · Habits: rename, every habit creates hours, link to a goal · **v2**
As a user, I want my recurring commitments to be called habits, each with a duration, so that every habit turns into hours given to a pillar.

**Acceptance Criteria:**
- All UI copy says **habit** instead of "daily action" or "action" (Today, Goals, pillar detail, Focus, Settings, onboarding)
- New habits always have a duration (chips: 5 · 15 · 30 · 45 · 60 · 90 min · custom; minimum 5); the binary "Check" type is no longer offered
- Existing check-type habits keep working; their edit form asks for a duration ("Give it 15 min so it counts"); saving converts them to timed (`type = 'session'`)
- The habit create/edit form has an optional "Part of goal" picker (the pillar's active and planned goals)
- A linked habit shows a small goal tag on Today and counts its sessions toward the goal (US-057)

---

### US-069 · Habit schedule: weekdays, start time, duration · **v2**
As a user, I want to schedule each habit on specific days at a specific time, so that my habits live in my day like appointments with myself.

**Acceptance Criteria:**
- Habit form: weekday picker (M T W T F S S, default every day, stored in `days_mask`), start time (stored in `reminder_time` "HH:MM"; empty = "Anytime"), duration (`target_minutes`)
- Today shows only habits due today, ordered by start time, each labelled "7:00 · 30 min"; the next upcoming one shows "in 25 min"
- Streaks count only scheduled days (unit-tested)
- Changing the schedule reschedules notifications (US-075)

---

### US-075 · Habit start notification · **v2**
As a user, I want my phone to tell me when it's time for a habit, so that I don't need willpower to remember.

**Acceptance Criteria:**
- For each scheduled habit, a local notification fires on each scheduled weekday at the start time (`WEEKLY` triggers, one per weekday; replaces the single `DAILY` reminder in `services/notifications.ts`)
- Content: title "🔥 <Habit> · <Pillar>", body "Time to start. <duration> min, apps blocked." (or "…" without the blocking line when blocking is unavailable)
- Notification category with actions: **Start now** (opens the app), **In 10 min** (reschedules a one-off notification 10 minutes later, max 2 snoozes), **Skip today** (records a skip, no app open)
- Optional heads-up 10 minutes before (Settings toggle, default off)
- No notification when the habit is already done today, or the pillar is archived
- Unit tests for the schedule builder (weekdays mask → triggers) and snooze limits

---

### US-076 · From notification to focus in one tap · **v2**
As a user, I want tapping my habit's notification to drop me straight into focus with distractions blocked, so that starting takes zero decisions.

**Acceptance Criteria:**
- Tapping the notification or **Start now** opens Focus and **starts** the session immediately for that habit (not just preselects it): timer = habit duration, `action_id` set, shields applied via `services/appBlocking.applyShields()` when available
- A 3-second "Starting… Tap to cancel" overlay gives a way out before the timer starts
- If another session is already running, ask: "Switch to <Habit>?" (Keep current · Switch)
- If the app opens more than 30 min after the start time, it doesn't auto-start; it shows the habit preselected with "Start now" instead
- Works from a cold start (app killed) and from the background; tested with `addNotificationResponseReceivedListener` + `getLastNotificationResponseAsync`

---

### US-077 · Strict mode by default: apps blocked when a habit's time comes · **v2 (native iOS)**
As a user, I want my distracting apps blocked automatically when it's time for a habit, so that the block is already there before I'm tempted, without me having to set anything up.

**Acceptance Criteria:**
- Strict mode is **on by default** for every habit (new and existing: migration default `daily_actions.strict = 1`); the habit form shows a **Block apps automatically** toggle (on) that a person can turn off per habit. The toggle shows only when `appBlocking.isAvailable()`
- Uses a DeviceActivity schedule (native extension) per strict habit: shields the user's selected apps from start time to start time + duration on scheduled weekdays
- If no app selection exists yet, the first habit with a start time asks the person to pick their distracting apps (`appBlocking.presentPicker()`); until then the block is skipped (and the notification says so)
- The notification at start time says "Apps blocked. Tap to start your <duration> min."
- Opening the app during a strict window shows the running session for that habit (hours count from when the person opens and confirms; a strict window with no session gives no hours)
- Ending the session early lifts the block (through the "Leave now?" guard); a skipped habit lifts it immediately
- Where blocking is unavailable (Expo Go, Android, iOS < 16) the habit uses the notification + one-tap flow from US-075/076; documented in the README

---

### US-078 · Missed and skipped habits · **v2**
As a user, I want missed habits handled gently, so that one bad day doesn't make me quit.

**Acceptance Criteria:**
- "Skip today" (from the notification or Today) records a skip; one skip per habit per week doesn't break the streak ("Rest day")
- A habit whose time passed without a session shows on Today as "Missed 7:00, do it now?" until the end of the day, with no red
- Insights counts scheduled vs given hours per habit this week ("Run: 2h of 3h")

---

### US-070 · Give time to a pillar (no habit needed) · **v2**
As a user, I want to focus on a pillar without picking a task or habit, so that unplanned but intentional time still counts.

**Acceptance Criteria:**
- Today's "Free session" opens Focus with a **pillar** picker first (then an optional task or habit)
- A pillar-only session saves `goal_id` = pillar with no `action_id` or `task_id`; history, Insights and rollups handle it ("Free time" label)
- A session can never be saved without a pillar

---

### US-071 · Insights: goals · **v2**
As a user, I want to see how my hours serve my goals, so that I can tell if I'm investing in the right things.

**Acceptance Criteria:**
- New **Goals** section in Insights: each active goal with hours this week, progress, days left and pace
- "Where it went" splits each pillar's hours into: goal work (tasks and linked habits) · maintenance (habits with no goal) · free time
- One plain-language insight line (e.g. "Half marathon got 3h this week. At this pace you'll finish 10 days early.")

---

### US-072 · Weekly review per goal · **v2**
As a user, I want my weekly review to look at each goal, so that next week starts with a plan.

**Acceptance Criteria:**
- The weekly review shows each active goal: hours this week, pace, and "On track?" (Yes / Behind / Rethink)
- "Plan next week": add or schedule 1–3 tasks per goal for next week (sets `planned_date`)
- Saved with the existing review; review history shows a goal summary

---

### US-073 · Onboarding: first goal · **v2**
As a new user, I want to set my first goal during onboarding, so that I start with a definite target, not just an area.

**Acceptance Criteria:**
- After the pillars step: for the first pillar, "What would winning look like in 90 days?" with 3 example chips per preset pillar plus free text, and deadline chips (30 · 90 days · 6 months)
- Optional for the other pillars ("Add a goal for Family?" with a Skip option)
- The existing per-pillar habit step follows and links the habit to the goal when one exists
- The pledge and congratulations screens mention the goal ("…by March 15")
- The onboarding draft stays backward compatible; the e2e onboarding test is updated

---

### US-074 · "Set a goal" nudges · **v2**
As a user, I want a gentle reminder when a pillar has no goal, so that I turn areas into definite outcomes.

**Acceptance Criteria:**
- Today and the Goals tab show a soft row on goal-less pillars: "Body has no goal yet. What would winning look like?" with a Set goal action
- Dismissible per pillar for 14 days; never more than one nudge visible on Today at once
- No nudge for a pillar the user marked as maintenance-only (toggle on pillar detail: "This pillar runs on habits")

---

## Version Summary

| Version | Story Count | Key Capabilities Added |
|---------|------------|------------------------|
| **MVP** | **37 stories** | Full core loop: local schema, goals, actions, focus timer, app blocking, insights, streaks, onboarding edge cases + replay onboarding (**US-053**) |
| **v1.1** | 12 stories | Goal Detail, Wallpaper, Reminders, Session History, Weekly Review, Premium subscription |
| **v1.2** | 1 story | Home screen widget |
| **v2.0** | 3 stories | iCloud sync, smart reminders, data export |
| **v2** | 25 stories | Goals, tasks, habits & sessions model (US-054 → US-078, see `Intentional_goals_model.md`) |
| **Total** | **78 stories** | Complete product vision |

---

## MVP Story List (Quick Reference)

US-001 · US-002 · US-003 · US-004 · US-005 · US-006 · US-007 · US-008 · US-009 · US-010 · US-011 · US-014 · US-015 · US-016 · US-017 · US-018 · US-019 · US-022 · US-023 · US-024 · US-025 · US-026 · US-027 · US-028 · US-029 · US-031 · US-032 · US-033 · US-034 · US-035 · US-041 · US-046 · US-049 · US-050 · US-051 · US-052 · US-053

*37 MVP stories covering the complete core value proposition.*

---

*End of user stories. Intentional v1.0 — Full product vision.*