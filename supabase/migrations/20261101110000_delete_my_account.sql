-- US-088 · Delete account (App Store requirement): the signed-in person deletes their own auth user.
-- Every owner table references auth.users with `on delete cascade`, so their server data goes with it.
-- Security definer (runs as the function owner, who may delete from auth.users) but only ever acts on auth.uid():
-- no argument, so nobody can delete someone else. Replaces the plan's Edge Function: same effect, no service-role key
-- in a deployed function.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
