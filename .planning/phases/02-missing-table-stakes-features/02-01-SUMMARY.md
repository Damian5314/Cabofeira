---
phase: 02-missing-table-stakes-features
plan: 01
subsystem: database
tags: [supabase, postgres, rls, security-definer, triggers, edge-function, deno, turnstile, captcha, rate-limit]

# Dependency graph
requires:
  - phase: 01-security-foundation-keystones
    provides: "create_notification() fan-out RPC, is_admin() helper, products.status enum + guard triggers, log_admin_action(), reports table, messages/conversations tables + RLS"
provides:
  - "blocked_users table + owner RLS + is_blocked_pair(a,b) mutual-block helper"
  - "Block-aware messaging RLS (conversations/messages SELECT + messages INSERT exclude blocked pairs) — server-side enforcement (D-09 #2)"
  - "new_message AFTER-INSERT trigger that fans out via create_notification(), silent for blocked pairs"
  - "reports.reason CHECK enum + (reporter_id,product_id) unique with defensive backfill"
  - "Relaxed products SELECT policy exposing active+sold (expired/hidden stay private)"
  - "Append-only product_post_log + BEFORE-INSERT raising rate-limit guard (10/hour, admins exempt) + AFTER-INSERT log writer"
  - "verify-turnstile Deno Edge Function (server-side siteverify, secret only in Deno.env)"
affects: [02-02-apply-gate, 02-03-products-context-feed-filter, 02-07-postad-rate-limit-surfacing, 04-security-audit]

# Tech tracking
tech-stack:
  added: [Supabase Edge Functions (Deno) — first Edge Function in this repo]
  patterns: ["Per-concern idempotent SQL files (drop-then-create policy/constraint, create-if-not-exists)", "SECURITY DEFINER + set search_path=public on every new function", "Append-only non-cascading log for hard-delete-proof rate limiting", "Mutual-block helper composed into RLS using/with-check + trigger short-circuit"]

key-files:
  created:
    - cabofeira/supabase/blocked_users.sql
    - cabofeira/supabase/messages_block_rls.sql
    - cabofeira/supabase/new_message_notification.sql
    - cabofeira/supabase/reports_reason.sql
    - cabofeira/supabase/products_sold_visibility.sql
    - cabofeira/supabase/product_post_log.sql
    - cabofeira/supabase/functions/verify-turnstile/index.ts
  modified: []

key-decisions:
  - "blocked_users is NOT published to realtime (block list is not live-subscribed)"
  - "Rate-limit guard RAISES P0001/ad_post_rate_limit (intended divergence from Phase-1 silent-reset guards) so D-06 can show a friendly localized block message"
  - "product_post_log.user_id has NO cascading FK to products so the count survives hard removeProduct() DELETE (D-05)"
  - "products SELECT relaxed to active+sold ONLY; expired/hidden remain owner/admin (Information Disclosure threat)"
  - "Turnstile secret read ONLY from Deno.env.get(CLOUDFLARE_SECRET_KEY); literal REACT_APP_ reference removed from the file to keep the no-client-prefix invariant grep-clean"

patterns-established:
  - "Apply-order header comments in dependency-chained SQL (blocked_users FIRST; messages_block_rls + new_message_notification AFTER)"
  - "Defensive backfill before adding a CHECK constraint over previously free-text columns (Pitfall 4)"

requirements-completed: [FEAT-01, FEAT-02, FEAT-03, FEAT-05, FEAT-08, ABUSE-01, ABUSE-02]

# Metrics
duration: 12min
completed: 2026-06-09
---

# Phase 2 Plan 01: Backend Artifact Authoring Summary

**Six idempotent, dependency-ordered per-concern SQL files (blocked-users + mutual-block messaging RLS, new-message notification trigger, structured report reasons, sold-visibility relax, hard-delete-proof posting rate limit) plus the repo's first Deno Edge Function (verify-turnstile siteverify) — all authored, none applied (apply gate is Plan 02-02).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-09
- **Completed:** 2026-06-09
- **Tasks:** 3
- **Files created:** 7

