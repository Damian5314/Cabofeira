-- =====================================================================
-- CaboFeira – Block-aware messaging RLS (run this in the Supabase SQL editor).
-- Rewrites the three Phase-1 messaging policies (messages.sql L58-87) to
-- exclude blocked pairs in BOTH directions. This is the HIGH-severity,
-- SERVER-SIDE block-enforcement boundary (D-09 #2) — a client-only block
-- is a blocking finding. Re-runnable (idempotent: drop-then-create).
--
-- APPLY ORDER: AFTER blocked_users.sql (these policies call
-- public.is_blocked_pair, defined there).
--
-- Effects (D-08/D-09):
--   #1 hide existing convos/messages both sides  -> the two SELECT policies
--   #2 block new messages both directions        -> the INSERT with-check
-- The INSERT with-check failing is what makes a blocked send "silently not
-- deliver": supabase-js returns an RLS error; the client swallows it and
-- shows the normal optimistic UI WITHOUT any "you are blocked" copy (silent).
-- =====================================================================

-- Conversations SELECT: participant AND not blocked in either direction.
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  using (
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    and not public.is_blocked_pair(buyer_id, seller_id)
  );

-- Messages SELECT: participant via the conversation AND that pair not blocked.
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
         and not public.is_blocked_pair(c.buyer_id, c.seller_id)
    )
  );

-- Messages INSERT: existing participant with-check AND not blocked -> blocks
-- new messages in BOTH directions (D-09 #2). This failing is the silent
-- non-delivery of a blocked send.
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
         and not public.is_blocked_pair(c.buyer_id, c.seller_id)
    )
  );
