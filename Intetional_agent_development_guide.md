# Agent Development Guide
**For AI agents and human developers · Expo / React Native · Solo project workflow**

---

## Purpose of this document

This guide defines the exact workflow, rules, and conventions for building a mobile app from a set of specification documents. It is written to be followed by an AI coding agent, a human developer, or both working together.

If you are an agent reading this: follow every rule in this document exactly. Do not improvise the workflow. The rules exist because they prevent compounding errors that are expensive to undo.

If you are a human reading this: this is your operating procedure. Treat it like the README of the project.

---

## The documents you have been given

Before writing a single line of code, confirm you have all of the following:

| Document | File | Purpose |
|---|---|---|
| Product Spec | `intentional-spec.docx` | What the app does, screen-by-screen, data models |
| Design Spec | `intentional-design-spec.md` | Every visual rule, token, component, and screen layout |
| Screen Reference | `intentional-screens-reference.png` | Visual ground truth for every screen |
| User Stories | `intentional-user-stories.md` | What to build, why, and how to verify it is done |
| This Guide | `agent_development_guide.md` | How to build it |
| Grain Asset | `grain.png` | Drop into `assets/grain.png` before writing any code |

Read all documents before writing code. If any document is missing, stop and request it.

---

## Section 1 — Project Setup

### 1.1 One-time scaffold

Run these commands once, in order, before doing anything else:

```bash
npx create-expo-app intentional --template blank-typescript
cd intentional

npx expo install expo-router expo-font expo-status-bar
npx expo install @expo-google-fonts/space-grotesk
npx expo install @expo-google-fonts/ibm-plex-mono
npx expo install react-native-svg
npx expo install expo-sqlite
npx expo install @react-native-async-storage/async-storage
npx expo install expo-notifications
```

Copy `grain.png` into `assets/grain.png` immediately after scaffold.

### 1.2 Folder structure

Create this exact folder structure before writing any feature code:

```
app/
  _layout.tsx
  (onboarding)/
    _layout.tsx
    index.tsx
    goal.tsx
    action.tsx
    why.tsx
  (tabs)/
    _layout.tsx
    index.tsx
    focus.tsx
    insights.tsx
    goals.tsx
  session-complete.tsx

components/
  GrainOverlay.tsx
  ScanlineOverlay.tsx
  ActionRow.tsx
  GoalPill.tsx
  SectionLabel.tsx
  ScoreRing.tsx
  TimerRing.tsx
  RadarChart.tsx
  StatCell.tsx
  StreakCard.tsx
  ColorSwatch.tsx
  ChipSelector.tsx
  CTAButton.tsx
  CTAGhost.tsx
  ProgressDots.tsx
  Toast.tsx
  SkeletonRow.tsx

hooks/
  useFocusTimer.ts
  useGoals.ts
  useInsights.ts
  useTodayActions.ts

lib/
  db.ts
  score.ts
  colors.ts
  time.ts

assets/
  grain.png
```

### 1.3 Git initialisation

```bash
git init
git add .
git commit -m "chore: initial scaffold"
git branch develop
git checkout develop
```

`main` is production-only. All development happens on `develop` or feature branches. Never commit directly to `main`.

---

## Section 2 — Git Workflow

### 2.1 Branch naming

Every piece of work lives on its own branch. Branch names follow this pattern:

```
feat/us-001-welcome-screen
feat/us-022-focus-timer
fix/timer-off-by-one
chore/sqlite-schema
refactor/action-row-component
```

Always include the user story ID when the branch implements a story. This creates a traceable link from code to requirements.

### 2.2 Creating a branch

Always branch off `develop`, never off `main` and never off another feature branch:

```bash
git checkout develop
git pull                          # ensure develop is up to date
git checkout -b feat/us-001-welcome-screen
```

### 2.3 Commit format

Every commit follows the Conventional Commits format:

```
type(scope): short description — US-XXX

Optional body explaining what changed and why.
```

