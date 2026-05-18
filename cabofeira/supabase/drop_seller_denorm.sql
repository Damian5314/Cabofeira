-- =====================================================================
-- CaboFeira – Remove the denormalised seller_* columns on products.
-- Seller info is now read live via the seller_id -> profiles join.
-- Safe to re-run; uses IF EXISTS.
-- =====================================================================

alter table public.products drop column if exists seller_name;
alter table public.products drop column if exists seller_phone;
alter table public.products drop column if exists seller_email;
alter table public.products drop column if exists seller_member_since;
alter table public.products drop column if exists seller_verified;
