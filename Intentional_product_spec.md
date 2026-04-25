
# INTENTIONAL

## Product Specification Document

_iPhone app · iOS 17+ · MVP + later vision_

> **"Align your daily effort with what matters most."**

| | |
|---|---|
| **Document version** | 2.0 |
| **Platform** | iOS 17+ · **iPhone only** (v1) |
| **Architecture** | SwiftUI + SwiftData + MVVM |
| **Status** | Pre-development — source of truth for product; visual execution owned by design |

**What changed in v2.0** — Reframed the problem from the founder’s experience (drift vs pillars). Defined **enforcement** as app blocking + habit reminders (with a path into focus) + **manual** focus sessions attributed to a meta goal. Locked **iPhone-only** for v1. Nudged **basic local reminders** into MVP to match that vision. Clarified **Apple’s real constraints** for blocking. Target audience: **user zero first**, then others with the same misalignment.

---

## 0. Founder intent

The app exists because it’s easy to name what matters (physique, finances, mind, skills — **meta goals** / life pillars) and still live days where **nothing you do clearly touches those names**. Intentional is a **system** that connects pillars to **daily actions** and to **time actually spent**, with enough **enforcement** (blocking, nudges, and honest manual logging) that the numbers stay meaningful.

It is being built **for the founder first**; if it solves that, it will resonate with people who feel the same **goal–action–time** gap. It is **not** trying to be the generic “goals for everyone” app on day one.

---

## 1. Product vision

### 1.1 The problem

- High-level **life pillars** are clear (or can be made clear in one sitting).
- **Day-to-day behavior** drifts: urgency, habit, and distraction win; pillars don’t.
- There is no single place that **forces an honest line** from “this hour” → “this action” → “this pillar,” or that shows **where hours really went** across pillars.

The gap is **alignment**, not (primarily) motivation. Existing tools either warehouse goals, optimize busywork, or time-block without a pillar story.

### 1.2 The solution

Intentional ties **meta goals (pillars)** → **daily actions (habits + sessions)** → **focus sessions (logged time)**. Every meaningful block of work can be **attributed** to a pillar so insights reflect **reality**, not hope.

> *“You don’t rise to the level of your goals. You fall to the level of your systems.” — James Clear. Intentional is the system.*

### 1.3 Who it’s for

1. **User zero** — The founder: wants pillars, structure, and proof of where time went.
2. **Expansion ICP (same bet)** — People who can name a few life domains, feel their **calendar and attention** don’t serve those domains, and are willing to use **focus + logging** to stay honest. Not optimized for people who only want a pretty goal list with no time attribution.

### 1.4 Core differentiator

| Typical tools | Intentional |
|---------------|------------|
| Goals separate from work | **Every** trackable action belongs to a **meta goal** |
| Timers that don’t own outcomes | Focus time is **credited to a goal** (and optionally **shielded** from distractors) |
| No pillar-level truth | **Insights** show **where hours went** across pillars |
| Extrinsic gamification as the hook | **Intrinsic**: your pillars and optional **why**; enforcement is about **focus + truth** |

### 1.5 The five product layers (conceptual)

1. **Meta goals** — 3–5 life pillars; named, color-coded, ordered; root of the graph.
2. **Daily actions** — Habits (done / not done) and session-style actions (time targets), each **owned by one meta goal**.
3. **Focus** — Full-screen session with timer; **optional app blocking** while active; time **always** logged to the chosen action and goal.
4. **Insights** — Breakdown of time and balance **by pillar**; habit streaks; ranges (week / month / all time).
5. **Ambient (later)** — Wallpaper, home widget, rich reminder schedules, weekly review — **not required for the core loop**; sequenced after MVP proves value.

### 1.6 Enforcement (what the word means in this product)

**Enforcement** is not a single feature; it is a combination of:

| Mechanism | Role |
|-----------|------|
| **Distractor shield during focus** | While a focus session is active, use Apple’s **Screen Time–style** APIs to **reduce** escape to high-friction app categories the user has chosen (similar in *spirit* to “Forest-like” focus, **subject to iOS rules below**). |
| **Habit reminders → focus** | **Local notifications** for actions tied to a pillar, configured in-app; reminder can **deep-link** into starting or continuing a **focus session** on that action. |
| **Manual focus** | User opens the app, starts a session, **picks action + goal**, and logs time even when the day wasn’t pre-planned. Keeps the ledger **honest** when reminders and shields aren’t the story. |

None of this replaces the user’s agency; the product’s job is to **default toward pillars** and make **attribution and leakage** visible.

