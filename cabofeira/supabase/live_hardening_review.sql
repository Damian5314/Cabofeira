-- REVIEW AND TEST ON STAGING FIRST. Not applied by Codex.
-- Requires existing schema, messaging, blocking, notifications, security guards.
-- No rows/tables are deleted. Save current function/policy/bucket definitions
-- before applying; transaction rollback is available until COMMIT.
begin;

-- Keep guards compatible both before and after drop_seller_denorm.sql.
create or replace function public.guard_products_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.featured := false;
  new.views := 0;
  new.status := 'active';
  if to_jsonb(new) ? 'seller_verified' then
    new := jsonb_populate_record(new, '{"seller_verified":false}'::jsonb);
  end if;
  return new;
end;
$$;

create or replace function public.guard_products_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  new.seller_id := old.seller_id;
  new.featured := old.featured;
  if to_jsonb(old) ? 'seller_verified' then
    new := jsonb_populate_record(new, jsonb_build_object('seller_verified', to_jsonb(old)->'seller_verified'));
  end if;
  if old.status = 'hidden' then new.status := old.status; end if;
  if new.views is distinct from old.views + 1 then new.views := old.views; end if;
  return new;
end;
$$;

-- The seller must really own this active listing. A restrictive policy also
-- constrains any existing permissive INSERT policy.
drop policy if exists conversations_insert_valid_listing on public.conversations;
create policy conversations_insert_valid_listing on public.conversations
as restrictive for insert to authenticated with check (
  buyer_id = auth.uid() and buyer_id <> seller_id
  and not public.is_blocked_pair(buyer_id, seller_id)
  and exists (select 1 from public.products p where p.id = product_id
    and p.seller_id = conversations.seller_id and p.status = 'active')
);

-- SECURITY DEFINER changes the executing DB role, NOT auth.uid(). Calling
-- create_notification(recipient) from a normal sender therefore failed its
-- self-or-admin check and rolled back the message. Insert inside this trusted
-- trigger instead; do not weaken the public RPC authorization boundary.
create or replace function public.notify_new_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient uuid; sender_name text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
  into recipient from public.conversations c where c.id = new.conversation_id
    and new.sender_id in (c.buyer_id, c.seller_id);
  if recipient is null or public.is_blocked_pair(new.sender_id, recipient) then return new; end if;
  select name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications(user_id, type, title, body, data, link)
  values(recipient, 'new_message', coalesce(sender_name, 'CaboFeira'), left(new.body,140),
    jsonb_build_object('conversation_id',new.conversation_id,'sender_id',new.sender_id), '/messages');
  return new;
end;
$$;
revoke execute on function public.notify_new_message() from public, anon, authenticated;
revoke execute on function public.guard_products_insert() from public, anon, authenticated;
revoke execute on function public.guard_products_update() from public, anon, authenticated;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- Restricts future uploads, does not remove existing files.
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id = 'product-images';

commit;
