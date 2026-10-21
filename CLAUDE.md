# Intentional — instructions for agents

Intentional is a React Native / Expo app (`intentional-expo/`) that connects every hour you focus to the life you chose:
**Session → Task or Habit → Goal → Pillar.**

## Start here
0. **Read `Intentional_agent_feedback.md` first** (review of the first run: what was missed and the new binding rules).
1. **`Intentional_agent_build_plan.md`** is your main brief: the full backlog (US-054 → US-095, local model, retention, social with Supabase), the **verification protocol** (mandatory) and the reporting rules.
2. **`Intentional_build_log.md`**: read its "Situation" first; write an entry for every story and a final report for every run.
3. **`Intentional_goals_model.md`**: the product model, the glossary of UI words vs code names, the local data model. Full AC for US-054 → US-078 are in `Intentional_user_stories.md` § 11.
4. Check `git log --oneline --grep="US-0XX"` and open PRs first, so you don't redo shipped work.

## Must-know
- **"Goal" means pillar in legacy code.** `MetaGoal` / `meta_goals` / `goal_id` = **Pillar**. The new goal entity is **`Objective`** / `objectives` / `objective_id`.
- **Design system:** `intentional-expo/constants/design.ts` ("Spark") and the existing screens. The `Intentional_design_spec*.md`, monochrome and redesign specs are historical.
- **Data:** append-only migrations in `db/migrations.ts`; everything must work on native SQLite and the web shim `db/index.web.ts` (register tables there; do joins in TypeScript).
- **Pressable styles:** never use `style={({ pressed }) => …}` (NativeWind drops it on native). Use static styles or `PressableScale`.
- **Web dev server:** `EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --web`; never `CI=1`.

## Verify everything
From `intentional-expo/`: `npm run typecheck` · `npm test` · `npm run e2e` (web server running; see `e2e/lib.mjs`). Native-only behaviour is never "verified" from the web: list it under "Needs device check" with steps.

## Definition of done (every story)
- One branch per story off `develop` (`feat/us-0XX-short-name`); commit `feat(scope): description — US-0XX`; PR into `develop`, never `main`.
- From `intentional-expo/`: `npx tsc --noEmit` has zero errors, and `npx vitest run` is green, with new tests for new logic.
- UI checked on the web build at 390×844.
- `Intentional_build_log.md` entry (every criterion with a verdict) and Situation updated; `Intentional_current_state.md` updated.
- Unanswered product question: take the conservative option and log it in `Intentional_goals_model.md` § 8.
- Never commit personal media at the repo root (WhatsApp images, `*.MP4`, screenshots).