**Types:**
- `feat` — new functionality that satisfies a user story
- `fix` — corrects a bug or broken acceptance criterion
- `chore` — setup, config, dependencies, folder structure
- `refactor` — code restructure with no behaviour change
- `style` — visual/design changes only, no logic change
- `test` — adding or updating tests or AC verification notes

**Examples:**
```
feat(onboarding): add welcome screen with James Clear quote — US-001
fix(timer): prevent elapsed count continuing after pause — US-024
chore(db): initialise SQLite schema with all three tables
refactor(ActionRow): extract accent bar into separate component
style(focus): adjust timer ring stroke width from 2px to 1.5px
```

The US-ID in the commit message is mandatory for any `feat` or `fix` commit. It allows `git log --grep="US-022"` to find all commits related to a story instantly.

### 2.4 Merging to develop

Before merging a feature branch to `develop`:
1. All acceptance criteria for the story must pass (see Section 4)
2. The screen must visually match `intentional-screens-reference.png`
3. No TypeScript errors (`npx tsc --noEmit` must pass)
4. The app must not crash on the happy path for that story

```bash
git checkout develop
git merge feat/us-001-welcome-screen --no-ff -m "feat: merge US-001 welcome screen"
git branch -d feat/us-001-welcome-screen
```

Use `--no-ff` (no fast-forward) to preserve the merge commit. This keeps the branch history readable.

### 2.5 Merging to main (releases only)

`main` only receives merges when a sprint is complete and the build is ready for TestFlight or App Store submission:

```bash
git checkout main
git merge develop --no-ff -m "release: v0.1.0 — MVP sprint 1 (US-001 through US-010)"
git tag v0.1.0
git push origin main --tags
```

Version format: `MAJOR.MINOR.PATCH`. For the MVP build sequence, increment MINOR per sprint (`v0.1.0`, `v0.2.0`, `v0.3.0`). Hit `v1.0.0` on App Store launch.

---

## Section 3 — The Story-by-Story Build Loop

This is the core operating loop. Repeat it for every user story, in order.

### 3.1 Build order

Follow this exact sequence. Each step produces something runnable before the next begins:

```
Sprint 1 — Data & Goals
  US-007  SQLite schema (all three tables, relationships)
  US-008  Goals Manager — view list
  US-009  Goals Manager — add new goal
  US-010  Goals Manager — reorder
  US-011  Goals Manager — archive

Sprint 2 — Today Screen
  US-014  Today — view actions grouped by goal
  US-016  Today — mark habit done
  US-034  Today — summary stats (score ring)

Sprint 3 — Focus Session
  US-022  Focus — countdown timer
  US-023  Focus — duration selector
  US-027  Focus — progress ring
  US-024  Focus — pause and resume
  US-025  Focus — end early
  US-028  Session Complete screen
  US-029  Session note

Sprint 4 — Today ↔ Focus integration
  US-015  Today — START button navigates to Focus
  US-003  Onboarding — daily action form (wire to existing models)

Sprint 5 — Insights
  US-031  Insights — bar chart
  US-032  Insights — radar chart
  US-033  Insights — streak cards
  US-035  Insights — time range toggle

Sprint 6 — App Blocking
  US-026  Focus — FamilyControls / Screen Time integration
  US-041  Settings — manage blocked categories

Sprint 7 — Onboarding
  US-001  Welcome screen
  US-002  Create first goal
  US-005  Progress indicator
  US-006  Multiple goals
  US-004  Why statement
  US-049  Empty states
  US-050  Skip logic
  US-051  Onboarding draft persists (AsyncStorage between steps)
  US-052  Navigation guard (onboarding incomplete → stay in flow; see US-049 when complete but empty)

Sprint 8 — Polish & Ship
  US-017  Add action to existing goal
  US-018  Reorder actions
  US-019  Deactivate action
  US-046  Confirm free tier (no paywall)
  Full AC verification pass on all 36 MVP stories
  Visual audit against screen reference PNG
```

