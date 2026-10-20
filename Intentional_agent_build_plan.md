# INTENTIONAL — Build plan for cloud agents
**Version 1 · 2026-10-20 · written by the founder's local agent (Claude), who will audit your work**

> You are building the next version of Intentional. This file tells you **what** to build (every feature, in order),
> **how to verify it** (verification is not optional — it is the job), and **how to report** so your work can be
> picked up, audited and fixed later. Read it fully before your first commit. Re-read § 2 and § 3 before every PR.

---

## 0. Read first (in this order)

1. `CLAUDE.md` — repo rules (short).
2. `Intentional_goals_model.md` — the product model: Pillar → Goal → Task / Habit → Session, the glossary (**UI "Goal" = code `Objective`; legacy `MetaGoal`/`goal_id` = Pillar**), the local data model, Today's layout, the open-questions list.
3. `Intentional_user_stories.md` § 11 — full acceptance criteria for US-054 → US-078.
4. This file — the full backlog (including retention and social, US-079 → US-095, written in § 6 and § 7 below), verification, Supabase, reporting.
5. `Intentional_build_log.md` — what previous agents did. **Start from its "Situation" section.**

The product in one line: *Intentional connects every hour you focus to the life you chose. Hours are the currency; sessions are the only way to earn them; everything traces to a pillar.*

---

## 1. Ground rules

- **One story per branch**, off `develop`: `feat/us-0XX-short-name`. Commit: `feat(scope): description — US-0XX` (also `fix`, `test`, `chore`, `docs`). Open a **PR into `develop`**. Never push to `main`. Never force-push shared branches.
- **Order matters.** Follow § 5. Do not start a story whose dependencies are not merged (or at least in a PR you build on top of, stated in the log).
- **No secrets in git.** Supabase URL and anon key go in `intentional-expo/.env` (git-ignored) as `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`; commit `.env.example` with placeholders. The **service-role key never appears in app code or in git** — only in your agent environment for admin/test scripts.
- **Never lose user data.** Local SQLite migrations are append-only (`db/migrations.ts`), Supabase migrations are append-only SQL files. No destructive SQL against production tables except in a migration that preserves data, reviewed in the log.
- **Local-first.** The app must stay fully usable offline and without an account. Cloud features are additive.
- **Design:** `intentional-expo/constants/design.ts` ("Spark") and existing screens are the reference. The `Intentional_design_spec*.md`, monochrome and redesign specs are historical. Flick (`components/onboarding/Mascot.tsx`) is the brand: reuse it, `FlickScenes.tsx` (Confetti, etc.) and `components/ui/motion.tsx` (`PressableScale`).
- **Known pitfalls:** never `style={({ pressed }) => …}` on `Pressable` (NativeWind drops it on native); web dev server is `EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --web` (never `CI=1`); the web DB is a shim (`db/index.web.ts`): register new tables there and do joins in TypeScript.
- **Copy rules:** pillar examples end with "etc."; no shame or red "failure" language; hours given is the headline number; no XP, coins, leagues or public stranger leaderboards (see `Intentional_goals_model.md` § 1 and § 7 below for why).
- **Unclear product decision?** Take the most conservative option, ship, and add the question to `Intentional_goals_model.md` § 8 *and* to the log's "Questions for the founder".

---

## 2. Verification protocol (mandatory for every story)

A story is **done only when every applicable level below passes and the evidence is in the build log.** "It should work" is not evidence. If you cannot verify something, say so explicitly — never claim it.

All commands run from `intentional-expo/`.

