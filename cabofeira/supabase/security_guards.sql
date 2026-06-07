-- =====================================================================
-- CaboFeira – Security guards (run this in the Supabase SQL editor).
-- BEFORE-trigger guards that block privilege escalation, listing theft,
-- and privileged-column mass-assignment from direct supabase-js/curl calls.
-- RLS WITH CHECK clauses (schema.sql) are the first line; these triggers
-- are the defense-in-depth that silently resets privileged columns for
-- non-admins on UPDATE/INSERT. Re-runnable (idempotent).
-- =====================================================================

-- Each guard is SECURITY DEFINER with `set search_path = public` (SEC-07
-- hardening). The `is_admin()` branch is correct inside the trigger because
-- `auth.uid()` reads the JWT claim, not the executing role — so even though
-- the function runs as definer, the admin check reflects the *caller*.
--
-- Failure mode is SILENT RESET, not `raise exception` (D-19): legitimate
-- full-row updates the app sends must still succeed, and we don't want to
-- leak which column an attacker targeted.
--
-- Phase-2 hook: each guard is the natural place to fire a future
-- `log_admin_action()`-style audit call when a non-admin attempts a
-- privileged change (out of scope this phase).

-- -----------------------------
-- SEC-01: profiles privilege escalation (role / verified)
-- -----------------------------
create or replace function public.guard_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- Non-admins cannot change their own role or verified flag.
  new.role := old.role;
  new.verified := old.verified;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_update on public.profiles;
create trigger trg_guard_profiles_update
  before update on public.profiles
  for each row execute function public.guard_profiles_update();

-- -----------------------------
-- SEC-02: products tampering (seller_id / featured / seller_verified / views)
-- -----------------------------
create or replace function public.guard_products_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- Non-admins cannot steal a listing or self-promote it.
  new.seller_id := old.seller_id;
  new.featured := old.featured;
  new.seller_verified := old.seller_verified;
  -- views: allow ONLY the monotonic +1 increment (D-20). increment_product_views()
  -- is SECURITY DEFINER but auth.uid() inside this fired guard is still the
  -- non-admin caller, so a flat `new.views := old.views` would break the counter.
  -- Any value other than old.views + 1 is pinned back to old.views.
  if new.views is distinct from old.views + 1 then
    new.views := old.views;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_products_update on public.products;
create trigger trg_guard_products_update
  before update on public.products
  for each row execute function public.guard_products_update();

-- -----------------------------
-- SEC-03: products mass-assignment on insert
-- -----------------------------
create or replace function public.guard_products_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- Non-admins cannot self-feature, self-verify, seed a view count, or post a
  -- pre-hidden/sold listing via the direct API.
  new.featured := false;
  new.seller_verified := false;
  new.views := 0;
  new.status := 'active';
  return new;
end;
$$;

drop trigger if exists trg_guard_products_insert on public.products;
create trigger trg_guard_products_insert
  before insert on public.products
  for each row execute function public.guard_products_insert();