**Why this order?** The database schema must exist before any screen that reads or writes data. Goals Manager comes before Today because Today depends on goals existing. Focus Session comes before the START button integration because the screen needs to work standalone first. Onboarding comes last because it just wires together screens that already work.

### 3.2 Loop steps per story

For each story, execute these steps in order. Do not skip steps.

**Step 1 — Read the story**
Open `intentional-user-stories.md`. Find the story by ID. Read the story statement and every acceptance criterion. Do not proceed until you can restate what "done" means for this story.

**Step 2 — Read the relevant design spec section**
Open `intentional-design-spec.md`. Find the screen section that corresponds to this story. Note the exact background color, component list, font sizes, and color tokens. Cross-reference `intentional-screens-reference.png` to see the visual target.

**Step 3 — Create the branch**
```bash
git checkout develop
git checkout -b feat/us-XXX-short-name
```

**Step 4 — Implement**
Write the code. Refer to the component library in `intentional-design-spec.md` Section 3 for every reusable component. Do not invent new components when an existing one satisfies the need.

**Step 5 — Self-verify against acceptance criteria**
Go through each acceptance criterion one by one. For each criterion, either confirm it passes or note exactly what is failing. Do not mark a story done if any criterion is unverified.

**Step 6 — Visual check**
Open `intentional-screens-reference.png`. Find the screen for this story. Compare your implementation side by side. Check: background color, font sizes, spacing, goal color propagation, component shapes.

**Step 7 — TypeScript check**
```bash
npx tsc --noEmit
```
Zero errors required before merge.

**Step 8 — Commit and merge**
```bash
git add .
git commit -m "feat(scope): description — US-XXX"
git checkout develop
git merge feat/us-XXX-short-name --no-ff -m "feat: merge US-XXX"
git branch -d feat/us-XXX-short-name
```

---

## Section 4 — Acceptance Criteria Verification Protocol

**Authoritative per-story matrix:** `Intentional_acceptance_verification.md` — every listed AC has **Met / Not met / Partial** and **step-by-step human checks**. Update that file whenever implementation changes; do not mark a story done without updating the matrix.

Each acceptance criterion is a binary pass/fail check. Here is how to verify the most common criterion types:

### Visual criteria
*"The goal color propagates to the CTA button border"*
→ Open the screen. Change the selected goal color. Confirm the CTA border updates immediately. Test with at least two different colors.

### State criteria
*"Completed actions are visually dimmed (opacity 0.45)"*
→ Mark an action complete. Measure or visually confirm the reduced opacity. Confirm the dimming reverses if the action is un-completed.

### Navigation criteria
*"Tapping START navigates to Focus Session with the action pre-loaded"*
→ Tap START. Confirm you land on Focus Session. Confirm the correct action name and goal name appear. Confirm the correct default duration is pre-selected.

### Data persistence criteria
*"Reordered position is persisted immediately"*
→ Reorder goals. Background the app. Re-open. Confirm the order is preserved.

### Guard criteria
*"User cannot proceed without a goal name"*
→ Leave the name field empty. Confirm the CTA is disabled or shows a validation error. Confirm submitting with an empty field does not navigate forward.

### Timer criteria
*"Paused time is not counted toward session duration"*
→ Start a 60-minute session. Let it run for 30 seconds. Pause for 10 seconds. Resume. Confirm the elapsed time at resume is ~30 seconds, not ~40 seconds.

---

## Section 5 — Design Rules (Non-Negotiable)

These rules are extracted from `intentional-design-spec.md` Section 1. They apply to every screen, every component, every state. Do not override them for convenience.

### 5.1 The split personality rule

Every screen is either BRUTALIST or CLEAN DARK. There is no third option.