| Level | What | Command / method | Required when |
|---|---|---|---|
| **L1 Static** | Type safety | `npm run typecheck` → **0 errors** | Always |
| **L2 Unit** | Logic is correct | `npm test` → **all green**. Every new function in `db/`, `services/`, `utils/` gets unit tests (happy path + edge cases listed in the story). Never delete or weaken an existing test to make it pass; if a test is genuinely obsolete, explain why in the log. | Always |
| **L3 Local data** | Migrations & invariants | Migration test in `db/migrations.test.ts` (fresh install **and** upgrade from the previous version with existing rows); invariant tests in `db/api.test.ts`; table registered in `db/index.web.ts` | Any local schema/API change |
| **L4 Cloud data** | Supabase schema, RLS, RPCs | SQL migration applied to the project (§ 4); `npm run test:rls` (you create it in US-087) passes: owner can read/write own rows, **another user cannot**, circle/witness RPCs refuse non-members; Supabase security advisors show **no table without RLS** | Any Supabase change |
| **L5 E2E (web)** | The feature works for a user | Start the web server (`EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start --web --port 8081`), then `npm run e2e` → **all suites pass** (existing + yours). Add or extend a suite in `e2e/` for your story: drive the UI like a person, assert with `ok()`, take screenshots with `shot()`. See `e2e/lib.mjs`. | Any UI story |
| **L6 Visual** | It looks right | Open your suite's screenshots in `e2e/artifacts/<suite>/` and check them against existing screens (spacing, Spark colors, Flick, no overflow at 390 px, no horizontal scroll). Describe what you checked in the log. | Any UI story |
| **L7 Device-only** | Things the web can't run | Notifications, notification actions, app blocking (FamilyControls/DeviceActivity), haptics, sound, Sign in with Apple, share sheet. **Do not mark these verified.** Write exact manual test steps for the founder under "Needs device check" in the log (what to tap, what should happen). Still unit-test the logic around them (schedule builders, payloads, guards). | Native features |
| **Regression** | Nothing else broke | Before opening the PR: L1 + L2 + full `npm run e2e`. If an existing e2e check changes because the UI changed **on purpose**, update the suite and say so in the log. | Always |

**Honesty rules**
- Report results with numbers: "typecheck 0 errors · vitest 61/61 · e2e 3/3 suites (onboarding 65 ✓, today 8 ✓, goals 14 ✓)".
- Use exactly these verdicts per acceptance criterion: **✅ Verified (how)** · **🟡 Partially verified (what's missing)** · **📱 Needs device check (steps)** · **❌ Not done (why)**.
- If something fails and you can't fix it, ship nothing broken: leave the story open, write the failure and your hypothesis in the log.

**Running e2e in your environment:** `npx playwright install chromium` once (Playwright is a dev dependency). Use `E2E_BASE_URL` to point at your server and `E2E_CHROME` only if you need a specific Chrome binary. Seed state with `t.seed()` / `makeDb()` from `e2e/lib.mjs` instead of clicking through onboarding for every test.

---

## 3. Reporting protocol — `Intentional_build_log.md` (mandatory)

The log is how the founder and his local agent pick up, audit and fix your work. Keep it **true, specific and current**.

1. **At the start of a session:** read the "Situation" section. Don't redo shipped work (`git log --grep="US-0XX"`, open PRs).
2. **During a story:** keep notes; commit the log with the story.
3. **When a story finishes (or stops):** add an entry using the template in the log: story, branch, PR, commits (SHA), files changed, what was built, every acceptance criterion with its verdict (§ 2), commands + results, screenshots paths, Supabase migrations applied, device checks needed, known issues, follow-ups.
4. **Update the "Situation" section** at the top every time: what's merged, what's in review, what's in progress, what's next, blockers, questions for the founder, overall health (typecheck/tests/e2e status on `develop`).
5. **At the end of every working run, write a "Final report"** at the top of the log (newest first): **the complete list of everything implemented in that run**, with story IDs, PRs, verification summary, what needs a device check, what is known broken or incomplete, and the exact next story to pick up.

Write for an auditor: every claim should be checkable (a SHA, a test name, a file path, a screenshot path, a SQL query).

---

## 4. Supabase (cloud) — architecture and rules

**Architecture: local-first, cloud-additive.** SQLite on the phone stays the source of truth for the person's own data. Supabase adds: accounts, backup/restore, and the social features (witness, circles, presence, benchmarks). Everything social reads **aggregates** from Supabase, never another person's raw sessions.

- **Client:** `@supabase/supabase-js` in `intentional-expo/services/supabase.ts`, session persisted with AsyncStorage, created only when `EXPO_PUBLIC_SUPABASE_URL` is set (the app must run without it).
- **Migrations:** SQL files in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql` at the repo root, applied to the founder's project (Supabase CLI `supabase db push` or the Supabase MCP `apply_migration`). Never edit an applied migration; add a new one.
- **Types:** generate `intentional-expo/types/supabase.ts` from the schema after each migration and commit it.
- **RLS is on for every table, no exceptions.** Owner tables: `user_id = auth.uid()` for select/insert/update/delete. Cross-user reads only through `security definer` RPCs that check membership and return aggregates.
- **Session integrity (anything social uses this):** only sessions that really ran count: `duration_seconds` between 60 and 4 h per session, ≤ 16 h per user per day, no overlapping sessions double-counted, no manually entered time. Enforce in the RPCs (US-095).
- **Test users:** create throwaway users with the admin API in your environment for `test:rls`; delete them at the end of the test.

**Target schema** (create it across US-087 → US-094; adjust only with a log entry explaining why):

```sql
-- US-087/088
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_emoji text,
  flick_stage int not null default 0,
  created_at timestamptz not null default now()
);

