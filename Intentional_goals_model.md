# INTENTIONAL — Goals, Tasks, Habits & Sessions
**The product model · v2 · 2026-10-20**

> This document is the source of truth for how Intentional thinks about goals, tasks, habits and sessions.
> It defines each concept, the rules between them, the data model, and the ordered build plan (US-054 → US-074)
> that agents work through. When this document disagrees with an older spec, **this document wins**.

---

## 1. The secret (why this model, in Peter Thiel's terms)

**The question:** what important truth do very few people agree with us on?

**Our answer:** *Most tasks shouldn't exist. Progress isn't measured in things checked off — it's measured in hours invested in a definite future.*

Every tool on the market owns one slice and misses the link between them:

| Category | Examples | What they track | What they miss |
|---|---|---|---|
| To-do lists | Todoist, Things, TickTick | Tasks | *Why.* Busy, not better. |
| Habit trackers | Streaks, Habitica | Repetition | *Where it leads.* Streaks without outcomes. |
| Goal apps | Strides, notes | Outcomes | *The hours.* Goals forgotten by February. |
| Calendars | Google, Apple | Time | *Meaning.* Time without direction. |
| Focus / blockers | Forest, Opal, Brainrot | Focus time | *Direction.* Focus on what? |

**Intentional is the only product that connects one hour to the life you chose:**
`Session (an hour) → Task or Habit → Goal → Pillar`.

That connection is the monopoly. Competing on a better checklist is a race to zero; owning *"is this hour building the life I chose?"* is a category of one.

### Thiel principles we design by

| Principle | What it means here |
|---|---|
| **Definite optimism.** A specific plan for a specific future. | Goals have a **finish line and a date**. Tasks have an **estimate**. No vague intentions. |
| **The power law.** One thing matters more than everything else combined. | **One active goal per pillar.** Today shows **one next task per goal**. |
| **Do one thing.** (PayPal: each person owns exactly one thing.) | Each pillar owns one goal at a time. The rest waits in "Next up". |
| **Competition is for losers.** | We do not build errands, projects, tags, priorities or due-date juggling. Laundry belongs in Apple Reminders. |
| **Durability (last mover).** | The **hour ledger** grows more valuable every year: a person's life, measured in hours given. That history is the moat. |
| **Start small, dominate, then expand.** | First market: ambitious builders, founders and athletes who already think in goals. |

---

## 2. The five concepts (crystal clear)

> **Hours are the currency. Sessions are the only way to earn them. Everything traces to a pillar.**

### Pillar — *what matters* (lifelong)
An area of life you want to improve, with no end date. *Body, Craft, Finances, Family, etc.*
- Max **6** active pillars (`MAX_PILLARS`, `constants/limits.ts`).
- Has a name, color, icon and a *why*.
- Holds **0–1 active goal**, any number of **planned** goals ("Next up"), and any number of habits.
- A pillar may have no goal: that is a *maintenance* pillar (e.g. Family runs on habits only). Intentional nudges, never forces.
- **Measured by:** hours given per week.

### Goal — *what winning looks like, by when* (definite)
A specific outcome inside one pillar, with a finish line and a deadline.
*"Run a half marathon by March 15" · "Ship the MVP by Dec 1" · "Save €5,000 by June 30"*
- Belongs to exactly **one pillar**.
- Has: **title**, **done when** (one sentence: how you'll know it's achieved), **deadline** (required), optional **metric** (current / target / unit, e.g. 12 / 21 km).
- Status: `planned` → `active` → `completed` | `dropped`. **Max 1 `active` per pillar.**
- Completing a goal is a celebration moment and promotes the next planned goal (or asks for one).
- Dropping is allowed and respected: one-line reason, history kept. No shame.
- **Measured by:** progress (metric if set, else tasks done / total), hours given, days left, and **pace** (ahead / on track / behind).

### Task — *a definite step toward a goal* (one-off)
A single piece of work that moves a goal forward. *"Buy running shoes" · "Sign up for the race" · "Write the landing page".*
- Belongs to exactly **one goal** (and so to its pillar). **No orphan tasks.** If a pillar has no goal, the app offers to set one first.
- Has: **title**, **estimate** (minutes: 15 / 30 / 60 / 90 / 120 / custom), optional **planned date**, **done** state, order within the goal.
- Done by checking it off. Hours come from sessions run on it (a task can be done with or without a session).
- **The next task** of a goal = the first not-done task in the goal's order. Today shows the next task of each active goal, plus anything planned for today.
- Unfinished tasks planned for a past day roll forward to Today, labelled quietly ("from Tue"). No red, no guilt.
- **Measured by:** done, and minutes given vs estimate.

