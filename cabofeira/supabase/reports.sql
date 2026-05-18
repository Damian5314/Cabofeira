-- =====================================================================
-- CaboFeira – Ad reports (run this in the Supabase SQL editor).
-- Stores user reports against listings, viewable by reporter + admins.
-- =====================================================================

create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  reporter_id   uuid not null references public.profiles(id) on delete cascade,
  reason        text not null,
  details       text,
  status        text not null default 'open'
                check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id) on delete set null
);

create index if not exists reports_product_idx on public.reports (product_id);
create index if not exists reports_status_idx  on public.reports (status, created_at desc);

-- -----------------------------
-- Row level security
-- -----------------------------

alter table public.reports enable row level security;

drop policy if exists "reports_insert_authed"    on public.reports;
drop policy if exists "reports_select_own"        on public.reports;
drop policy if exists "reports_select_admin"      on public.reports;
drop policy if exists "reports_update_admin"      on public.reports;
drop policy if exists "reports_delete_admin"      on public.reports;

create policy "reports_insert_authed"
  on public.reports for insert
  with check (reporter_id = auth.uid());

create policy "reports_select_own"
  on public.reports for select
  using (reporter_id = auth.uid());

create policy "reports_select_admin"
  on public.reports for select
  using (public.is_admin());

create policy "reports_update_admin"
  on public.reports for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "reports_delete_admin"
  on public.reports for delete
  using (public.is_admin());

-- -----------------------------
-- Realtime so the admin sees new reports immediately.
-- -----------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
end $$;
