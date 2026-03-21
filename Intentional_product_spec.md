

# INTENTIONAL

## Product Specification Document

_iOS App · Version 1.0 · MVP + Full Vision_

> **"Align your daily effort with what matters most."**

|||
|---|---|
|Document Version|1.0|
|Platform|iOS 17+|
|Architecture|SwiftUI + SwiftData + MVVM|
|Status|Pre-development — ready for handoff|

---

## 1. Product Vision

### 1.1 The Problem

Most people have goals. Few people achieve them. The gap is not motivation — it is alignment. People know what they want at a high level, but their daily actions are disconnected from those aspirations. Productivity tools today fall into two camps: goal-setting apps that are never opened after week one, and task managers that keep you busy without asking why.

Three problems compound each other:

- No single place to connect your big life goals to your daily actions
- No mechanism to protect your focused work time from distraction
- No feedback loop to see whether effort is actually distributed across what matters

### 1.2 The Solution

Intentional is a focus and goal-tracking app built around one core philosophy: every hour you spend should trace back to something you care about. The app creates a three-level hierarchy — Meta Goals at the top, Daily Actions in the middle, and Focus Sessions at the bottom — and ensures every minute of work is logged against the right level.

> _"You don't rise to the level of your goals. You fall to the level of your systems." — James Clear. Intentional is the system._

### 1.3 Target User

The primary user is an ambitious self-improver — a developer, student, entrepreneur, or creator — aged 18–35 who has multiple life domains they want to grow simultaneously and struggles to give each one consistent attention. They have tried Notion, Todoist, Habitica, Forest, or Streaks and found that none of them answer the fundamental question: am I putting my time where my priorities are?

### 1.4 Core Differentiator

|Other Apps|Intentional|
|---|---|
|Goals live separately from tasks|Every task belongs to a Meta Goal|
|Focus timers are generic|Focus sessions log time to a specific goal|
|No effort visibility across life areas|Weekly dashboard shows time balance across all goals|
|Motivation is external (streaks, coins)|Motivation is intrinsic (your own Why statement)|
|Goals forgotten after setup|Goals visible as lock screen wallpaper daily|

### 1.5 The Five Layers

The app is organised into five functional layers, each building on the previous:

1. **Meta Goals** — Your 3–5 life pillars (e.g. Physique, Finances, Skills, Mind). Color-coded, permanent, and the root of everything in the app.
2. **Daily Actions** — The recurring habits and deep-work sessions attached to each goal. Two types: Habits (binary done/not-done) and Sessions (time-based).
3. **Focus Mode** — A full-screen timer that locks distracting apps via Apple's Screen Time API. Every session is automatically logged to its parent goal.
4. **Insights Dashboard** — A visual breakdown of time invested per goal over the week and month, habit streaks, and a radar chart showing goal balance.
5. **Ambient Layer** — Goals as lock screen wallpaper, home screen widgets showing today's progress, smart reminders, and a weekly Sunday review prompt.

---

## 2. Screen-by-Screen Specification

### 2.1 Onboarding

Shown once on first launch. The user names their Meta Goals (suggested: Physique, Finances, Skills, Mind), assigns a color and optional emoji icon to each, and writes a one-sentence Why statement per goal. A minimal 4-step flow with a progress indicator. The philosophy of the app — intentional living — is introduced here through copy, not tutorial.

- **Step 1:** Welcome screen — tagline, single CTA button
- **Step 2:** Create your first Meta Goal (name, color, icon)
- **Step 3:** Add a Daily Action to that goal (name, type, target duration)
- **Step 4:** Write your Why statement — skippable, editable later
- **Completion:** Short animation, transition to Today screen

### 2.2 Today (Home Screen)

The daily command center. Shows the current date, a Today Score (0–100% based on completed actions), and the full list of today's actions grouped by Meta Goal with color coding. Each action has a one-tap START button to enter Focus Mode directly. Completed actions show a checkmark and elapsed time.

