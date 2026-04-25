# Intentional Engineer Handoff

## Purpose

This document is the implementation handoff for the Intentional Expo app.

The product goal is an iPhone-first, local-first attention ledger:

```text
life pillars -> daily actions -> focus sessions -> insights
```

The user should be able to name what matters, attach daily action to it, log focus time honestly, and see where time went. Everything else is secondary until that loop is reliable.

## Source Of Truth

- Product truth: `../Intentional_product_spec.md`
- Visual truth: `DESIGN.md`
- Visual references: `design-references/quiet-ledger/*.html`
- System design: `SYSTEM_DESIGN.html`
- Existing Expo app: `app/`, `db/`, `services/`, `modules/family-controls/`

Ignore older dark/brutalist visual direction for new UI work. `DESIGN.md` and the Quiet Ledger references are the current direction.

## Architectural Decisions

1. V1 is iPhone-first. Android and web are development/demo surfaces unless explicitly promoted later.
2. Add focused tests before broad redesign or refactor work.
3. Disable premium gates for MVP. Real RevenueCat work is deferred.
4. Extract focus/session domain logic before rewriting the Focus UI.
5. Keep data local. No account, backend, sync, or remote analytics are part of this MVP.

## What Already Exists

The core data graph already exists in SQLite:

```text
meta_goals
  id, name, color, icon, sort_order, why_statement, is_archived

daily_actions
  id, goal_id, name, type, target_minutes, reminder_time, is_active, sort_order

focus_sessions
  id, action_id, goal_id, started_at, ended_at, duration_seconds, note, was_completed

habit_completions
  id, action_id, date, completed

settings
  key, value

weekly_reviews
  id, week_start, went_well, improve, adjustments, created_at
```

Relevant files:

- `db/index.native.ts` owns native SQLite setup and migrations.
- `db/index.web.ts` is a web shim for development/demo.
- `db/api.ts` owns CRUD, aggregates, streaks, CSV export, weekly reviews, and settings helpers.
- `db/hooks.ts` exposes screen-facing read hooks.
- `services/notifications.ts` schedules action reminders and weekly review reminders.
- `services/appBlocking.ts` wraps the local Family Controls module.
- `modules/family-controls/` owns the iOS native bridge.
- Premium purchase stubs have been removed for MVP; monetization should be added only when product explicitly reintroduces it.

## Design References Impact

The design references are not just visual polish. They define state coverage and therefore affect architecture.

### Today

Reference: `design-references/quiet-ledger/today.html`

Required states:

- Mixed habit/session states.
- Empty day with `Add action` and `Start manual focus`.
- Partially logged session with progress and useful plain-language truth.

Architecture implication:

- Today needs grouped pillar/action progress from one reliable query path.
- Manual focus entry must be available even when no action is assigned today.
- Action rows need enough data to answer: action kind, today state, logged/target progress, next tap.

### Focus

Reference: `design-references/quiet-ledger/focus.html`

Required states:

- Pre-session selection.
- Active shielded session.
- Paused honest break.
- Shield denied / timer-only fallback.

Architecture implication:

- Focus should be modeled as a state machine, not as incidental screen state.
- Timer state and shield state are separate concepts.
- Active Focus should hide bottom navigation.
- Shield copy must be honest: category shield, timer only, denied, unsupported, or no selection.

### Session Complete

Reference: `design-references/quiet-ledger/session-complete.html`

Required states:

- Natural completion.
- Ended early, partial time counts.
- Optional short note.

Architecture implication:

- Session persistence must happen before note editing.
- Partial sessions are valid ledger entries.
- Note update should mutate only the note field after the session row exists.

### Insights

Reference: `design-references/quiet-ledger/insights.html`

Required states:

- Populated week.
- Empty ledger.
- Uneven pillar week with useful discomfort.

Architecture implication:

- Use bar-first aggregates for MVP.
- Every chart needs a plain-language sentence.
- Avoid decorative radar unless it is strictly more legible than bars.

### Goals

Reference: `design-references/quiet-ledger/goals.html`

Required states:

- List with weekly evidence.
- Lightweight detail.
- Archive confirmation with history kept.

Architecture implication:

- Archive is a soft delete.
- Historical sessions stay queryable after archive.
- Goal detail should be useful without requiring premium gates.

### Onboarding

Reference: `design-references/quiet-ledger/onboarding.html`

Required states:

- Pick/create 3-5 pillars.
- Add one action.
- Optional why.

Architecture implication:

- Onboarding should get to a usable Today quickly.
- Draft persistence is fine, but committed product state belongs in SQLite.
- Current code has more onboarding steps than the visual contract. Simplify unless product explicitly wants the longer flow.

### Reminders

Reference: `design-references/quiet-ledger/reminders.html`

Required states:

- Reminder setup inside action edit.
- Permission prompt after user intent.
- Disabled/no-punishment state.

Architecture implication:

- One local reminder per action for MVP.
- Reminder identifiers should be action-specific.
- Notification payload should carry the action id and route to Today or preselected Focus.

## Target Data Flow

```text
Onboarding / Goals
  -> db/api.addGoal()
  -> db/api.addAction()
  -> Today reads grouped actions

Today / Reminder / Focus tab
  -> selected goal + action
  -> focus session controller
  -> AppBlocking.applyShields() when available
  -> db/api.saveFocusSession()
  -> optional db/api.updateFocusSessionNote()
  -> AppBlocking.removeShields()
  -> Today + Insights refresh from SQLite

Insights
  -> db/api.getSessionsBetween()
  -> group by goal
  -> render bars + plain-language summary
```

## Required Build Order

### Phase 0: Safety And Boundaries