| Screen | Mode | Background | Grain | Scanlines |
|--------|------|------------|-------|-----------|
| Welcome (Step 1) | BRUTALIST | `#080808` | ON | ON |
| Create Goal (Step 2) | CLEAN DARK | `#0d0d0d` | OFF | OFF |
| Daily Action (Step 3) | CLEAN DARK | `#0d0d0d` | OFF | OFF |
| Why Statement (Step 4) | CLEAN DARK | `#0d0d0d` | OFF | OFF |
| Today | CLEAN DARK | `#111111` | OFF | OFF |
| Focus Session | BRUTALIST | `#080808` | ON | ON |
| Session Complete | BRUTALIST | `#080808` | ON | ON |
| Insights | CLEAN DARK | `#0d0d0d` | OFF | OFF |
| Goals Manager | CLEAN DARK | `#0d0d0d` | OFF | OFF |

### 5.2 The goal color rule

Every element that belongs to a specific goal uses that goal's color. Neutral chrome never takes a goal color.

**Always goal-colored:** action row accent bar, goal dot, focus timer ring, CTA border+text on goal screens, streak number, radar vertex, bar chart fill, burst rings, swatch selected state, chip selected state.

**Never goal-colored:** tab bar, section labels, dividers, backgrounds, progress dots.

### 5.3 Font rules

- Display/headlines: `SpaceGrotesk-Bold` only
- Labels/metadata/buttons: `IBMPlexMono` only
- Never use system fonts, Inter, Roboto, or any other font family
- Minimum font size: 11px in production UI

### 5.4 Opacity rules for goal colors on dark backgrounds

| Use case | Opacity |
|----------|---------|
| Text, strokes, dot fills | 1.0 |
| Bar chart fills | 0.85 |
| Border colors | 0.28 — use `hexToRgba(color, 0.28)` |
| Radar polygon fill | 0.15 |
| Burst inner circle | 0.08 |

### 5.5 Border width rule

All borders are `0.5px`. No exceptions. The only exception is the timer ring and swatch selection ring which are `1.5px`.

---

## Section 6 — Environments

### 6.1 Expo Go (local dev)

Use for: UI screens, navigation, SQLite, state management, anything that does not require native entitlements.

Do not use for: FamilyControls (app blocking), RevenueCat (purchases), WidgetKit, PhotosUI wallpaper generation.

Start development server:
```bash
npx expo start
```

### 6.2 Development Build (EAS)

Required from Sprint 6 onwards (FamilyControls integration).

First-time setup:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

Build for iOS simulator:
```bash
eas build --platform ios --profile development
```

Build for physical device (required for FamilyControls):
```bash
eas build --platform ios --profile development --local
```

Install on device via Expo Dev Client.

### 6.3 Production Build (TestFlight / App Store)

Only built from `main` branch after a sprint merge:

```bash
git checkout main
eas build --platform ios --profile production
eas submit --platform ios
```

Never build production from `develop` or a feature branch.

---

## Section 7 — Common Pitfalls and How to Avoid Them

### Pitfall 1 — Building multiple stories at once
**Symptom:** Code for two features is intertwined in a single commit or branch.
**Rule:** One branch per story. One story per agent session. Complete and merge before starting the next.

### Pitfall 2 — Skipping the visual check
**Symptom:** Screens pass AC technically but look wrong — wrong font, wrong spacing, wrong opacity.
**Rule:** Always compare against `intentional-screens-reference.png` before merging. The image is the source of truth, not memory.

### Pitfall 3 — Using the wrong background color
**Symptom:** BRUTALIST screens use `#0d0d0d` instead of `#080808`, or vice versa.
**Rule:** Check the split personality table in Section 5.1 for every screen before writing its StyleSheet.

### Pitfall 4 — Hardcoding goal colors
**Symptom:** A component has `color: '#8B5CF6'` hardcoded instead of reading from the goal object.
**Rule:** Goal color is always passed as a prop. Never hardcode a goal color in a component. Use `goal.color` and `hexToRgba(goal.color, 0.28)` from `lib/colors.ts`.

### Pitfall 5 — Testing FamilyControls in Expo Go
**Symptom:** App blocking silently fails or crashes in development.
**Rule:** FamilyControls requires a dev build on a physical device. Do not attempt to test it in the simulator or Expo Go.

