-- US-087 · profiles (one per account) + RLS. Append-only: never edit once applied; add a new migration.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar_emoji text,
  flick_stage int not null default 0 check (flick_stage between 0 and 5),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Owner-only: a person reads and writes only their own profile. Cross-user reads go through
-- security-definer RPCs that return aggregates (US-090+), never through these policies.
create policy "profiles: owner reads" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: owner inserts" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: owner updates" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "profiles: owner deletes" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

-- Nothing for the anon role.
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
