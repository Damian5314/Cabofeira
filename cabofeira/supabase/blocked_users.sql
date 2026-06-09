-- =====================================================================
-- CaboFeira – Blocked users (run this in the Supabase SQL editor).
-- A user's personal block list + the is_blocked_pair() helper used by
-- the block-aware messaging RLS and the new-message notification trigger.
--
-- APPLY ORDER (Phase 2 manual-apply gate, no migration runner):
--   1. blocked_users.sql        <-- THIS FILE — must be applied FIRST
--   2. messages_block_rls.sql   (its policies call is_blocked_pair)
--   3. new_message_notification.sql (its trigger fn calls is_blocked_pair)
--
-- Blocking is mutual + silent (D-07/D-08): A blocks B => each is invisible
-- to the other in messaging; B is NOT notified. The block list itself is
-- owner-scoped and is NOT published to realtime (it is not live-subscribed).
-- Re-runnable (idempotent).
-- =====================================================================

create table if not exists public.blocked_users (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocker_idx
  on public.blocked_users (blocker_id, created_at desc);

-- -----------------------------
-- Row level security — a user manages only their OWN block list.
-- (mirrors reports.sql owner-scoped policy convention)
-- -----------------------------

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_select_own" on public.blocked_users;
drop policy if exists "blocked_insert_own" on public.blocked_users;
drop policy if exists "blocked_delete_own" on public.blocked_users;

create policy "blocked_select_own"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

create policy "blocked_insert_own"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

create policy "blocked_delete_own"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- NO realtime publication: the block list is not live-subscribed.

-- -----------------------------
-- is_blocked_pair(a, b) — mutual check used by the messaging RLS and the
-- new-message notification trigger. SECURITY DEFINER + set search_path
-- (SEC-07 hardening) so it can read blocked_users past the owner RLS when
-- evaluating either side of a conversation pair.
-- -----------------------------
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_users
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;