- Top bar: date, Today Score as a percentage with color-coded ring
- Action list: grouped by goal, color-coded, shows target vs. logged time
- Habit actions: toggle done/not-done
- Session actions: tap START to enter Focus Mode
- Bottom tab bar: Today / Focus / Insights / Goals

### 2.3 Focus Session

Full dark-mode screen entered from Today or the Focus tab. Shows the goal name, action name, and a large central countdown or count-up timer. App blocking is active. Pause and End buttons. A subtle progress ring around the timer fills as time elapses.

- Pre-session: select action + set duration (25 / 60 / 90 / 120 min or custom)
- Active: dark background, goal color accent, large timer, apps blocked
- App blocking status shown as small badge at bottom of screen
- Pause suspends timer and temporarily lifts app block
- End triggers Session Complete flow (partial time is still logged)

### 2.4 Session Complete

Shown immediately after a session ends. Celebrates the effort with an animation, shows the exact time logged, the goal it was credited to, and the current streak. An optional note field allows the user to capture what they worked on or how the session felt. This note is stored with the FocusSession record.

- Celebration animation (confetti or radial burst in goal color)
- Time logged + goal attribution
- Current streak for this action
- Optional session note (max 280 characters)
- CTA: Back to Today

### 2.5 Insights

The progress dashboard. Top section: a bar chart of total hours per Meta Goal for the current week, color-coded by goal. Middle section: a radar/spider chart showing goal balance (equal = octagon, imbalanced = irregular shape). Bottom section: habit streaks per action and a total hours summary.

- Time range toggle: This Week / This Month / All Time
- Bar chart: hours per goal, sorted by goal order
- Radar chart: visual balance across all goals
- Streak cards: per-action current and best streaks
- Total hours this week, daily average, most-focused goal

### 2.6 Goals Manager

A simple list of all Meta Goals with their color, icon, action count, and weekly hours logged. Tap a goal to enter Goal Detail. A + button adds a new goal. Long press to reorder. Swipe to archive (not delete — history is preserved).

### 2.7 Goal Detail _(v1.1)_

Opened from Goals Manager. Shows the goal's Why statement, the list of its Daily Actions (editable inline), total lifetime hours, and a Set as Wallpaper button. Actions can be reordered, edited, or toggled inactive without losing history.

### 2.8 Wallpaper Generator _(v1.1)_

Generates a custom lock screen image (1170×2532px for iPhone 14) showing all Meta Goals with their colors, icons, and optionally their Why statements. Multiple layout templates. Saved directly to Photos via PhotosUI. Designed to be minimal and readable at a glance.

### 2.9 Reminders Setup _(v1.1)_

Per-action notification scheduling. Each Daily Action can have one or more reminder times set. Uses UNUserNotificationCenter for fully local, offline notifications. Shown inside Goal Detail or as a dedicated Reminders screen accessible from Settings.

### 2.10 Weekly Review _(v1.1)_

A structured Sunday reflection prompt. Three free-text fields: What went well?, What would I improve?, and Goal adjustments for next week. Triggered by a Sunday evening notification. Review history is stored and browsable in Insights.

---

## 3. Data Architecture

### 3.1 SwiftData Models

All models use SwiftData (`@Model` macro, iOS 17+). No backend. All data is local to the device.

#### MetaGoal

|Field|Type|Notes|
|---|---|---|
|id|UUID|Auto-generated primary key|
|name|String|User-defined, max 30 chars|
|color|String|Hex color string e.g. `#4A9EED`|
|icon|String|SF Symbol name or emoji|
|sortOrder|Int|User-defined display order|
|whyStatement|String|Optional, max 140 chars|
|isArchived|Bool|Soft delete, preserves history|
|actions|[DailyAction]|Inverse relationship|

#### DailyAction

