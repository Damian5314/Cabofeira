-- =====================================================================
-- CaboFeira – Structured report reasons (run this in the Supabase SQL editor).
-- Constrains reports.reason to a fixed enum (FEAT-02 / D-20) and silently
-- dedups a second report by the same user on the same listing via a unique
-- constraint (FEAT-03 / D-21). Re-runnable (idempotent).
--
-- PRE-APPLY CHECK (run BEFORE this file in the apply gate, Plan 02-02):
--   select count(*) from public.reports
--    where reason not in ('scam','spam','prohibited','already_sold','duplicate','other');
-- The backfill below also handles it defensively (Pitfall 4): existing
-- free-text reason values (the old modal stored translated labels) would
-- otherwise violate the new CHECK.
--
-- APPLY ORDER: BEFORE the report-modal value change + the Admin reason
-- filter (those store/read the enum keys).
-- =====================================================================

-- (1) Backfill: coerce any existing out-of-set reason to 'other' so the
-- CHECK constraint can be added without a check-violation (Pitfall 4).
update public.reports
   set reason = 'other'
 where reason not in ('scam', 'spam', 'prohibited', 'already_sold', 'duplicate', 'other');

-- (2) reason CHECK enum (mirrors notifications.sql L11 text+CHECK convention).
-- Idempotent: drop-if-exists then add.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports
  add constraint reports_reason_check
  check (reason in ('scam', 'spam', 'prohibited', 'already_sold', 'duplicate', 'other'));

-- (3) Dedup: one report per (reporter, product). The client upserts with
-- ignoreDuplicates so a repeat report is SILENTLY deduped (D-21, never a
-- hard error). Idempotent: drop-if-exists then add.
alter table public.reports drop constraint if exists reports_reporter_product_uniq;
alter table public.reports
  add constraint reports_reporter_product_uniq
  unique (reporter_id, product_id);
