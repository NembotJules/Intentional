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

---

## 1. ONBOARDING

### US-001 · Welcome & Philosophy · **MVP**
As a first-time user, I want to see a welcome screen that explains the app's philosophy before I set anything up, so that I understand why this app is different from other productivity tools before committing.

**Acceptance Criteria:**
- Welcome screen appears on first launch only
- The James Clear quote is displayed
- A single "BEGIN" CTA is the only action available
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
- 4-dot progress indicator is always visible during onboarding
- Current step dot is highlighted in #e8e4dc
- Completed step dots are dimmed (#333)
- Remaining dots are dark (#1e1e1e)

---

### US-006 · Add Multiple Goals During Onboarding · **MVP**
As a new user who has several life areas to track, I want to add more than one Meta Goal during onboarding, so that my Today screen is fully set up from day one.

**Acceptance Criteria:**
- "Add another goal" ghost CTA appears on the Create Goal step
- Tapping it loops back to a fresh Create Goal form
- Up to 5 goals can be created during onboarding
- Each goal must have a unique color (already-used colors are visually indicated)

---

### US-007 · Onboarding Data Persists · **MVP**
As a new user, I want my onboarding data to be saved if I background the app mid-setup, so that I don't have to start over.

**Acceptance Criteria:**
- Draft goal name, color, action name, action type, and duration are saved to AsyncStorage after each step
- On re-launch mid-onboarding, the user returns to the step they left on with their data intact
- On completing onboarding, draft data is cleared

---

## 2. META GOALS

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

## 3. DAILY ACTIONS

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

## 4. FOCUS SESSION

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

## 5. INSIGHTS

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

## 6. AMBIENT LAYER

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

## 7. SETTINGS & ACCOUNT

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

## 8. MONETISATION

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

## 9. ONBOARDING (RETURNING USER)

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

---

## Version Summary

| Version | Story Count | Key Capabilities Added |
|---------|------------|------------------------|
| **MVP** | **30 stories** | Full core loop: goals, actions, focus timer, app blocking, insights, streaks |
| **v1.1** | 12 stories | Goal Detail, Wallpaper, Reminders, Session History, Weekly Review, Premium subscription |
| **v1.2** | 1 story | Home screen widget |
| **v2.0** | 3 stories | iCloud sync, smart reminders, data export |
| **Total** | **50 stories** | Complete product vision |

---

## MVP Story List (Quick Reference)

US-001 · US-002 · US-003 · US-004 · US-005 · US-006 · US-007 · US-008 · US-009 · US-010 · US-011 · US-014 · US-015 · US-016 · US-017 · US-018 · US-019 · US-022 · US-023 · US-024 · US-025 · US-026 · US-027 · US-028 · US-029 · US-031 · US-032 · US-033 · US-034 · US-035 · US-041 · US-046 · US-049 · US-050

*34 MVP stories covering the complete core value proposition.*

---

*End of user stories. Intentional v1.0 — Full product vision.*