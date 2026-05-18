-- =====================================================================
-- CaboFeira – Self-service account deletion.
-- The RPC runs as the function owner (postgres), which can delete from
-- auth.users. It checks auth.uid() so a user can only delete THEMSELVES.
-- FK cascades remove the matching profile, products, favorites,
-- conversations, messages, reports automatically.
-- =====================================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
