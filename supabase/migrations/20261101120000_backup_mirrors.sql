-- US-089 · Backup & restore. Mirrors of the phone's tables, owner-only (RLS).
-- Changes from build plan § 4 (see the build log):
--   * primary key (user_id, id), not id: local ids are only unique on one phone (seeded/legacy ids like 'g0').
--   * no foreign keys between mirrors: rows arrive in any order, and local history can point at deleted rows.
--   * `local jsonb` keeps the phone's whole row, so a restore is lossless; the typed columns are for aggregates
--     (witness_summary, circles, integrity) and are filled from it.
--   * `backup_rows` holds the other tables (habit check-offs, skips, weekly reviews, milestones, settings).

create table if not exists public.pillars (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  name text not null, color text not null, icon text not null, category text,
  sort_order int not null default 0, is_archived boolean not null default false,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.objectives (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  pillar_id text not null, title text not null, done_when text not null default '',
  deadline date, status text not null check (status in ('planned','active','completed','dropped')),
  metric_current numeric, metric_target numeric, metric_unit text,
  created_at timestamptz, closed_at timestamptz, close_note text,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.tasks (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  objective_id text not null, title text not null, estimate_minutes int not null default 0,
  planned_date date, is_done boolean not null default false, done_at timestamptz,
  sort_order int not null default 0, created_at timestamptz,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.habits (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  pillar_id text not null, objective_id text, name text not null,
  minutes int not null default 0, start_time text, days_mask int not null default 127,
  strict boolean not null default true, is_active boolean not null default true,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.sessions (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  pillar_id text not null, objective_id text, task_id text, habit_id text,
  started_at timestamptz not null,
  duration_seconds int not null check (duration_seconds between 0 and 57600),
  was_completed boolean not null default false,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists sessions_user_started on public.sessions (user_id, started_at);

create table if not exists public.backup_rows (
  user_id uuid not null references auth.users on delete cascade,
  tbl text not null check (tbl in ('habit_completions','habit_skips','weekly_reviews','milestones','settings')),
  id text not null,
  local jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, tbl, id)
);

-- RLS: owner-only, every table, every command. Nothing for anon.
do $$
declare t text;
begin
  foreach t in array array['pillars','objectives','tasks','habits','sessions','backup_rows'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%1$s: owner reads" on public.%1$I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner inserts" on public.%1$I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner updates" on public.%1$I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s: owner deletes" on public.%1$I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
