-- =====================================================================
-- CaboFeira – Unread message tracking.
-- Adds per-participant "last_read_at" timestamps to conversations and
-- a secure RPC the frontend calls when a user opens a thread.
-- =====================================================================

alter table public.conversations
  add column if not exists buyer_last_read_at  timestamptz,
  add column if not exists seller_last_read_at timestamptz;

-- Secure RPC: marks the right column based on whether the caller is the
-- buyer or seller in the conversation. Security definer so we can bypass
-- RLS for the update; the function itself enforces participation.
create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer  uuid;
  v_seller uuid;
begin
  select buyer_id, seller_id
    into v_buyer, v_seller
    from public.conversations
   where id = p_conversation_id;

  if v_buyer is null then
    raise exception 'Conversation not found';
  end if;

  if v_buyer = auth.uid() then
    update public.conversations
       set buyer_last_read_at = now()
     where id = p_conversation_id;
  elsif v_seller = auth.uid() then
    update public.conversations
       set seller_last_read_at = now()
     where id = p_conversation_id;
  else
    raise exception 'Not a participant of this conversation';
  end if;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
