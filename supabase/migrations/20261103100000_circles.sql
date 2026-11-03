-- US-091 · Circles: a small private group (max 8) around a shared pillar label ("Craft"). Each member maps one of
-- their own pillars; the circle sees each member's hours this week on that pillar, the collective total against the
-- weekly target, and Flick stages. Ranking is off by default; the owner can turn on a weekly ranking (resets Monday).
--
-- Tables are closed (RLS on, no policies, no grants): every read and write goes through the membership-checked
-- security-definer RPCs below. Aggregates only: never task names, notes or session rows.
-- Hours follow the honest-numbers rules (US-095 core): a session counts only if 60 s–4 h long and already over;
-- overlapping sessions on the same pillar count once; at most 16 h per member per day.
-- (circle_events and cheers come with US-092.)

create table if not exists public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  pillar_label text not null check (char_length(pillar_label) between 1 and 30),
  weekly_target_minutes int not null default 600 check (weekly_target_minutes between 60 and 60000),
  ranking_enabled boolean not null default false,
  invite_code text not null unique,
  created_by uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  pillar_id text not null,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index if not exists circle_members_user on public.circle_members (user_id);
create unique index if not exists circle_members_one_owner on public.circle_members (circle_id) where role = 'owner';

alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
revoke all on public.circles from anon, authenticated;
revoke all on public.circle_members from anon, authenticated;

-- ─── internal helpers (not callable by clients) ───

create or replace function public._new_invite_code()
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    from generate_series(1, 8)
$$;

create or replace function public._safe_tz(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select p.timezone from public.profiles p
                    where p.id = uid and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p.timezone)), 'UTC')
$$;

-- Honest minutes for one person on one pillar between two instants (see the header).
create or replace function public._social_minutes(uid uuid, pillar text, from_ts timestamptz, to_ts timestamptz, tz text)
returns int language sql stable security definer set search_path = '' as $$
  with s as (
    select tstzrange(started_at, started_at + make_interval(secs => duration_seconds)) as r
      from public.sessions
     where user_id = uid and pillar_id = pillar
       and started_at >= from_ts and started_at < to_ts
       and duration_seconds between 60 and 14400
       and started_at + make_interval(secs => duration_seconds) <= now() + interval '2 minutes'
  ), merged as (
    select unnest(range_agg(r)) as m from s
  ), per_day as (
    select (lower(m) at time zone tz)::date as d, sum(extract(epoch from upper(m) - lower(m))) as secs
      from merged group by 1
  )
  select coalesce(floor(sum(least(secs, 57600)) / 60), 0)::int from per_day
$$;

create or replace function public._check_my_pillar(me uuid, pillar text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pillars where user_id = me and id = pillar and not is_archived) then
    raise exception 'pillar not found' using errcode = 'P0002';
  end if;
end $$;

-- ─── RPCs ───

-- Create a circle; you're its owner, with one of your pillars. → { id, invite_code }
create or replace function public.create_circle(name text, pillar_label text, weekly_target_minutes int, my_pillar_id text)
returns json language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  cid uuid;
  code text;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform public._check_my_pillar(me, my_pillar_id);
  if (select count(*) from public.circle_members where user_id = me) >= 10 then
    raise exception 'too many circles' using errcode = 'P0001';
  end if;
  loop
    code := public._new_invite_code();
    begin
      insert into public.circles (name, pillar_label, weekly_target_minutes, invite_code, created_by)
      values (btrim(create_circle.name), btrim(create_circle.pillar_label), create_circle.weekly_target_minutes, code, me)
      returning id into cid;
      exit;
    exception when unique_violation then
      -- code collision: try another
    end;
  end loop;
  insert into public.circle_members (circle_id, user_id, pillar_id, role) values (cid, me, my_pillar_id, 'owner');
  return json_build_object('id', cid, 'invite_code', code);
end $$;