## Accomplishments
- `blocked_users.sql`: table + three owner-scoped policies + `is_blocked_pair(a,b)` mutual helper, applied FIRST in the chain.
- `messages_block_rls.sql`: rewrites all three messaging policies to append `not is_blocked_pair(...)` — the HIGH-severity server-side block boundary (D-09 #2).
- `new_message_notification.sql`: SECURITY DEFINER AFTER-INSERT trigger fanning out via `create_notification()`, short-circuiting blocked pairs.
- `reports_reason.sql`: defensive backfill → reason CHECK enum + `(reporter_id,product_id)` unique, both idempotent.
- `products_sold_visibility.sql`: SELECT relaxed to active+sold only, with a prominent paired-edit warning for Plan 02-03.
- `product_post_log.sql`: append-only non-cascading log + BEFORE-INSERT raising guard (≥10/hour, admins exempt) + AFTER-INSERT writer.
- `verify-turnstile/index.ts`: Deno.serve siteverify reading the secret only from `Deno.env`, with CORS and CLI-deploy notes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Block-user + messaging-RLS + new-message-notification SQL** - `5fa798f` (feat)
2. **Task 2: Reports reason + products sold-visibility + rate-limit SQL** - `386c197` (feat)
3. **Task 3: verify-turnstile Edge Function source** - `4d8aab4` (feat)

**Plan metadata:** _(this docs commit)_

## Files Created/Modified
- `cabofeira/supabase/blocked_users.sql` - Block list table + owner RLS + `is_blocked_pair()` helper (apply FIRST).
- `cabofeira/supabase/messages_block_rls.sql` - Block-aware rewrite of conversations/messages SELECT + messages INSERT policies.
- `cabofeira/supabase/new_message_notification.sql` - AFTER-INSERT trigger → `create_notification()` fan-out, silent for blocked pairs.
- `cabofeira/supabase/reports_reason.sql` - Backfill + reason CHECK enum + `(reporter_id,product_id)` unique.
- `cabofeira/supabase/products_sold_visibility.sql` - Relaxes products SELECT to active+sold (expired/hidden stay private).
- `cabofeira/supabase/product_post_log.sql` - Append-only rate-limit log + BEFORE/AFTER triggers.
- `cabofeira/supabase/functions/verify-turnstile/index.ts` - Deno Edge Function for the posting CAPTCHA siteverify.

## Decisions Made
- Removed the literal `REACT_APP_` string from the Edge Function comment so the plan's `grep -c "REACT_APP" returns 0` acceptance check passes; the intent (secret must never use the client-exposed env prefix) is preserved with reworded copy. This is a wording adjustment to satisfy a static verification gate, not a behavior change.
- All other choices followed the RESEARCH snippets and PATTERNS analogs exactly (per-concern idempotent files, SECURITY DEFINER + set search_path, no realtime on the block list, raising rate-limit guard, non-cascading log).

## Deviations from Plan

None — plan executed exactly as written. (The Edge Function comment reword above is a verification-gate accommodation noted under Decisions, not unplanned functional work; no Rule 1-4 deviations were triggered.)

## Issues Encountered
- The initial `verify-turnstile/index.ts` contained the literal token `REACT_APP_` inside an explanatory comment, which tripped the plan's `grep -c "REACT_APP" returns 0` static check. Resolved by rewording the comment to "CRA client-exposed env prefix" — no functional change; secret handling unchanged.

## User Setup Required
None in this plan — this is pure authoring. The manual apply/provision gate (paste SQL in order, deploy the Edge Function via `supabase functions deploy`, set `CLOUDFLARE_SECRET_KEY` via `supabase secrets set`, provision Turnstile keys, toggle signup CAPTCHA) is Plan 02-02. Nothing here touched the live database.

## Next Phase Readiness
- All six SQL files + the Edge Function are ready for the strict-order apply gate (Plan 02-02). Apply order: `blocked_users.sql` → `messages_block_rls.sql` → `reports_reason.sql` (run the pre-apply count check first) → `products_sold_visibility.sql` → `product_post_log.sql` → `new_message_notification.sql`; Edge Function deployed via CLI.
- Carry-forward dependency for Plan 02-03: `products_sold_visibility.sql` MUST be applied together with the `ProductsContext` `.eq('status','active')` feed/search edits or Home/Search will leak sold ads (Pitfall 1).
- Open Q1 (Edge Function availability for this Supabase project) is still to be verified in 02-02.
- Assumption A2 (definer trigger satisfies `create_notification()` cross-user gate) requires a real two-account message test in 02-02.

## Self-Check: PASSED

All 7 authored artifacts + SUMMARY.md exist on disk; all three task commits (5fa798f, 386c197, 4d8aab4) are present in git history.

---
*Phase: 02-missing-table-stakes-features*
*Completed: 2026-06-09*
