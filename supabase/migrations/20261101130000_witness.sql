-- US-090 · A witness: one person who sees your commitment (pledge, Flick's stage, hours per pillar this week,
-- goals and pace) — never task names or notes. Cross-user reads only through these security-definer RPCs.

alter table public.profiles add column if not exists timezone text;

create table if not exists public.witnesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  witness_id uuid references auth.users on delete cascade,
  invite_code text not null unique,
  status text not null default 'pending' check (status in ('pending','active','ended')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ended_at timestamptz,
  check (witness_id is null or witness_id <> owner_id)
);
-- One witness at a time: at most one pending or active link per person.
create unique index if not exists witnesses_one_open on public.witnesses (owner_id) where status in ('pending','active');
create index if not exists witnesses_witness on public.witnesses (witness_id) where status = 'active';

alter table public.witnesses enable row level security;
-- Read-only through RLS for the two people involved; every change goes through the RPCs below.
create policy "witnesses: the two sides read" on public.witnesses
  for select to authenticated using (owner_id = (select auth.uid()) or witness_id = (select auth.uid()));
revoke all on public.witnesses from anon;
revoke insert, update, delete on public.witnesses from authenticated;
grant select on public.witnesses to authenticated;

-- A fresh invite (replaces a pending one). Refused while a witness is active.
create or replace function public.create_witness_invite()
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if exists (select 1 from public.witnesses where owner_id = me and status = 'active') then
    raise exception 'you already have a witness' using errcode = 'P0001';
  end if;
  update public.witnesses set status = 'ended', ended_at = now() where owner_id = me and status = 'pending';
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.witnesses (owner_id, invite_code) values (me, code);
      return code;
    exception when unique_violation then
      -- code collision: try another
    end;
  end loop;
end $$;

-- Accept an invite: you become their witness. Not your own; not someone else's already accepted one.
create or replace function public.accept_witness(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  row public.witnesses;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into row from public.witnesses
   where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g')) and status = 'pending'
   for update;
  if not found then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if row.owner_id = me then raise exception 'that is your own invite' using errcode = 'P0001'; end if;
  update public.witnesses set witness_id = me, status = 'active', accepted_at = now() where id = row.id;
  return row.id;
end $$;

-- Either side ends it (a pending invite too, by its owner).
create or replace function public.end_witness(link_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.witnesses set status = 'ended', ended_at = now()
   where id = link_id and status in ('pending','active') and (owner_id = me or witness_id = me);
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
end $$;

-- Both directions, with the other person's display name (profiles are owner-only otherwise).
create or replace function public.witness_links()
returns table (id uuid, role text, status text, invite_code text, other_id uuid, other_name text, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select w.id, 'owner', w.status, case when w.status = 'pending' then w.invite_code end, w.witness_id, p.display_name, w.created_at
    from public.witnesses w left join public.profiles p on p.id = w.witness_id
   where w.owner_id = auth.uid() and w.status in ('pending','active')
  union all
  select w.id, 'witness', w.status, null, w.owner_id, p.display_name, w.created_at
    from public.witnesses w left join public.profiles p on p.id = w.owner_id
   where w.witness_id = auth.uid() and w.status = 'active'
$$;

-- What a witness sees, for the week starting `week_start` (a Monday, in the owner's time zone).
-- Refused unless the caller is the owner's active witness. Aggregates only: no task names, no notes.
create or replace function public.witness_summary(owner uuid, week_start date)
returns json language plpgsql security definer set search_path = '' stable as $$
declare
  tz text;
  from_ts timestamptz;
  to_ts timestamptz;
  result json;
begin
  if auth.uid() is null or not exists (
    select 1 from public.witnesses w where w.owner_id = owner and w.witness_id = auth.uid() and w.status = 'active'
  ) then
    raise exception 'not their witness' using errcode = '42501';
  end if;
  select coalesce(p.timezone, 'UTC') into tz from public.profiles p where p.id = owner;
  tz := coalesce(tz, 'UTC');
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then tz := 'UTC'; end if;
  from_ts := (week_start::timestamp) at time zone tz;
  to_ts := ((week_start + 7)::timestamp) at time zone tz;

  select json_build_object(
    'display_name', (select display_name from public.profiles where id = owner),
    'flick_stage', (select flick_stage from public.profiles where id = owner),
    'week_start', week_start,
    'timezone', tz,
    'last_backup', (select max(updated_at) from public.sessions where user_id = owner),
    'pillars', coalesce((
      select json_agg(json_build_object('id', pl.id, 'name', pl.name, 'color', pl.color, 'icon', pl.icon,
               'minutes', coalesce((select floor(sum(s.duration_seconds) / 60) from public.sessions s
                                     where s.user_id = owner and s.pillar_id = pl.id
                                       and s.started_at >= from_ts and s.started_at < to_ts), 0))
             order by pl.sort_order)
        from public.pillars pl where pl.user_id = owner and not pl.is_archived), '[]'::json),
    'goals', coalesce((
      select json_agg(json_build_object('title', g.title, 'pillar_id', g.pillar_id, 'deadline', g.deadline,
               'progress', g.progress, 'pace', g.pace) order by g.deadline nulls last)
        from (
          select o.title, o.pillar_id, o.deadline, pr.progress,
                 case
                   when pr.progress is null then 'unknown'
                   when pr.progress < 1 and o.deadline is not null and o.deadline < (now() at time zone tz)::date then 'behind'
                   when o.deadline is null or o.created_at is null then 'unknown'
                   else (
                     select case when pr.progress > e.elapsed + 0.1 then 'ahead'
                                 when pr.progress < e.elapsed - 0.1 then 'behind'
                                 else 'on_track' end
                       from (select greatest(0, least(1,
                               extract(epoch from (now() - o.created_at)) /
                               nullif(extract(epoch from (((o.deadline + 1)::timestamp at time zone tz) - o.created_at)), 0))) as elapsed) e)
                 end as pace
            from public.objectives o
            cross join lateral (
              select case
                when o.metric_target is not null and o.metric_current is not null
                     and coalesce((o.local->>'metric_start')::numeric, case when o.metric_current > o.metric_target then null else 0 end) is not null then
                  (select case when st = o.metric_target then (case when o.metric_current = o.metric_target then 1 else 0 end)
                               else greatest(0, least(1, (o.metric_current - st) / (o.metric_target - st))) end
                     from (select coalesce((o.local->>'metric_start')::numeric, 0) as st) x)
                when (select count(*) from public.tasks t where t.user_id = owner and t.objective_id = o.id) > 0 then
                  (select count(*) filter (where t.is_done)::numeric / count(*) from public.tasks t where t.user_id = owner and t.objective_id = o.id)
                else null
              end as progress
            ) pr
           where o.user_id = owner and o.status = 'active'
        ) g), '[]'::json)
  ) into result;
  return result;
end $$;

revoke all on function public.create_witness_invite() from public, anon;
revoke all on function public.accept_witness(text) from public, anon;
revoke all on function public.end_witness(uuid) from public, anon;
revoke all on function public.witness_links() from public, anon;
revoke all on function public.witness_summary(uuid, date) from public, anon;
grant execute on function public.create_witness_invite() to authenticated;
grant execute on function public.accept_witness(text) to authenticated;
grant execute on function public.end_witness(uuid) to authenticated;
grant execute on function public.witness_links() to authenticated;
grant execute on function public.witness_summary(uuid, date) to authenticated;
