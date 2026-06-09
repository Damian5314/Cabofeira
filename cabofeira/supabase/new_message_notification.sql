-- =====================================================================
-- CaboFeira – New-message notification fan-out (run this in the Supabase
-- SQL editor). An AFTER-INSERT trigger on public.messages that creates a
-- 'new_message' notification for the recipient via the Phase-1
-- create_notification() RPC, feeding the navbar bell (FEAT-08 / D-16).
--
-- APPLY ORDER: AFTER blocked_users.sql (calls public.is_blocked_pair) and
-- alongside the rest of the Phase-2 SQL. Requires notifications.sql
-- (create_notification) from Phase 1 to already be applied.
--
-- SECURITY DEFINER (Pitfall 3 / A2): create_notification() has a cross-user
-- gate (notifications.sql L76) that raises unless the caller is the target
-- or an admin. Running this trigger fn as definer satisfies that gate so the
-- sender can create a notification FOR the recipient. MUST be verified with
-- a real two-account message during the apply gate (Plan 02-02).
-- =====================================================================

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient   uuid;
  v_sender_name text;
begin
  -- Recipient = the non-sender participant of this conversation.
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
    into v_recipient
    from public.conversations c
   where c.id = new.conversation_id;

  -- Mutual silent block (D-08/D-10): no bell for blocked pairs.
  if public.is_blocked_pair(new.sender_id, v_recipient) then
    return new;
  end if;

  select name into v_sender_name from public.profiles where id = new.sender_id;

  perform public.create_notification(
    v_recipient,
    'new_message',
    v_sender_name,
    left(new.body, 140),
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id),
    '/messages'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();
