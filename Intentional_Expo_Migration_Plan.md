# Intentional: iOS (Swift) → Expo Migration Plan

## 1. Rationale for Switching to Expo

| Factor | Native iOS (current) | Expo (React Native) |
|--------|----------------------|----------------------|
| **Platform** | iOS only | iOS + Android from one codebase |
| **Iteration** | Xcode, Mac required; slower builds | JS/TS hot reload; Expo Go for quick testing |
| **Team** | Swift expertise | Broader pool (React/JS); easier onboarding |
| **Persistence** | SwiftData (iOS 17+) | expo-sqlite or AsyncStorage — cross-platform |
| **App blocking** | FamilyControls (iOS only) | No built-in equivalent; optional native module or defer |

**Trade-offs:** We gain cross-platform and faster iteration; we lose or defer native-only features (Screen Time app blocking, lock screen widgets) unless we add custom native code later.

---

## 2. Stack Mapping

| Current (iOS) | Expo Equivalent |
|---------------|-----------------|
| SwiftUI | React Native + Expo (View, Text, StyleSheet, etc.) |
| SwiftData (@Model) | expo-sqlite (SQL) or AsyncStorage + JSON |
| MVVM + @Observable | React state (useState, useContext) or Zustand |
| ModelContainer / @Query | SQLite queries or in-memory store + hooks |
| FamilyControls | Stub or future config plugin / dev client module |
| Charts (SwiftUI) | react-native-chart-kit or victory-native or SVG |
| Navigation (TabView) | Expo Router (file-based) or React Navigation |

**Chosen stack for migration:**
- **Expo SDK 52+** (latest stable)
- **expo-sqlite** for local persistence (schema mirrors SwiftData models)
- **Expo Router** for tabs and screens (Today, Focus, Insights, Goals, Onboarding)
- **Zustand** (or React state) for focus timer and shared UI state
- **TypeScript** for types (MetaGoal, DailyAction, FocusSession, HabitCompletion)

---

## 3. Data Layer Migration

### 3.1 Schema (expo-sqlite)

Same logical schema as product spec §3.1:

- **meta_goals** — id (TEXT PK), name, color, icon, sort_order, why_statement, is_archived
- **daily_actions** — id, goal_id (FK), name, type ('habit' \| 'session'), target_minutes, reminder_time, is_active, sort_order
- **focus_sessions** — id, action_id, goal_id, started_at, ended_at, duration_seconds, note, was_completed
- **habit_completions** — id, action_id, date, completed

### 3.2 Access Pattern

- **Hooks:** `useGoals()`, `useTodayActions()`, `useFocusSessions(dateRange)`, `useHabitCompletions(date)`
- **Mutations:** `insertGoal()`, `updateGoal()`, `archiveGoal()`, `addAction()`, `toggleHabit()`, `saveFocusSession()`
- All reads/writes go through a single `db` instance (expo-sqlite).

---

## 4. Screen-by-Screen Migration

| iOS Screen | Expo Route / Screen | Notes |
|------------|---------------------|--------|
| Onboarding (4 steps) | `/` → `/onboarding` → redirect to `/(tabs)` | AsyncStorage: `hasCompletedOnboarding` |
| Today | `/(tabs)/today` | Same layout: score ring, goal filter, action list |
| Focus (pre + active + complete) | `/(tabs)/focus`, modal or stack for active/complete | Timer with setInterval; no app block in MVP |
| Session Complete | Modal or `/(tabs)/focus/complete` | Celebration + note + “Back to Today” |
| Insights | `/(tabs)/insights` | Bar chart + radar (library) + streaks + summary |
| Goals Manager | `/(tabs)/goals` | List, add/edit goal, goal detail with actions |

---

## 5. What We Defer or Stub

- **App blocking (FamilyControls):** No Expo API. Options: (1) Stub “Apps blocked” badge (no real block), (2) Later: EAS Build + custom native module or config plugin. **MVP: stub.**
- **Lock screen wallpaper / widgets:** Out of scope for MVP; can revisit with expo-widgets or native modules.
- **Reminders (UNUserNotificationCenter):** Use expo-notifications for local reminders in a future iteration.

---

## 6. Implementation Phases (Aligned to Sprints)

| Phase | Deliverable |
|-------|-------------|
| **1. Foundation** | Expo app init (Expo Router, TypeScript), sqlite schema + migrations, design tokens (colors, spacing), base components (GoalChip, PrimaryButton, ActionRow). |
| **2. Goals** | Goals tab: list, add/edit goal, goal detail with actions (add/edit/reorder/archive). |
| **3. Today** | Today tab: date, score ring, goal filter, action list (habit toggle, Start → Focus with action). |
| **4. Focus** | Focus tab: pre-session (select action + duration), active timer (pause/end), session complete (time, streak, note). Persist FocusSession. |
| **5. Insights** | Insights tab: time range, bar chart, radar, streaks, summary stats; empty state. |
| **6. Onboarding** | Onboarding gate: 4 steps (Welcome, Goals, First Action, Why); set flag + seed first goal/action; then show tabs. |

---

## 7. Folder Structure (Expo)

```
intentional-expo/
├── app/
│   ├── _layout.tsx           # Root layout, onboarding gate
│   ├── index.tsx             # Redirect
│   ├── onboarding.tsx        # 4-step flow
│   └── (tabs)/
│       ├── _layout.tsx       # Tab navigator
│       ├── today.tsx
│       ├── focus.tsx
│       ├── insights.tsx
│       └── goals.tsx
├── components/
│   ├── GoalChip.tsx
│   ├── PrimaryButton.tsx
│   ├── ActionRow.tsx
│   └── TodayScoreRing.tsx
├── db/
│   ├── index.ts              # SQLite init, schema
│   └── hooks.ts              # useGoals, useTodayActions, etc.
├── stores/
│   └── focusStore.ts         # Timer state (Zustand or React)
├── constants/
│   └── design.ts             # Colors, spacing, typography
└── types/
    └── index.ts              # MetaGoal, DailyAction, FocusSession, HabitCompletion
```

---

## 8. Migration Checklist

- [ ] Create Expo app (npx create-expo-app intentional-expo --template tabs)
- [ ] Add expo-sqlite, define schema, implement hooks
- [ ] Add design constants and base components
- [ ] Implement Goals tab (list, add/edit, actions)
- [ ] Implement Today tab (score, actions, habit toggle, Start → Focus)
- [ ] Implement Focus flow (pre-session, timer, session complete)
- [ ] Implement Insights (charts, streaks, summary)
- [ ] Implement Onboarding (4 steps, persistence, redirect)
- [ ] Keep existing iOS project in `/Intentional` for reference; document in README that Expo is the primary codebase going forward

---

## 9. Post-Migration

- Update main README to describe the Expo app as the primary build; keep iOS folder as “legacy” or “reference.”
- Product spec can be updated to “iOS & Android (Expo)” and “React Native + expo-sqlite.”
- Plan v1.1 features (reminders, widgets, optional app blocking) against Expo’s ecosystem and native modules.
