-- =====================================================================
-- CaboFeira – Notifications (run this in the Supabase SQL editor).
-- Owner-only in-app notifications. Rows enter ONLY via
-- create_notification(); the table is owner-read/mark-read and is
-- published to realtime so the navbar bell receives live INSERTs.
-- =====================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('new_message','saved_search','price_drop','system')),
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

-- -----------------------------
-- Row level security — owner-only read + mark-read.
-- -----------------------------

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_select_own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- NO insert policy: rows enter only via create_notification() (SECURITY
-- DEFINER). The function's in-body authorization gate (below) is what
-- prevents a user from forging a notification for another user.

-- -----------------------------
-- create_notification() — the sole insert path (fan-out function).
-- Security definer so it bypasses the missing INSERT policy; callable by
-- authenticated only. An in-function gate restricts a plain client to
-- targeting ITSELF (p_user_id = auth.uid()); only admins may target an
-- arbitrary user. Phase 2's new_message trigger (admin/SECURITY DEFINER
-- context) handles cross-user fan-out.
-- -----------------------------

create or replace function public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text  default null,
  p_data    jsonb default '{}',
  p_link    text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Authorization gate: a plain authenticated client may only create a
  -- notification for itself. Only admins (or internal SECURITY DEFINER
  -- callers running with an admin identity) may target an arbitrary user.
  -- Without this, any authenticated user could forge notifications to any
  -- victim's realtime bell — the RPC is the trust boundary in this
  -- no-server-API architecture.
  if p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.notifications (user_id, type, title, body, data, link)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link)
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.create_notification(uuid,text,text,text,jsonb,text) from public, anon;
grant  execute on function public.create_notification(uuid,text,text,text,jsonb,text) to authenticated;

-- -----------------------------
-- Realtime so the navbar bell receives owner-filtered live INSERTs.
-- RLS-filtered postgres_changes delivers only the owner's rows; the bell
-- only needs INSERT events, so full-row replica identity is unnecessary.
-- -----------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
