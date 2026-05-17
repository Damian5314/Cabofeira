-- =====================================================================
-- CaboFeira – Messaging (run this in the Supabase SQL editor).
-- Adds private conversations + messages, with RLS so only the two
-- participants (buyer + seller) can ever see them.
-- =====================================================================

create table if not exists public.conversations (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid references public.products(id) on delete cascade,
  buyer_id          uuid not null references public.profiles(id) on delete cascade,
  seller_id         uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  last_message_at   timestamptz not null default now(),
  unique (product_id, buyer_id, seller_id),
  check (buyer_id <> seller_id)
);

create index if not exists conversations_buyer_idx  on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id) on delete cascade,
  body             text not null check (length(body) > 0),
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);

-- Keep conversations.last_message_at fresh so the list can be sorted by recency.
create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_conversation on public.messages;
create trigger trg_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- -----------------------------
-- Row level security
-- -----------------------------

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_buyer"       on public.conversations;
create policy "conversations_select_participant"
  on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "conversations_insert_buyer"
  on public.conversations for insert
  with check (auth.uid() = buyer_id);

drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_select_participant"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );
create policy "messages_insert_participant"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

-- -----------------------------
-- Enable realtime (so the Messages page updates live)
-- -----------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