1. Add a test runner and basic test setup.
2. Add tests for `db/api.ts` pure helpers and core queries.
3. Add tests for migration/version behavior in `db/index.native.ts` or an extracted migration helper.
4. Add tests for `services/notifications.ts` parsing and schedule/cancel behavior with mocks.
5. Extract focus/session domain logic from `app/(tabs)/focus.tsx`.
6. Test focus/session transitions before rewriting the Focus UI.

Minimum focus state model:

```text
idle
  -> preparing
  -> focusing
  -> paused
  -> completed
  -> aborted

shield:
  unsupported | no_selection | denied | applying | applied | removed
```

### Phase 1: Quiet Ledger Foundation

1. Replace `constants/design.ts` with Quiet Ledger tokens from `DESIGN.md`.
2. Update `tailwind.config.js` semantic colors, radius, spacing, and type scale.
3. Load:
   - `InstrumentSerif-Regular`
   - `InstrumentSerif-Italic`
   - `SourceSans3-Regular`
   - `SourceSans3-Medium`
   - `SourceSans3-SemiBold`
   - `SourceSans3-Bold`
   - `IBMPlexMono-Regular`
   - `IBMPlexMono-Medium`
   - `IBMPlexMono-SemiBold`
4. Rebuild shared primitives:
   - `PrimaryButton`
   - `ActionRow`
   - cards/group containers
   - chips
   - text inputs
   - goal color helpers
5. Update tab shell to warm floating pill.

Do this before screen conversion so the screen diffs stay small.

### Phase 2: Screen Conversion

Recommended order:

1. Today
2. Goals
3. Focus
4. Session Complete
5. Insights
6. Onboarding
7. Reminders/settings polish

Reasoning:

- Today and Goals validate the domain graph.
- Focus validates the highest-risk state machine.
- Session Complete validates append-only ledger behavior.
- Insights validates aggregates.
- Onboarding and Reminders can then write into a stable system.

### Phase 3: Native And Release Hardening

1. Update `app.json` for iPhone-first v1:
   - `ios.supportsTablet` should be false unless product reverses the decision.
   - `userInterfaceStyle` should not force old dark mode across the whole app.
   - splash/background colors should match Quiet Ledger.
2. Test Family Controls on a custom iOS build, not Expo Go.
3. Test notification permissions and reminder delivery on device.
4. Remove or disable premium gating for MVP flows.
5. Update `README.md` to stop promising cross-platform v1 behavior.

## Test Plan

### Unit

- `db/api.ts`
  - create/update/archive goals
  - create/update/deactivate actions
  - focus session save and note update
  - habit completion toggle
  - weekly seconds by goal
  - session history rows after action deletion
  - CSV escaping
  - streak helpers

- focus/session domain
  - start from selected action
  - natural completion saves completed session
  - early end saves partial session
  - navigation abandon saves partial session
  - note save updates existing session
  - shields are removed on completion, early end, and abandon
  - pause policy behavior after decision is made

- notifications
  - valid and invalid `HH:MM`
  - permission denied does not schedule
  - schedule cancels prior action reminder first
  - action notification payload includes action id

### Component / Screen

- Today empty state, mixed action state, partial session state.
- Goals list, detail, edit, archive confirmation.
- Focus pre-session, active, paused, denied/unsupported.
- Session complete natural, early, note.
- Insights populated, empty, uneven.
- Onboarding draft restore and final commit to SQLite.
- Reminders on/off and permission prompt.

### Device QA

- Family Controls authorization.
- FamilyActivityPicker selection persistence.
- Shields apply at focus start.
- Shields remove at completion, early end, abandon, and app background/unmount.
- Local notifications fire and route to expected destination.
- Dynamic Type does not clip primary actions.
- Reduced Motion does not rely on decorative transitions.

## Not In Scope For MVP

- Backend, accounts, cloud sync, or cross-device state.
- Android app-blocking parity.
- Web as a production persistence target.
- Widgets.
- Rich reminder schedules, multiple reminders per action, snooze rules.
- Real RevenueCat subscriptions.
- Full wallpaper/productized ambient layer.
- Decorative analytics beyond bar-first insights.

## Open Decisions

### Pause Shield Policy

Design reference says paused state can show `Shield lifted`. Engineering needs the final product decision:

- Option A: pause lifts shields, resume reapplies them.
- Option B: pause keeps shields until session ends.

Architect recommendation: Option A, because the reference frames pause as an honest break and the app should not be punitive. Add tests either way.

### Weekly Review

Product spec places weekly review after MVP, but current code already has weekly review surfaces.

Architect recommendation: keep code only if it does not distract from core loop; remove premium gating; treat it as post-MVP unless the founder explicitly wants it in v1.

## Regression Risks To Watch

- Deleting an action should not break old session history.
- Archiving a goal should not delete historical sessions.
- Time ranges based on UTC may not match the user's local day; test local-day expectations before release.
- Active Focus currently sits under tab routing; ensure active session cannot be covered by bottom nav.
- AppBlocking module is unavailable in Expo Go; UI must show capability states instead of generic failure.
- Monetization is not wired in MVP; do not add fake entitlement logic to shipped routes.

## Definition Of Done

- Core loop works on iPhone custom build:
  - create pillar
  - create action
  - start focus
  - complete or end early
  - add note
  - see Today progress
  - see Insights by pillar
  - archive a goal without losing history
- Quiet Ledger tokens and fonts are loaded.
- Old brutalist/dark default styling is removed from main app surfaces.
- Tests cover persistence, focus transitions, reminders, and key screen states.
- README and app config match iPhone-first v1.
- No MVP route depends on fake premium entitlement.
