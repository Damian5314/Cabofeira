-- NOT APPLIED. Review on staging after admin_audit_log.sql.
-- Automatic, transactional recording avoids a client bypassing audit RPCs.
-- No business records are deleted. Existing log rows are unchanged.
begin;
create or replace function public.capture_admin_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare before_row jsonb; after_row jsonb; target uuid;
begin
  if not public.is_admin() then return null; end if;
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and before_row = after_row then return null; end if;
  target := coalesce(after_row->>'id', before_row->>'id')::uuid;
  insert into public.admin_audit_log(actor_id,action,target_table,target_id,details)
  values(auth.uid(),lower(tg_op),tg_table_name,target,
    jsonb_build_object('source','database_trigger','key',coalesce(after_row->>'key',before_row->>'key')));
  return null;
end;
$$;
revoke execute on function public.capture_admin_change() from public, anon, authenticated;
drop trigger if exists audit_products_change on public.products;
create trigger audit_products_change after insert or update or delete on public.products for each row execute function public.capture_admin_change();
drop trigger if exists audit_profiles_change on public.profiles;
create trigger audit_profiles_change after update on public.profiles for each row execute function public.capture_admin_change();
drop trigger if exists audit_settings_change on public.app_settings;
create trigger audit_settings_change after insert or update or delete on public.app_settings for each row execute function public.capture_admin_change();
drop trigger if exists audit_reports_change on public.reports;
create trigger audit_reports_change after update on public.reports for each row execute function public.capture_admin_change();
commit;
