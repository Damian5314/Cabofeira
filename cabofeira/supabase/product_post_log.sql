-- =====================================================================
-- CaboFeira – Ad-posting rate limit (run this in the Supabase SQL editor).
-- Server-side, bypass-resistant rate limit: max 10 ad inserts per user per
-- rolling 1-hour window (ABUSE-01 / D-04/D-05/D-06). DB-enforced via a
-- BEFORE-INSERT guard over an APPEND-ONLY log table — never a client check.
-- Re-runnable (idempotent).
--
-- HARD-DELETE-PROOF (Pitfall 2 / D-05): product_post_log.user_id is NOT a
-- cascading FK to products. removeProduct() does a real DELETE; if we counted
-- products.created_at the count would reset on delete-and-repost, defeating
-- the limit. The log row is written by an AFTER-INSERT trigger and is NEVER
-- removed when the product is, so deleted inserts still count.
--
-- DIVERGENCE NOTE (vs Phase-1 guards): the Phase-1 security guards use SILENT
-- RESET (D-19). This guard RAISES (errcode P0001, detail 'ad_post_rate_limit')
-- — that is correct and intended for D-06 (block the insert + show a friendly
-- localized "try again in X minutes" message). The client maps the coded
-- error to that message in Plan 02-07.
-- =====================================================================

-- Append-only log. user_id has NO cascading FK to products (Pitfall 2).
create table if not exists public.product_post_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  created_at  timestamptz not null default now()
);

create index if not exists product_post_log_user_idx
  on public.product_post_log (user_id, created_at desc);

-- RLS enabled with NO client policies: rows enter ONLY via the AFTER-INSERT
-- definer trigger below (default-deny to clients).
alter table public.product_post_log enable row level security;

-- -----------------------------
-- BEFORE INSERT guard: count the rolling window, raise on the 11th.
-- SECURITY DEFINER + set search_path (SEC-07). auth.uid() inside a definer
-- trigger reads the JWT (the caller), so the is_admin() branch exempts admins.
-- -----------------------------
create or replace function public.enforce_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if public.is_admin() then
    return new;                                   -- admins exempt
  end if;

  select count(*) into v_count
    from public.product_post_log
   where user_id = new.seller_id
     and created_at > now() - interval '1 hour';

  if v_count >= 10 then
    raise exception 'RATE_LIMIT'
      using errcode = 'P0001',
            detail  = 'ad_post_rate_limit';       -- client maps to friendly localized message (D-06)
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_post_rate_limit on public.products;
create trigger trg_enforce_post_rate_limit
  before insert on public.products
  for each row execute function public.enforce_post_rate_limit();

-- -----------------------------
-- AFTER INSERT log writer (append-only). SECURITY DEFINER so it can write
-- past the no-client-policy RLS.
-- -----------------------------
create or replace function public.log_product_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_post_log (user_id) values (new.seller_id);
  return new;
end;
$$;

drop trigger if exists trg_log_product_post on public.products;
create trigger trg_log_product_post
  after insert on public.products
  for each row execute function public.log_product_post();
