-- =====================================================================
-- CaboFeira – Supabase schema
-- Run this in the Supabase SQL editor once, on a fresh project.
-- =====================================================================

-- -----------------------------
-- Tables
-- -----------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  phone         text,
  bio           text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  member_since  date not null default current_date,
  verified      boolean not null default false,
  avatar        text,
  created_at    timestamptz not null default now()
);

create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  seller_id             uuid not null references public.profiles(id) on delete cascade,
  title                 text not null,
  description           text not null,
  price                 numeric not null default 0,
  currency              text not null default 'CVE',
  category              text not null,
  subcategory           text,
  condition             text,
  location_city         text,
  location_island       text,
  images                text[] not null default '{}',
  featured              boolean not null default false,
  views                 integer not null default 0,
  -- Snapshot of seller info at posting time (matches the original UI shape).
  seller_name           text not null,
  seller_phone          text,
  seller_email          text,
  seller_member_since   date,
  seller_verified       boolean default false,
  created_at            timestamptz not null default now()
);

-- Listing lifecycle keystone (FND-01 / D-02). `not null default 'active'`
-- auto-backfills existing rows (D-03) — no separate UPDATE needed.
alter table public.products
  add column if not exists status text not null default 'active'
  check (status in ('active','sold','expired','hidden'));

create index if not exists products_seller_id_idx on public.products (seller_id);
create index if not exists products_category_idx  on public.products (category);
create index if not exists products_created_idx   on public.products (created_at desc);

create table if not exists public.favorites (
  user_id     uuid references public.profiles(id) on delete cascade,
  product_id  uuid references public.products(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- -----------------------------
-- Auto-create a profile row whenever a new auth user signs up.
-- The frontend passes { name, phone } via auth.signUp options.data.
-- -----------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------
-- Helpers
-- -----------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Anonymous + authed users can increment views without needing UPDATE rights on the table.
create or replace function public.increment_product_views(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products set views = views + 1 where id = p_id;
$$;

-- -----------------------------
-- Row Level Security
-- -----------------------------

alter table public.profiles  enable row level security;
alter table public.products  enable row level security;
alter table public.favorites enable row level security;

-- profiles: world-readable (needed for Admin panel + seller cards), self-update, admin update.
drop policy if exists "profiles_select_all"     on public.profiles;
drop policy if exists "profiles_update_self"    on public.profiles;
drop policy if exists "profiles_update_admin"   on public.profiles;
create policy "profiles_select_all"   on public.profiles for select using (true);
create policy "profiles_update_self"  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin());

-- products: world-readable, owner CRUD, admin override on update/delete.
-- Legacy world-readable SELECT policy is dropped by name via a catch-all so
-- a re-run on an already-deployed DB cleanly replaces it (FND-01 rewrite).
do $$
declare pol text;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'products' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.products', pol);
  end loop;
end $$;
drop policy if exists "products_insert_self"                     on public.products;
drop policy if exists "products_update_self"                     on public.products;
drop policy if exists "products_delete_self"                     on public.products;
drop policy if exists "products_update_admin"                    on public.products;
drop policy if exists "products_delete_admin"                    on public.products;
-- SELECT: anon/public see only active listings; owner and admin still see
-- their non-active rows (My-Ads + Admin visibility preserved) — FND-01 / D-01.
create policy "products_select_active_or_owner_or_admin" on public.products for select using (status = 'active' or auth.uid() = seller_id or public.is_admin());
create policy "products_insert_self"  on public.products for insert with check (auth.uid() = seller_id);
create policy "products_update_self"  on public.products for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "products_delete_self"  on public.products for delete using (auth.uid() = seller_id);
create policy "products_update_admin" on public.products for update using (public.is_admin());
create policy "products_delete_admin" on public.products for delete using (public.is_admin());

-- favorites: each user only sees / manages their own.
drop policy if exists "favorites_select_own" on public.favorites;
drop policy if exists "favorites_insert_own" on public.favorites;
drop policy if exists "favorites_delete_own" on public.favorites;
create policy "favorites_select_own" on public.favorites for select using (auth.uid() = user_id);
create policy "favorites_insert_own" on public.favorites for insert with check (auth.uid() = user_id);
create policy "favorites_delete_own" on public.favorites for delete using (auth.uid() = user_id);

-- =====================================================================
-- Demo seed accounts intentionally removed (no credentials in source) — SEC-04.
-- =====================================================================