### Habit — *a recurring commitment that compounds* (recurring)
Something you do on a schedule to maintain a pillar or to drive a goal. *"Run 30 min" · "Read 20 pages" · "Call home".*
- This is today's **daily action** (`daily_actions` table). In the UI it is called a **habit** from now on.
- Belongs to a **pillar**, and **optionally** to that pillar's goal (e.g. "Run 30 min" → Half marathon).
- Measure: **Timed** (minutes target per day, done when reached via sessions) or **Check** (done/not done). DB values stay `session` / `habit`.
- Schedule: every day (today) → specific weekdays (US-069).
- **Measured by:** done today, streak (respecting its schedule).

### Session — *the hour itself* (the unit of truth)
A block of focused time actually given. The **only** thing that creates "hours given". Tasks and habits are intentions; sessions are reality.
- Attached to exactly **one of**: a **task**, a **habit**, or **just a pillar** (free session). Never to nothing: a free session must pick a pillar.
- Always resolves to a **pillar**, and to a **goal** when its task/habit belongs to one (denormalised on the session for fast rollups).
- Runs in Focus mode, with app blocking when available and the "Leave now?" guard.
- **Rolls up:** session → task minutes / habit day → goal hours → pillar hours.

### One picture

```
Pillar  Body                      lifelong · max 6 · hours/week
 ├─ Goal  Half marathon by Mar 15   definite · 1 active per pillar · progress + pace
 │   ├─ Task   Buy running shoes      one-off · estimate · next task shows on Today
 │   ├─ Task   15 km long run
 │   └─ Habit  Run 30 min, Mon–Sat    recurring · linked to the goal
 └─ Habit  Stretch 10 min daily     recurring · pillar maintenance (no goal)

Session  45 min on "15 km long run"  → task +45m → goal +45m → Body +45m
```