-- US-089  (mirrors of local tables; ids are the local text ids)
create table public.pillars    (id text primary key, user_id uuid not null references auth.users on delete cascade,
  name text not null, color text not null, icon text not null, category text, sort_order int not null default 0,
  is_archived boolean not null default false, updated_at timestamptz not null default now());
create table public.objectives (id text primary key, user_id uuid not null references auth.users on delete cascade,
  pillar_id text not null references public.pillars on delete cascade, title text not null, done_when text not null default '',
  deadline date not null, status text not null check (status in ('planned','active','completed','dropped')),
  metric_current numeric, metric_target numeric, metric_unit text, created_at timestamptz not null,
  closed_at timestamptz, close_note text, updated_at timestamptz not null default now());
create table public.tasks      (id text primary key, user_id uuid not null references auth.users on delete cascade,
  objective_id text not null references public.objectives on delete cascade, title text not null,
  estimate_minutes int not null, planned_date date, is_done boolean not null default false, done_at timestamptz,
  sort_order int not null default 0, created_at timestamptz not null, updated_at timestamptz not null default now());
create table public.habits     (id text primary key, user_id uuid not null references auth.users on delete cascade,
  pillar_id text not null references public.pillars on delete cascade, objective_id text, name text not null,
  minutes int not null, start_time text, days_mask int not null default 127, strict boolean not null default true,
  is_active boolean not null default true, updated_at timestamptz not null default now());
create table public.sessions   (id text primary key, user_id uuid not null references auth.users on delete cascade,
  pillar_id text not null, objective_id text, task_id text, habit_id text,
  started_at timestamptz not null, duration_seconds int not null check (duration_seconds between 0 and 57600),
  was_completed boolean not null default false, updated_at timestamptz not null default now());
create index on public.sessions (user_id, started_at);

-- US-090
create table public.witnesses (id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade, witness_id uuid references auth.users on delete cascade,
  invite_code text not null unique, status text not null default 'pending' check (status in ('pending','active','ended')),
  created_at timestamptz not null default now());

-- US-091/092
create table public.circles (id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 40),
  pillar_label text not null, weekly_target_minutes int not null default 600, ranking_enabled boolean not null default false,
  invite_code text not null unique, created_by uuid not null references auth.users, created_at timestamptz not null default now());
create table public.circle_members (circle_id uuid references public.circles on delete cascade,
  user_id uuid references auth.users on delete cascade, pillar_id text not null, role text not null default 'member'
  check (role in ('owner','member')), joined_at timestamptz not null default now(), primary key (circle_id, user_id));
create table public.circle_events (id uuid primary key default gen_random_uuid(), circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null references auth.users on delete cascade, kind text not null check (kind in ('milestone','goal_achieved','streak')),
  payload jsonb not null default '{}', created_at timestamptz not null default now());
create table public.cheers (event_id uuid references public.circle_events on delete cascade,
  user_id uuid references auth.users on delete cascade, created_at timestamptz not null default now(), primary key (event_id, user_id));

