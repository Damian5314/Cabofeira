-- =====================================================================
-- CaboFeira – Admin audit log (run this in the Supabase SQL editor).
-- Append-only, tamper-evident record of every admin mutation. The only
-- write path is the SECURITY DEFINER log_admin_action() RPC below.
--
-- Append-only design (D-14): there are NO insert/update/delete RLS
-- policies (default-deny), and direct insert/update/delete grants are
-- revoked from anon/authenticated. Together this makes the table
-- immutable to clients; no raise-on-update trigger is needed. Writes
-- happen only through log_admin_action(), which runs as the function
-- owner and bypasses RLS while enforcing an in-function admin gate.
-- =====================================================================

create table if not exists public.admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid not null default auth.uid() references public.profiles(id),
  action        text not null,
  target_table  text,
  target_id     uuid,
  details       jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- -----------------------------
-- Row level security (admin-only SELECT; append-only, D-14/D-15)
-- -----------------------------

alter table public.admin_audit_log enable row level security;

-- Exactly one policy: admins may read. The deliberate ABSENCE of any
-- insert/update/delete policy is the append-only/immutable mechanism.
drop policy if exists "audit_select_admin" on public.admin_audit_log;

create policy "audit_select_admin"
  on public.admin_audit_log for select
  using (public.is_admin());

-- Even table-owner-adjacent roles must not mutate the log directly; the
-- only write path is the SECURITY DEFINER function below.
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;