### What we deliberately do NOT build
Projects, sub-tasks, tags, priorities (P1/P2), labels, shared lists, recurring tasks (that's a habit), tasks without a goal, goals without a deadline, more than one active goal per pillar. Each of these is a door back into "busy, not better".

---

## 3. Glossary — UI words vs code names (read this before touching code)

"Goal" already means *pillar* throughout the legacy code. To avoid collisions, the new goal entity is called **Objective** in code.

| UI word | Code type | DB table | Foreign key column on children |
|---|---|---|---|
| **Pillar** | `MetaGoal` (alias `Pillar`) | `meta_goals` | `goal_id` (legacy name — it means pillar) |
| **Goal** | `Objective` | `objectives` | `objective_id` |
| **Task** | `Task` | `tasks` | `task_id` |
| **Habit** | `DailyAction` (alias `Habit`) | `daily_actions` | `action_id` |
| **Session** | `FocusSession` | `focus_sessions` | — |

Rule: never introduce a new column called `goal_id` that means anything other than *pillar*. New code should prefer the aliases `Pillar` and `Habit`.

---

## 4. Data model (target)

All changes ship as **append-only migrations** in `db/migrations.ts` and must work on **both** native SQLite (`db/index.native.ts`) and the web shim (`db/index.web.ts`, a small in-memory SQL engine: register new tables there, keep queries simple — do joins in TypeScript, not SQL).

```sql
-- Goal (US-055)
CREATE TABLE objectives (
  id TEXT PRIMARY KEY,
  pillar_id TEXT NOT NULL,              -- meta_goals.id
  title TEXT NOT NULL,                  -- max 60
  done_when TEXT NOT NULL DEFAULT '',   -- max 140
  deadline TEXT NOT NULL,               -- YYYY-MM-DD (local day)
  status TEXT NOT NULL DEFAULT 'active',-- planned | active | completed | dropped
  metric_current REAL, metric_target REAL, metric_unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  closed_at TEXT,                       -- completed or dropped
  close_note TEXT                       -- reflection / drop reason, max 140
);

-- Task (US-056)
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  objective_id TEXT NOT NULL,
  title TEXT NOT NULL,                  -- max 60
  estimate_minutes INTEGER NOT NULL DEFAULT 30,
  planned_date TEXT,                    -- YYYY-MM-DD or NULL
  is_done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Links (US-057)
ALTER TABLE daily_actions  ADD COLUMN objective_id TEXT;   -- habit → goal (optional)
ALTER TABLE daily_actions  ADD COLUMN days_mask INTEGER NOT NULL DEFAULT 127; -- US-069, bit 0 = Monday
ALTER TABLE focus_sessions ADD COLUMN task_id TEXT;        -- session on a task
ALTER TABLE focus_sessions ADD COLUMN objective_id TEXT;   -- denormalised for rollups
```

Invariants (enforced in `db/api.ts`, unit-tested):
1. At most one `objectives.status = 'active'` per `pillar_id`.
2. A task's `objective_id` must exist; deleting/dropping a goal never deletes its tasks or sessions.
3. A session has `goal_id` (pillar) always; `objective_id` is set when its task or habit has one.
4. Archiving a pillar leaves its goals/tasks/sessions in place (history), hidden from Today.

---

## 5. Today, rebuilt around the model

Today answers one question: **"Where do my next hours go?"**

```
[ hours given today ring ]                       (exists)
[ pillar chips: All · Body · Craft … ]           (exists, wraps)

Body                                   2/4  ˅    (fold rules exist)
  Half marathon · 38 days left · ▓▓▓░░ on track  ← goal line (US-065)
  ▶ Next: 15 km long run · 90 min                ← next task (US-065)
  ○ Run 30 min                                   ← habits due today
  ○ Stretch 10 min
Craft …
```

- Per pillar: the active goal line, the goal's **next task**, tasks planned for today, then habits due today.
- Existing fold rules apply (finished pillars fold; "N done"; "Show N more" past 3).
- Pillar without a goal: a soft "Set a goal for Body" row (US-074), dismissible per pillar.

---

## 6. Build plan (agents: work in this order)

Stories are written in full in `Intentional_user_stories.md` § 11 (US-054 → US-074). Summary and dependencies:

| Lane | Story | Title | Depends on |
|---|---|---|---|
| **G0 Foundations** (sequential) | US-054 | Naming aliases + glossary in code | — |
| | US-055 | `objectives` table, API, invariants | 054 |
| | US-056 | `tasks` table, API | 055 |
| | US-057 | Link habits & sessions to goals/tasks (migration + rollups) | 056 |
| | US-058 | Goal progress & pace domain (pure functions) | 055 |
| **G1 Goals UI** | US-059 | Set a goal for a pillar | 055, 058 |
| | US-060 | Goal on pillar cards & pillar detail | 059 |
| | US-061 | Goal detail screen | 059, 056 |
| | US-062 | Complete a goal (celebration + next) | 061 |
| | US-063 | Drop a goal | 061 |
| **G2 Tasks** | US-064 | Add & order tasks in a goal | 056, 061 |
| | US-065 | Today: goal line + next task + planned tasks | 064, 058 |
| | US-066 | Focus on a task | 057, 065 |
| | US-067 | Gentle rollover of unfinished planned tasks | 065 |
| **G3 Habits** | US-068 | "Daily action" → "Habit" everywhere; link habit to goal | 057 |
| | US-069 | Habit weekdays schedule | 068 |
| **G4 Sessions & insight** | US-070 | Free sessions always pick a pillar | 057 |
| | US-071 | Insights: goals section | 057, 058 |
| | US-072 | Weekly review per goal | 071 |
| **G5 Onboarding & nudges** | US-073 | Onboarding: first goal ("winning in 90 days") | 059 |
| | US-074 | "Set a goal" nudges for goal-less pillars | 060 |

Parallelism: G0 runs first and in order. After US-057/058 merge, lanes G1, G3 and G4 can run in parallel; G2 starts after US-061; G5 last.

---

## 7. Operating rules for agents (24/7)

1. **Source of truth order:** this document → `Intentional_user_stories.md` § 11 → the code. The old design spec files (`Intentional_design_spec*.md`, `Intentional_design_monochrome_spec.md`, `Intentional_redesign_spec.md`) are **historical**: the live design system is `intentional-expo/constants/design.ts` ("Spark": canvas `#FFFCF7`, bold Source Sans 3, CTA 58px/radius 29, Flick mascot). Match existing screens.
2. **One story per branch**, off `develop`: `feat/us-0XX-short-name`. Commits: `feat(scope): description — US-0XX`. Open a PR into `develop`; never push to `main`.
3. **Gates before every PR** (from `intentional-expo/`):
   - `npx tsc --noEmit` → zero errors
   - `npx vitest run` → all green; **every new API/domain function gets unit tests**
   - DB changes: migration test in `db/migrations.test.ts` + works on the web shim
   - UI stories: run the web build (`EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --web`; do **not** set `CI=1`, it disables file watching) and check the screen at 390×844.
4. **Never lose user data.** Migrations are append-only; no destructive SQL; onboarding drafts keep backward compatibility.
5. **Known pitfall:** NativeWind drops function-style `Pressable` styles (`style={({pressed}) => …}`) on native. Use static styles or `PressableScale` (`components/ui/motion.tsx`).
6. **Copy rules:** pillar examples always end with "etc."; no shame language; hours, not checkboxes, are the headline number.
7. **When a product question isn't answered here:** pick the most conservative option, ship, and add the question to § 8 below in the same PR.
8. **After shipping a story:** update `Intentional_current_state.md` (plain-language "what a user can do now") and `Intentional_acceptance_verification.md`.

---

## 8. Open questions (append here; the founder answers)

- Goal metric types beyond a single number (e.g. weight down vs savings up)? *Default: one number with a direction inferred from current vs target.*
- Should completed goals feed a "Life timeline" screen? *Default: later (post-G5).*
- Should a pillar's weekly hour intention ("Body gets 5h/week") exist? *Default: not in this plan.*