### Pitfall 6 — Forgetting `--no-ff` on merges
**Symptom:** Feature branches fast-forward into develop, losing the branch history.
**Rule:** Always use `git merge --no-ff`. This preserves the story-level grouping in git log.

### Pitfall 7 — Committing without a US-ID
**Symptom:** `git log --grep="US-022"` returns nothing, making it impossible to trace changes to requirements.
**Rule:** Every `feat` and `fix` commit must include the US-ID. `chore` and `refactor` commits are exempt.

### Pitfall 8 — Building onboarding first
**Symptom:** Onboarding navigates to screens that don't exist yet, making it impossible to test end-to-end.
**Rule:** Follow the build order in Section 3.2 exactly. Onboarding is Sprint 7, not Sprint 1.

---

## Section 8 — The Handoff Checklist

Before declaring the MVP complete and submitting to the App Store, verify every item on this list:

### Code quality
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] No `console.log` statements in production code
- [ ] No hardcoded goal colors in components
- [ ] All 36 MVP user story acceptance criteria verified and passing
- [ ] `develop` branch is clean (no uncommitted changes)
- [ ] `main` is tagged `v1.0.0`

### Visual
- [ ] Every screen visually matches `intentional-screens-reference.png`
- [ ] BRUTALIST screens have grain + scanlines active
- [ ] CLEAN DARK screens have no grain or scanlines
- [ ] Goal color propagates correctly on all screens
- [ ] SpaceGrotesk and IBMPlexMono render correctly on physical device

### Data
- [ ] SQLite database initialises correctly on first launch
- [ ] All three tables created: `meta_goals`, `daily_actions`, `focus_sessions`
- [ ] Onboarding completion flag set in AsyncStorage
- [ ] App routes to onboarding on fresh install, Today on return

### Device testing
- [ ] Tested on physical iPhone (not just simulator)
- [ ] Focus timer runs correctly for a full 25-minute session
- [ ] App block engages and disengages correctly around a session
- [ ] App recovers gracefully if force-quit during an active session

### App Store preparation
- [ ] App icon created (1024x1024px, no alpha channel)
- [ ] Screenshots created for iPhone 6.7" and 6.1" sizes
- [ ] Privacy manifest completed (no third-party data collection for MVP)
- [ ] App description written (see marketing phase)
- [ ] Keywords list prepared for ASO

---

## Section 9 — Quick Reference Card

```
DAILY WORKFLOW
──────────────
1. Pick next story from build order (Section 3.2)
2. git checkout develop && git checkout -b feat/us-XXX-name
3. Read story + AC in user-stories.md
4. Read screen spec in design-spec.md
5. Build
6. Verify every AC (Section 4)
7. Visual check against screens-reference.png
8. npx tsc --noEmit
9. git commit -m "feat(scope): description — US-XXX"
10. git checkout develop && git merge feat/us-XXX --no-ff
11. git branch -d feat/us-XXX-name
12. Repeat

BRANCH TYPES        COMMIT TYPES
────────────        ────────────
feat/us-XXX-name    feat(scope): ... — US-XXX
fix/short-desc      fix(scope): ... — US-XXX
chore/what          chore: ...
refactor/what       refactor(scope): ...
                    style(scope): ...

ENVIRONMENTS
────────────
Expo Go        → UI, navigation, SQLite, state
Dev Build      → FamilyControls, RevenueCat, native APIs
Production     → TestFlight, App Store (main branch only)

BACKGROUND COLORS
─────────────────
BRUTALIST     #080808  (Focus, Session Complete, Welcome)
CLEAN DARK    #0d0d0d  (Today bg: #111111, everything else)
CARD          #161616
ELEVATED      #1a1a1a

GOAL COLORS
───────────
Physique   #4A9EED    Finances   #22C55E
Skills     #8B5CF6    Mind       #F59E0B
Border variant: hexToRgba(color, 0.28)
```

---

*This guide is version-controlled alongside the project. Update it when the workflow changes.*
*Last updated: v1.0 — MVP build phase.*