-- Join with a code and one of your pillars. Max 8 members. Joining again just changes your pillar.
create or replace function public.join_circle(code text, my_pillar_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.circles;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into c from public.circles
   where invite_code = upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'))
   for update;
  if not found then raise exception 'circle not found' using errcode = 'P0002'; end if;
  perform public._check_my_pillar(me, my_pillar_id);
  if exists (select 1 from public.circle_members where circle_id = c.id and user_id = me) then
    update public.circle_members set pillar_id = my_pillar_id where circle_id = c.id and user_id = me;
    return c.id;
  end if;
  if (select count(*) from public.circle_members where circle_id = c.id) >= 8 then
    raise exception 'circle is full' using errcode = 'P0001';
  end if;
  if (select count(*) from public.circle_members where user_id = me) >= 10 then
    raise exception 'too many circles' using errcode = 'P0001';
  end if;
  insert into public.circle_members (circle_id, user_id, pillar_id) values (c.id, me, my_pillar_id);
  return c.id;
end $$;

-- Your circles, with this week's collective total (week_start = your Monday).
create or replace function public.my_circles(week_start date)
returns json language plpgsql security definer set search_path = '' stable as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  return coalesce((
    select json_agg(json_build_object(
             'id', c.id, 'name', c.name, 'pillar_label', c.pillar_label,
             'weekly_target_minutes', c.weekly_target_minutes, 'ranking_enabled', c.ranking_enabled,
             'my_role', mine.role, 'member_count', (select count(*) from public.circle_members x where x.circle_id = c.id),
             'total_minutes', (select coalesce(sum(public._social_minutes(m.user_id, m.pillar_id,
                                  (week_start::timestamp) at time zone public._safe_tz(m.user_id),
                                  ((week_start + 7)::timestamp) at time zone public._safe_tz(m.user_id),
                                  public._safe_tz(m.user_id))), 0)
                                 from public.circle_members m where m.circle_id = c.id))
           order by mine.joined_at)
      from public.circle_members mine join public.circles c on c.id = mine.circle_id
     where mine.user_id = me), '[]'::json);
end $$;

-- One circle's week: members, each one's minutes on their mapped pillar, Flick stage. Members only.
-- `rank` is filled only when the owner turned ranking on; otherwise members come in the order they joined.
create or replace function public.circle_week(circle_id uuid, week_start date)
returns json language plpgsql security definer set search_path = '' stable as $$
declare
  me uuid := auth.uid();
  c public.circles;
  my_role text;
  result json;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select role into my_role from public.circle_members m where m.circle_id = circle_week.circle_id and m.user_id = me;
  if my_role is null then raise exception 'not a member' using errcode = '42501'; end if;
  select * into c from public.circles where id = circle_week.circle_id;

  with mem as (
    select m.user_id, m.role, m.joined_at, p.display_name, p.flick_stage,
           public._social_minutes(m.user_id, m.pillar_id,
             (week_start::timestamp) at time zone public._safe_tz(m.user_id),
             ((week_start + 7)::timestamp) at time zone public._safe_tz(m.user_id),
             public._safe_tz(m.user_id)) as minutes,
           case when m.user_id = me then m.pillar_id end as my_pillar_id
      from public.circle_members m left join public.profiles p on p.id = m.user_id
     where m.circle_id = c.id
  ), ranked as (
    select mem.*, case when c.ranking_enabled then rank() over (order by minutes desc) end as rnk from mem
  )
  select json_build_object(
    'id', c.id, 'name', c.name, 'pillar_label', c.pillar_label,
    'weekly_target_minutes', c.weekly_target_minutes, 'ranking_enabled', c.ranking_enabled,
    'invite_code', c.invite_code, 'my_role', my_role, 'week_start', week_start,
    'total_minutes', (select coalesce(sum(minutes), 0) from mem),
    'members', coalesce((select json_agg(json_build_object(
                  'user_id', r.user_id, 'display_name', r.display_name, 'flick_stage', r.flick_stage,
                  'role', r.role, 'minutes', r.minutes, 'rank', r.rnk, 'is_me', r.user_id = me,
                  'pillar_id', r.my_pillar_id)
                order by case when c.ranking_enabled then r.minutes end desc nulls last, r.joined_at) from ranked r), '[]'::json)
  ) into result;
  return result;
end $$;

-- Owner: turn the weekly ranking on or off.
create or replace function public.set_circle_ranking(circle_id uuid, enabled boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circle_members m where m.circle_id = set_circle_ranking.circle_id and m.user_id = auth.uid() and m.role = 'owner') then
    raise exception 'only the owner' using errcode = '42501';
  end if;
  update public.circles set ranking_enabled = coalesce(enabled, false) where id = set_circle_ranking.circle_id;
end $$;

-- Owner: remove a member. The invite code changes, so they can't walk straight back in.
create or replace function public.remove_circle_member(circle_id uuid, member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  if not exists (select 1 from public.circle_members m where m.circle_id = remove_circle_member.circle_id and m.user_id = auth.uid() and m.role = 'owner') then
    raise exception 'only the owner' using errcode = '42501';
  end if;
  if member_id = auth.uid() then raise exception 'use leave' using errcode = 'P0001'; end if;
  delete from public.circle_members m where m.circle_id = remove_circle_member.circle_id and m.user_id = member_id;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  loop
    code := public._new_invite_code();
    begin
      update public.circles set invite_code = code where id = remove_circle_member.circle_id;
      exit;
    exception when unique_violation then
    end;
  end loop;
end $$;

-- Leave. An owner hands the circle to the longest-standing member; alone, the circle is deleted.
create or replace function public.leave_circle(circle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  my_role text;
  heir uuid;
begin
  select role into my_role from public.circle_members m where m.circle_id = leave_circle.circle_id and m.user_id = me;
  if my_role is null then raise exception 'not a member' using errcode = '42501'; end if;
  delete from public.circle_members m where m.circle_id = leave_circle.circle_id and m.user_id = me;
  if my_role = 'owner' then
    select user_id into heir from public.circle_members m where m.circle_id = leave_circle.circle_id order by joined_at, user_id limit 1;
    if heir is null then
      delete from public.circles where id = leave_circle.circle_id;
    else
      update public.circle_members m set role = 'owner' where m.circle_id = leave_circle.circle_id and m.user_id = heir;
    end if;
  end if;
end $$;

-- Owner: delete the circle for everyone.
create or replace function public.delete_circle(circle_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circle_members m where m.circle_id = delete_circle.circle_id and m.user_id = auth.uid() and m.role = 'owner') then
    raise exception 'only the owner' using errcode = '42501';
  end if;
  delete from public.circles where id = delete_circle.circle_id;
end $$;

revoke all on function public._new_invite_code() from public, anon, authenticated;
revoke all on function public._safe_tz(uuid) from public, anon, authenticated;
revoke all on function public._social_minutes(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
revoke all on function public._check_my_pillar(uuid, text) from public, anon, authenticated;

revoke all on function public.create_circle(text, text, int, text) from public, anon;
revoke all on function public.join_circle(text, text) from public, anon;
revoke all on function public.my_circles(date) from public, anon;
revoke all on function public.circle_week(uuid, date) from public, anon;
revoke all on function public.set_circle_ranking(uuid, boolean) from public, anon;
revoke all on function public.remove_circle_member(uuid, uuid) from public, anon;
revoke all on function public.leave_circle(uuid) from public, anon;
revoke all on function public.delete_circle(uuid) from public, anon;
grant execute on function public.create_circle(text, text, int, text) to authenticated;
grant execute on function public.join_circle(text, text) to authenticated;
grant execute on function public.my_circles(date) to authenticated;
grant execute on function public.circle_week(uuid, date) to authenticated;
grant execute on function public.set_circle_ranking(uuid, boolean) to authenticated;
grant execute on function public.remove_circle_member(uuid, uuid) to authenticated;
grant execute on function public.leave_circle(uuid) to authenticated;
grant execute on function public.delete_circle(uuid) to authenticated;
