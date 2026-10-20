# Intentional — instructions for agents

Intentional is a React Native / Expo app (`intentional-expo/`) that connects every hour you focus to the life you chose:
**Session → Task or Habit → Goal → Pillar.**

## Start here
1. Read **`Intentional_goals_model.md`**: the product model (pillars, goals, tasks, habits, sessions), the glossary of UI words vs code names, the data model, the build plan and the operating rules. It overrides older specs.
2. Pick the **next unshipped story** from its build plan (§ 6, in order; respect "Depends on"). Full acceptance criteria are in `Intentional_user_stories.md` § 11 (US-054 → US-074).
3. Check `git log --oneline --grep="US-0XX"` and open PRs first, so you don't redo shipped work.

## Must-know
- **"Goal" means pillar in legacy code.** `MetaGoal` / `meta_goals` / `goal_id` = **Pillar**. The new goal entity is **`Objective`** / `objectives` / `objective_id`.
- **Design system:** `intentional-expo/constants/design.ts` ("Spark") and the existing screens. The `Intentional_design_spec*.md`, monochrome and redesign specs are historical.
- **Data:** append-only migrations in `db/migrations.ts`; everything must work on native SQLite and the web shim `db/index.web.ts` (register tables there; do joins in TypeScript).
- **Pressable styles:** never use `style={({ pressed }) => …}` (NativeWind drops it on native). Use static styles or `PressableScale`.
- **Web dev server:** `EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --web`; never `CI=1`.

## Definition of done (every story)
- One branch per story off `develop` (`feat/us-0XX-short-name`); commit `feat(scope): description — US-0XX`; PR into `develop`, never `main`.
- From `intentional-expo/`: `npx tsc --noEmit` has zero errors, and `npx vitest run` is green, with new tests for new logic.
- UI checked on the web build at 390×844.
- `Intentional_current_state.md` and `Intentional_acceptance_verification.md` are updated.
- Unanswered product question: take the conservative option and log it in `Intentional_goals_model.md` § 8.
- Never commit personal media at the repo root (WhatsApp images, `*.MP4`, screenshots).
