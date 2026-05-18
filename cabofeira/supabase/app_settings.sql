-- =====================================================================
-- CaboFeira – App settings (run once in Supabase SQL editor).
-- Generic key-value store for app-wide configuration like posting prices.
-- =====================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

-- Seed default posting prices + featured surcharge so a fresh install
-- doesn't need code-side fallbacks to kick in.
insert into public.app_settings (key, value) values
  ('posting_prices', jsonb_build_object(
      'vehicles',          500,
      'real-estate',      1000,
      'electronics',       200,
      'home-garden',       200,
      'fashion',           100,
      'jobs',                0,
      'services',          150,
      'animals',           200,
      'sports-hobbies',    100,
      'food-agriculture',    0,
      'baby-kids',         100,
      'other',             100
    )),
  ('featured_price', to_jsonb(1000))
on conflict (key) do nothing;

-- Keep updated_at fresh on every write.
create or replace function public.touch_app_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_app_settings on public.app_settings;
create trigger trg_touch_app_settings
  before update on public.app_settings
  for each row execute function public.touch_app_settings();

-- -----------------------------
-- Row level security
-- -----------------------------

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_all"   on public.app_settings;
drop policy if exists "app_settings_write_admin" on public.app_settings;
drop policy if exists "app_settings_update_admin" on public.app_settings;

-- Everyone (incl. anonymous visitors) can read settings – PostAd needs them.
create policy "app_settings_select_all"
  on public.app_settings for select
  using (true);

-- Only admins may insert / upsert new keys.
create policy "app_settings_write_admin"
  on public.app_settings for insert
  with check (public.is_admin());

-- Only admins may update existing keys.
create policy "app_settings_update_admin"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------
-- Realtime so price changes propagate live to other admins / PostAd.
-- -----------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