|Field|Type|Notes|
|---|---|---|
|id|UUID|Auto-generated primary key|
|goal|MetaGoal|Parent goal (required)|
|name|String|e.g. 'Learn ML', 'Gym session'|
|type|ActionType|Enum: `.habit` or `.session`|
|targetMinutes|Int|Daily target in minutes|
|reminderTime|Date?|Optional local notification time|
|isActive|Bool|Inactive = hidden from Today, history kept|
|sortOrder|Int|Display order within goal|

#### FocusSession _(append-only log — never edited)_

|Field|Type|Notes|
|---|---|---|
|id|UUID|Auto-generated|
|action|DailyAction|The action being worked on|
|goal|MetaGoal|Denormalized for query speed|
|startedAt|Date|Session start timestamp|
|endedAt|Date?|Nil if session was force-quit|
|durationSeconds|Int|Actual seconds elapsed|
|note|String?|Optional post-session note|
|wasCompleted|Bool|True if timer ran to end|

---

## 4. Technical Specification

### 4.1 Platform & Minimum Requirements

- **Platform:** iOS 17.0+ (required for SwiftData)
- **Language:** Swift 5.9+
- **UI Framework:** SwiftUI
- **Persistence:** SwiftData (`@Model`, `ModelContainer`, `ModelContext`)
- **Architecture:** MVVM — Views observe ViewModels via `@Observable`
- **No backend, no accounts, no network required. Fully offline.**

### 4.2 iOS APIs

|Framework|Use Case|Key Notes|
|---|---|---|
|FamilyControls + ManagedSettings|App blocking during focus|Requires one-time user authorization. Blocks by app category, not individual app.|
|UNUserNotificationCenter|Action reminders|Local only. Request authorization on first reminder setup.|
|SwiftData|All persistent storage|iOS 17+ required. Zero CoreData boilerplate.|
|WidgetKit|Home screen widget|Requires shared AppGroup container. Widget reads from group store.|
|PhotosUI|Save wallpaper|PHPhotoLibrary authorization required. Saves to Camera Roll.|
|Charts (SwiftUI)|Insights bar + radar charts|Native iOS 16+ Charts framework.|

### 4.3 Folder Structure

```
Intentional/
├── Models/
│   ├── MetaGoal.swift
│   ├── DailyAction.swift
│   ├── FocusSession.swift
│   ├── DailyProgress.swift
│   └── WeeklyReview.swift
├── Views/
│   ├── Onboarding/
│   ├── Today/
│   ├── Focus/
│   ├── Insights/
│   ├── Goals/
│   └── Ambient/           # Wallpaper, Reminders, Review
├── ViewModels/
│   ├── TodayViewModel.swift
│   ├── FocusViewModel.swift
│   └── InsightsViewModel.swift
├── Services/
│   ├── FocusLockService.swift     # FamilyControls wrapper
│   ├── NotificationService.swift  # UNUserNotificationCenter wrapper
│   └── WallpaperService.swift     # Image generation + PhotosUI
├── Widgets/
│   └── TodayWidget.swift
└── Resources/
    ├── Colors.xcassets
    └── AppIcons.xcassets
```

### 4.4 Focus Lock — Implementation Notes

The `FocusLockService` wraps all FamilyControls logic and is the only file that imports that framework. The flow is:

1. User taps Start Session → `FocusViewModel` calls `FocusLockService.requestAuthorizationIfNeeded()`
2. On first call only, the system shows the FamilyControls permission sheet
3. On authorization: `FocusLockService.enableLock(categories:)` is called
4. `ManagedSettingsStore().shield.applicationCategories` is set to the user's chosen categories
5. Timer starts. `FocusViewModel` enters `.focusing` state.
6. On End or timer completion: `FocusLockService.disableLock()` clears the shield
7. `FocusSession` record is written to SwiftData

> **Important constraint:** FamilyControls blocks app **CATEGORIES** (Social, Games, Entertainment, etc.), not individual apps. The user selects their blocked categories during the first-time setup screen inside Intentional. This is an Apple platform limitation that cannot be worked around.

### 4.5 State Machine — FocusViewModel