-- RPCs (security definer, membership-checked, aggregates only):
--   join_circle(code text, my_pillar_id text) -> circle_id           (US-091; max 8 members)
--   circle_week(circle_id uuid, week_start date) -> table(user_id, display_name, minutes int)   (US-091)
--   accept_witness(code text) -> witness id                           (US-090)
--   witness_summary(owner uuid, week_start date) -> json (pledge, flick_stage, minutes per pillar; no task names) (US-090)
--   pillar_percentile(category text, week_start date) -> int | null  (US-094; null when sample < 50)
```

Presence for "Focus together" (US-093) uses **Supabase Realtime presence** on private channels `circle:<id>`, authorised for members only.

---

## 5. Build order

| Phase | Stories | Notes |
|---|---|---|
| **A — Local model** | US-054 → US-058 (foundations, sequential) → US-059 → US-078 | Full AC in `Intentional_user_stories.md` § 11. Order and dependencies in `Intentional_goals_model.md` § 6. US-077 (strict mode by default) is core: do it right after US-076. |
| **B — Retention** | US-079 → US-084 | § 6 below. Needs US-057/058 (hours rollups) and US-062 (goal completion). |
| **C1 — Share (no backend)** | US-085, US-086 | § 7. Can run **in parallel** with Phase A after US-058. |
| **C2 — Cloud foundation** | US-087 → US-089 | § 7. Needs Phase A's schema (US-055–057) merged. |
| **C3 — Social** | US-090 → US-095 | § 7. In order: witness → circles → events/cheers → focus together → benchmarks → integrity (US-095 must be merged before US-091's ranking or US-094 ship to users). |

At any time: if `develop` is red (typecheck, tests or e2e failing), **fixing it is the top priority** before any new story.

---

## 6. Phase B — Retention (US-079 → US-084)

> Principle: people come back for **proof of who they're becoming**, not points. Every mechanism must increase *hours given*, never time-in-app. No XP, coins, leagues, loot, or guilt.

### US-079 · Flick evolves with lifetime hours
As a user, I want Flick to grow with all the hours I've ever given, so that I can see who I'm becoming.
- Stages by lifetime focused hours: **Spark** 0 h · **Flame** 10 h · **Torch** 50 h · **Bonfire** 150 h · **Beacon** 500 h · **Sun** 1,000 h. Stage never goes down.
- Daily brightness (existing `intensity`) = this week's hours vs the person's 4-week average; the **stage** is lifetime. A bad week dims Flick but never demotes it.
- Visual per stage (new props on `Mascot`, e.g. `stage`): growing size/glow, small additions (ember ring → crown of sparks → sun rays). Keep the face, arms and legs.
- Stage shown on Today (next to the greeting) and in Insights, with "37 h to Torch".
- Reaching a stage: full-screen celebration (Confetti, heavy + success haptics, typed line "Flick is now a Torch. 50 hours given to the life you chose.").
- **Verify:** unit tests for `stageFor(hours)` and `hoursToNext(hours)` (boundaries 0, 9.99, 10, 1000+); e2e seeds sessions to cross a threshold and asserts the celebration and the label; screenshots of each stage.

### US-080 · Milestones on real things
As a user, I want real achievements marked, so that progress feels earned.
- Milestones: per pillar 10 / 50 / 100 / 250 / 500 / 1,000 h; goal achieved (US-062); first week with every scheduled habit kept; 4 weeks in a row with every pillar getting time.
- Local table `milestones (id, kind, ref_id, value, achieved_at)`; detected after each session / goal completion; each fires once.
- Celebration sheet (reuse Confetti) with a "Share" button (US-085). No badge shelf; milestones live in "Your Life in Hours" (US-083).
- **Verify:** unit tests for detection (exact thresholds, no double fire, retroactive detection after migration for existing hours); e2e for one pillar milestone.

### US-081 · Forgiving streaks
As a user, I want streaks that survive real life, so that one bad day doesn't make me quit.
- One rest day per habit per week keeps the streak (shown as a soft dot, "Rest day"); only scheduled days count (US-069); a habit's streak shows as "12 days" with the week's dots.
- Never red, never "you lost your streak". A broken streak shows the best streak instead ("Best: 21 days").
- **Verify:** unit tests in the streak logic (rest day used / second miss breaks / unscheduled days ignored / timezone day boundaries); e2e screenshot of a habit with a rest day.

### US-082 · The Sunday ritual
As a user, I want a weekly moment where Flick shows my week and I plan the next, so that coming back has meaning.
- Weekly review becomes a short story (3–4 screens, onboarding-style, typed text with sound): hours per pillar (vs last week), goals and pace, habits kept, best day, Flick's stage progress; then "Plan next week" (US-072: 1–3 tasks per goal, habit schedule check).
- Notification Sunday 18:00 (Settings: day/time, on by default) — the only non-habit recurring notification.
- **Verify:** unit tests for the weekly summary builder; e2e through the whole ritual with seeded data; 📱 notification steps.

### US-083 · Your Life in Hours
As a user, I want one screen that shows my life's ledger, so that my history feels valuable.
- Screen from Insights and Settings: lifetime hours (big), per pillar (bars), goals achieved (timeline with dates and hours), milestones, first session date, Flick's stage path.
- **Verify:** unit tests for the lifetime aggregates; e2e with seeded multi-month data; screenshots.

### US-084 · The end-of-session reward
As a user, I want finishing a session to feel good, so that I want the next one.
- Session end screen: Flick grows visibly (intensity animates up), "+30m to Body" counts up, goal progress bar moves (when linked), next-stage progress ("12 h to Torch"), milestone hand-off when one was reached.
- **Verify:** e2e completes a short seeded session (use a 1-minute session or expose a test-only fast-forward guarded by `__DEV__`) and asserts the reward elements; screenshots.

---

## 7. Phase C — Share & social (US-085 → US-095)

> Principle (Thiel + Girard): **positive mimesis in small circles.** Network effects are the strongest moat, but leaderboards of strangers replace the person's chosen goals with rivalry, invite cheating, and demotivate most people. We build: shareable proof, one witness, small circles with shared targets, focusing together. **No public stranger leaderboards.**

### US-085 · Shareable cards (no backend)
As a user, I want beautiful cards of my progress to share, so that I can show who I'm becoming (and others discover Intentional).
- Cards (1080×1920 story format and 1080×1080): **Pledge** (signed, from onboarding), **Goal achieved** (title, hours, days), **Weekly hours** (per pillar, Flick at current stage), **Milestone**. Spark style, Flick, small "Intentional" wordmark + link.
- Rendered with `react-native-view-shot`, shared with `expo-sharing` (install with `npx expo install`; both work in Expo Go). Share buttons on: congratulations screen (onboarding), goal completion, milestone sheet, weekly ritual, Insights.
- **Verify:** unit tests for card data builders; e2e renders each card component on web and screenshots it (the share sheet itself is 📱).

### US-086 · Year in Hours (Wrapped)
As a user, I want a year-end story of my hours, so that I can celebrate and share my year.
- Available Dec 1 → Jan 15 (plus "Your year so far" any time from Insights): 6–8 story slides (total hours, top pillar, goals achieved, longest streak, best month, Flick's stage path, a final shareable card).
- **Verify:** unit tests for the yearly aggregates (year boundaries, local timezone); e2e through all slides with seeded data; screenshots.

### US-087 · Supabase foundation
As the product, I want a cloud backend wired safely, so that accounts and social features can be built.
- `services/supabase.ts` (client, AsyncStorage auth persistence, no-op when env missing), `.env.example`, `supabase/migrations/` with the first migration (`profiles` + RLS), generated `types/supabase.ts`, and **`npm run test:rls`** (a Node/vitest script using two throwaway users that asserts RLS isolation; reads `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the agent environment; skips with a clear message when they're missing).
- **Verify:** L4 (migration applied; `test:rls` green; advisors clean); app still boots and passes all e2e without env vars.

