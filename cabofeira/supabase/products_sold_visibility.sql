-- =====================================================================
-- CaboFeira – Sold-listing visibility relax (run this in the Supabase SQL
-- editor). Relaxes the Phase-1 products SELECT policy so 'sold' listings
-- stay publicly visible (with a "Sold" badge on the seller's public profile
-- / public ad list), while keeping 'expired'/'hidden' owner/admin-only
-- (FEAT-01 / D-13 / D-14). Re-runnable (idempotent: drop-then-create).
--
-- !!! MUST BE APPLIED TOGETHER WITH the ProductsContext .eq('status','active')
-- feed/search edits in Plan 02-03. Once SELECT permits 'sold', refreshProducts
-- (Home) and fetchProducts (Search) will leak sold ads into the main feed
-- unless they explicitly filter status='active' (Pitfall 1).
--
-- THREAT (Information Disclosure): relax to status IN ('active','sold') ONLY.
-- Do NOT widen to all statuses — 'expired'/'hidden' must remain owner/admin.
--
-- Phase-1 guard triggers are UNCHANGED and remain correct:
--   * guard_products_insert() pins status='active' for non-admins
--     (security_guards.sql L99) => 'sold' is reachable ONLY via UPDATE,
--     never INSERT — exactly what we want.
--   * guard_products_update() does NOT pin status => mark-as-sold works.
-- =====================================================================

drop policy if exists "products_select_active_or_owner_or_admin" on public.products;

create policy "products_select_active_or_owner_or_admin"
  on public.products for select
  using (status in ('active', 'sold') or auth.uid() = seller_id or public.is_admin());