### 1.7 iPhone, iOS, and honest expectations

- **V1 is iPhone-only.** iPad, Mac, and universal layouts are out of scope until explicitly chosen.
- **Blocking** uses **Family Controls / Managed Settings** (see §4.4). On iOS, shields apply to **app categories** (e.g. Social, Games), **not** a hand-picked list of individual apps. The product and App Store copy must **not** promise per-app blocklists like some users imagine from other platforms.
- **Reminders** use **UNUserNotificationCenter** — local, no server.
- **Data** stays on-device; no account required (same as v1.0 technical posture).

---

## 2. Screen-by-screen specification

*Detailed pixels and component choices belong to design; this section is functional truth.*

### 2.1 Onboarding

First launch. User creates at least one **meta goal** (suggested: Physique, Finances, Skills, Mind), color/icon, and **one** daily action. Optional one-line **why** per goal (skippable, editable later). Short flow with progress, **philosophy through copy** not a long tutorial, then into **Today**.

### 2.2 Today (home)

Daily command center: date, list of **today’s actions** grouped by meta goal, **start focus** in one tap where relevant, **habit** toggles, **target vs logged** time where applicable. A simple **day score** or progress readout is optional but recommended so “today” feels legible at a glance.

**Tabs (conceptual):** Today · Focus · Insights · Goals.

### 2.3 Focus session

- **Entry:** From Today, Focus tab, or a **reminder** (attribute action + goal before or at start).
- **Pre-session:** Action, goal (if not fixed), duration presets + custom.
- **Active:** Large timer, pillar accent, **optional shield** active when enabled and authorized.
- **Pause:** Pauses timer; **shield may lift** while paused (product decision: align with “honest break” vs strictness).
- **End:** **Partial time counts**; always writes a **FocusSession** row.

### 2.4 Session complete

Celebration, time logged, goal/action attribution, optional short note, streak for that action if applicable, **back to Today**.

### 2.5 Insights

Bar chart of time **per meta goal**; radar (or similar) for **balance**; streaks; total hours / range toggle (week, month, all time). Exact chart types can follow platform and design.

### 2.6 Goals manager

List of meta goals: color, icon, action count, **weekly hours**. Create; reorder; **archive** (soft) — **history kept**. Tapping a goal: **MVP** may use a **lightweight** detail (actions list, why) or inline expansion; **full** goal detail + wallpaper entry can stay a single coherent surface in one Release if scope allows.

### 2.7 Goal detail & wallpaper (v1.1 unless pulled forward)

**Why** statement, actions list (edit, reorder, inactive without deleting history), lifetime hours, **set as wallpaper** (export to Photos). Tied to **Ambient** layer.

### 2.8 Wallpaper generator (v1.1)

Lock-screen–sized asset for **current iPhone target sizes**; layouts minimal and readable. PhotosUI save.

### 2.9 Reminders

**MVP:** Each **Daily Action** may have **at least one** optional **local** reminder time; notifications request permission when first used. Tapping notification opens the app to **Today** or a **pre-selected focus** for that action.

**Later:** Multiple times per action, per-day rules, snooze — only if v1 feedback demands it.

### 2.10 Weekly review (v1.1+)

Optional structured reflection (what went well, adjust next week) and history — **after** the core loop is proven.

---

## 3. Data architecture

### 3.1 SwiftData models

All local, `@Model`, iOS 17+. No backend.

#### MetaGoal

| Field | Type | Notes |
|-------|------|--------|
| id | UUID | Primary key |
| name | String | e.g. max 30 chars |
| color | String | Hex |
| icon | String | SF Symbol or emoji |
| sortOrder | Int | |
| whyStatement | String? | Optional short |
| isArchived | Bool | Soft delete |
| actions | [DailyAction] | Inverse |

#### DailyAction

| Field | Type | Notes |
|-------|------|--------|
| id | UUID | |
| goal | MetaGoal | Required |
| name | String | |
| type | ActionType | `.habit` / `.session` |
| targetMinutes | Int | Daily target |
| reminderTime | Date? | **MVP:** one optional fire time; component time matters — consider separate fields if needed for repeat |
| isActive | Bool | |
| sortOrder | Int | |

*If a single `Date?` is awkward for “daily at 9:00,” add `reminderHour` / `reminderMinute` or use `DateComponents` in app logic — final shape for engineering.*

#### FocusSession (append-only)