### US-088 · Accounts (optional)
As a user, I want an optional account, so that my data is backed up and I can join others.
- Settings → "Account": **Sign in with Apple** (iOS, `expo-apple-authentication`) and **email one-time code** (all platforms). Creating an account creates `profiles` (display name from onboarding name). Sign out keeps local data. **Delete account** (App Store requirement) deletes the server data and the auth user (via an Edge Function using the service role) and leaves local data intact.
- **Verify:** e2e on web with email OTP against a test user (or a mocked auth layer if OTP can't be read — state which in the log); L4 for profiles; 📱 Sign in with Apple steps.

### US-089 · Backup & restore (sync)
As a signed-in user, I want my data backed up, so that a new phone doesn't erase my life's ledger.
- Mirror tables in Supabase (schema § 4). Local **outbox** (`sync_outbox(table, row_id, op, queued_at)`) filled on every local write; pushed with idempotent upserts when online; `updated_at` last-write-wins. "Restore from account" on a fresh install pulls everything into SQLite.
- **Verify:** unit tests for the outbox and the mapping local↔cloud; integration test: seed local → push → wipe local → restore → deep-equal; L4 RLS (user B can't read A's mirror rows).

### US-090 · A witness
As a user, I want one person to witness my commitment, so that I keep my word.
- Invite via link/code (share sheet); the witness (needs an account) accepts; they see, in a "Witnessing" screen: your pledge, Flick stage, hours per pillar this week, goals and pace — **never task names or notes**. Either side can end it.
- **Verify:** L4 (RLS + `witness_summary` refuses non-witnesses); e2e with two test accounts in two browser contexts; screenshots.

### US-091 · Circles
As a user, I want a small private group around a shared pillar, so that we build together.
- Create a circle (name, pillar label, weekly target hours), invite by link/code, join with `join_circle` mapping **one of your pillars**; max 8 members.
- Circle screen: collective progress ("42 h of 50 h to Craft this week"), each member's hours this week on their mapped pillar (from `circle_week`), Flick stages. **Ranking is off by default**; the owner can turn on a weekly ranking that resets every Monday. Leave / remove member / delete circle.
- **Verify:** L4 (non-member can't read; join limit; ranking flag respected); unit tests for week boundaries; e2e with 2–3 test accounts; screenshots.

### US-092 · Circle moments & cheers
As a circle member, I want to see and cheer my circle's real achievements, so that progress feels shared.
- Opt-in per kind (Settings): milestones, goals achieved, streaks become `circle_events`; members cheer with one tap (haptic, Flick spark animation); no comments (v1).
- **Verify:** L4; e2e cheer round-trip between two accounts.

### US-093 · Focus together
As a circle member, I want to see who's focusing now and join them, so that we hold each other to the hour.
- Realtime presence on `circle:<id>`: "Marc is focusing on Craft · 25 min left". **Join** starts your own session (your task/habit/pillar) ending at the same time; the focus room shows the others' avatars. Presence only while a session runs.
- **Verify:** e2e with two browser contexts (presence appears/disappears within 5 s); unit tests for the presence payload; 📱 for blocking during joint sessions.

### US-094 · Anonymous benchmarks (opt-in)
As a user, I want to know how my hours compare without being ranked, so that I get perspective, not pressure.
- Pillars get an optional `category` (body · mind · money · craft · family · faith · other), set in the pillar form (preset pillars pre-filled). Opt-in in Settings. Insights shows "More hours to Body than 72% of people with a Body pillar this week". Hidden when the sample < 50.
- **Verify:** L4 (`pillar_percentile` returns null under 50; no per-user data exposed); unit tests for category mapping.

### US-095 · Session integrity for social
As the product, I want shared numbers to be true, so that trust in hours given is never broken.
- Server rules in every aggregate RPC: per-session 60 s–4 h, ≤ 16 h per user per day, overlapping sessions merged, sessions in the future ignored. Client: no manual time entry anywhere; edits to past sessions excluded from social aggregates.
- **Verify:** L4 tests that feed crafted sessions (overlaps, 20 h days, future) and assert the aggregates.

---

## 8. Definition of done (checklist to paste in every PR)

```
- [ ] Story US-0XX acceptance criteria: each one has a verdict in the build log
- [ ] npm run typecheck → 0 errors
- [ ] npm test → all green (new tests: …)
- [ ] npm run e2e → all suites pass (new/extended suite: …)
- [ ] Screenshots reviewed: e2e/artifacts/<suite>/…
- [ ] Local migration tested (fresh + upgrade) / web shim updated   (if schema)
- [ ] Supabase migration applied + npm run test:rls green + advisors clean   (if cloud)
- [ ] Needs device check: listed with steps in the log   (if native)
- [ ] Intentional_build_log.md entry + Situation updated
- [ ] Intentional_current_state.md updated (plain language, what a user can now do)
```
