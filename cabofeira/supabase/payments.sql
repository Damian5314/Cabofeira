-- =====================================================================
-- CaboFeira – Payment status for products.
-- Ads now have a payment_status that controls public visibility:
--   "free"   = posting was free (category price = 0, not featured) → live
--   "paid"   = Stripe checkout completed → live
--   "unpaid" = waiting for Stripe payment → only seller + admin see it
-- =====================================================================

alter table public.products
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'free')),
  add column if not exists stripe_session_id text,
  add column if not exists paid_at timestamptz;

create index if not exists products_payment_status_idx
  on public.products (payment_status, created_at desc);

-- -----------------------------
-- Tighten the SELECT policy so unpaid ads are invisible to the public.
-- -----------------------------
drop policy if exists "products_select_all"            on public.products;
drop policy if exists "products_select_paid_or_owner"  on public.products;

create policy "products_select_paid_or_owner"
  on public.products for select
  using (
    payment_status in ('paid', 'free')
    or seller_id = auth.uid()
    or public.is_admin()
  );

-- Existing rows are grandfathered to 'free' so they stay visible.
update public.products
   set payment_status = 'free'
 where payment_status = 'unpaid' and created_at < now();