| Field | Type | Notes |
|-------|------|--------|
| id | UUID | |
| action | DailyAction | |
| goal | MetaGoal | Denormalized for queries |
| startedAt | Date | |
| endedAt | Date? | |
| durationSeconds | Int | |
| note | String? | |
| wasCompleted | Bool | Timer natural end vs early end |

#### Other models

`DailyProgress`, `WeeklyReview` as needed for streaks and future review feature — **don’t over-model before the loop ships.**

---

## 4. Technical specification

### 4.1 Platform & requirements

- **Device:** **iPhone only** (v1). Not iPad-optimized; App Store can state “Designed for iPhone.”
- **OS:** iOS 17.0+ (SwiftData).
- **Stack:** Swift 5.9+, SwiftUI, MVVM with `@Observable` where appropriate.
- **Offline:** No network, no account.

### 4.2 iOS APIs (summary)

| Framework | Use |
|-----------|-----|
| FamilyControls + ManagedSettings | Shield **categories** during focus |
| UserNotifications | Local reminders |
| SwiftData | Persistence |
| Charts | Insights |
| WidgetKit | **Post-MVP** (e.g. v1.2) |
| PhotosUI | Wallpaper save (**v1.1**) |

### 4.3 Repository layout (indicative)

```
Intentional/
├── Models/
├── Views/          # Onboarding, Today, Focus, Insights, Goals
├── ViewModels/
├── Services/
│   ├── FocusLockService.swift
│   └── NotificationService.swift
└── Resources/
```

### 4.4 Focus lock (honest spec)

- **One** service type owns **FamilyControls** / **ManagedSettings** imports.
- Flow: start focus → `requestAuthorizationIfNeeded()` (system sheet first time) → enable shields for **user-selected categories** → run timer → on end/pause policy → disable shields → persist **FocusSession**.

**Product truth:** This is **category-level** restriction, not “block Instagram only.” User picks categories in onboarding or settings once; copy sets expectations.

### 4.5 FocusViewModel states

`idle` → `preparing` → `focusing` → `completed` | `aborted` — **partial time always logged** when the user intended a session (same principle as v1.0 spec).

**Simulator:** develop timer + logging first; add shields on device.

---

## 5. MVP scope

### 5.1 What MVP must prove

User can define **pillars** and **actions**, run **focus** (with or without shield), get **reminders** that pull them back, **manually** start sessions, and **see hours by pillar** in **Insights**. That is the **alignment loop**.

### 5.2 MVP screen checklist

| Area | MVP |
|------|-----|
| Onboarding | Yes |
| Today | Yes |
| Focus + session complete | Yes |
| Insights | Yes |
| Goals manager (CRUD + reorder + archive) | Yes |
| **Basic reminders** (per action, local) | **Yes** |
| Full goal detail / wallpaper / weekly review / widgets | **No** (phased) |

*Exact phasing of “light goal detail in MVP” vs v1.1: ship the **minimum** that lets users edit actions and read **why** without building wallpaper.*

### 5.3 Recommended build order

1. SwiftData models + minimal seed
2. Goals manager (goals + actions)
3. Today
4. Focus timer + logging + session complete
5. Insights
6. `FocusLockService` on **device**
7. **NotificationService** + reminder UI
8. Onboarding
9. Polish + TestFlight

---

## 6. Design system

**Principles (non-negotiable for product):**

- **Pillar color** is the main semantic layer across Today / Focus / Insights.
- **Focus** is a distinct, calm mode (e.g. dark, low noise).
- **Session complete** should feel like a real win, not a dismissible sheet.
- **Accessibility** and Dynamic Type: respect system settings.

**Specific palettes, type ramps, and motion** — **owner: Designer**; don’t treat old hex tables as final until design signs off.

---

## 7. Out of scope (v1 / current document)

- iPad layout, Mac Catalyst, watchOS
- iCloud / sync / multi-device
- Social, leaderboards, sharing
- AI coaching, calendar integration, third-party data import
- **Per-app** block lists (impossible to promise on iOS the way some users want)
- Account system and servers

*Ship the **iPhone** loop; expand **after** it’s real.*

---

## 8. Success metrics (indicative)

After initial App Store / TestFlight period, useful signals include:

- **Return after week one** (retention) among people who **finished onboarding**
- **Average focus sessions / active day** and **attributed minutes / pillar / week**
- **Session end** mix (completed vs early end) — not as a moral score, but to see if shields/settings are misfit
- **Reminder → session** funnel (if measurable locally)

Tweak thresholds once usage is visible; the north star is **sustained honest use**, not maximized time on phone.

---

*End of document v2.0*