The focus session has exactly five states:

- `idle` — no session active, default state
- `preparing` — authorization requested, pre-session UI shown
- `focusing` — timer running, app block active
- `completed` — timer reached zero naturally
- `aborted` — user ended session early

Both `completed` and `aborted` transitions log actual elapsed time to the goal. **Partial sessions count.**

---

## 5. MVP Scope

### 5.1 What the MVP Must Deliver

The MVP proves the core loop: a user can set up their goals, define daily actions, run focused work sessions, and see their effort reflected in an insights dashboard. The MVP is feature-complete for the fundamental value proposition.

### 5.2 MVP Screen Checklist

|Screen|MVP|Version|
|---|---|---|
|Onboarding|✅ YES|MVP|
|Today (Home)|✅ YES|MVP|
|Focus Session|✅ YES|MVP|
|Session Complete|✅ YES|MVP|
|Insights Dashboard|✅ YES|MVP|
|Goals Manager|✅ YES|MVP|
|Goal Detail|❌ NO|v1.1|
|Wallpaper Generator|❌ NO|v1.1|
|Reminders Setup|❌ NO|v1.1|
|Weekly Review|❌ NO|v1.1|
|Home Screen Widget|❌ NO|v1.2|

### 5.3 Recommended Build Order

Build in this sequence to always have a runnable, testable app at each step:

1. SwiftData models — all 5 models with relationships
2. Goals Manager — create/edit/reorder goals and actions
3. Today screen — list with goal colors and action states
4. Focus Session — timer, state machine, session logging
5. Session Complete — post-session screen
6. Insights Dashboard — query sessions, render charts
7. FocusLockService — add app blocking on top of working timer
8. Onboarding — wire to existing models and views

> Build the lock service (step 7) after the timer works end-to-end. This way you can develop and test the full flow in the simulator (which does not support FamilyControls) before adding the blocking layer.

---

## 6. Design System

### 6.1 Color Palette

|Goal|Light Mode|Dark Mode|Usage|
|---|---|---|---|
|Physique|`#4A9EED`|`#60AEFF`|Blue — calm, physical|
|Finances|`#22C55E`|`#34D366`|Green — growth, money|
|Skills|`#8B5CF6`|`#A78BFA`|Purple — knowledge, depth|
|Mind|`#F59E0B`|`#FBBF24`|Amber — warmth, wisdom|

### 6.2 Typography

- **Title:** SF Pro Display, Bold, 34pt
- **Heading:** SF Pro Display, Semibold, 22pt
- **Body:** SF Pro Text, Regular, 17pt
- **Caption:** SF Pro Text, Regular, 13pt, color: secondary label
- **Timer:** SF Pro Display, Thin, 72pt _(Focus screen only)_

### 6.3 Key Design Principles

- Goal color is the visual language — every element related to a goal uses its color
- Focus screen is always dark, regardless of system appearance
- Minimal chrome — no unnecessary navigation, no sidebars, no hamburger menus
- Celebration is mandatory — the Session Complete screen must feel rewarding
- Progress is always visible — Today Score and streaks are never hidden

---

## 7. Out of Scope (Current Version)

The following are explicitly excluded to keep the MVP focused:

- iCloud sync / cross-device support
- Social features, sharing, or leaderboards
- Apple Watch companion app
- AI-generated goal suggestions or coaching
- Calendar integration
- Pomodoro mode _(can be a future timer preset)_
- iPad-specific layout
- macOS Catalyst version

> _These are great ideas for v2+. Do not build them into the MVP. Ship the loop first._

---

## 8. Success Metrics

The following metrics define MVP success, measurable after the first 30 days on the App Store:

- **Day 7 retention > 35%** — user returns 7 days after install
- **Average sessions per active user per day > 1.5**
- **Average session duration > 45 minutes**
- **Goal setup completion rate > 80%** — users who launch complete onboarding
- **Session completion rate (not aborted) > 60%**