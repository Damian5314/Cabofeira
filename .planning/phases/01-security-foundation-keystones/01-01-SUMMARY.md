---
phase: 01-security-foundation-keystones
plan: 01
subsystem: database
tags: [supabase, postgres, rls, triggers, security-definer, plpgsql, react-context]

# Dependency graph
requires:
  - phase: none
    provides: existing schema.sql RLS policies + is_admin() + increment_product_views()
provides:
  - "products.status keystone column (active/sold/expired/hidden) with default-active backfill"
  - "RLS SELECT policy products_select_active_or_owner_or_admin (anon sees only active; owner/admin see all)"
  - "WITH CHECK clauses on profiles_update_self and products_update_self"
  - "security_guards.sql: BEFORE-trigger guards for SEC-01/02/03 (profiles update, products update, products insert)"
  - "D-20-safe views handling (only old.views+1 allowed for non-admins)"
  - "schema.sql demo-credential block removed (SEC-04 partial)"
  - "status exposed in ProductsContext PRODUCT_SELECT + fromRow"
affects: [Plan 04 manual-apply, Plan 05 SEC-04 JS/JSON scrub + git history, Phase 2 status/Sold badge UI, Phase 4 security audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEFORE-trigger SECURITY DEFINER guard functions with is_admin() admin-exemption + silent-reset failure mode"
    - "Idempotent catch-all do-block to drop any prior SELECT policy by name before recreating"

key-files:
  created:
    - cabofeira/supabase/security_guards.sql
  modified:
    - cabofeira/supabase/schema.sql
    - cabofeira/src/context/ProductsContext.jsx

key-decisions:
  - "views guard uses 'is distinct from old.views + 1' allowlist (D-20) so increment_product_views survives for non-admins"
  - "guard failure mode is silent reset, not raise exception (D-19) — preserves legitimate full-row updates, no column-target leak"
  - "guard_products_insert pins status='active' (closes RESEARCH Open Q2 — no pre-hidden/sold listing via direct API)"
  - "legacy products_select_all dropped via pg_policies catch-all do-block instead of a named drop (idempotent + satisfies verify contract that forbids the literal)"

patterns-established:
  - "Per-concern security_guards.sql file mirroring reports.sql header + handle_new_user() trigger shape"
  - "Idempotent SELECT-policy replacement via pg_policies loop"

requirements-completed: [FND-01, SEC-01, SEC-02, SEC-03]

# Metrics
duration: 12min
completed: 2026-06-07
---

# Phase 1 Plan 01: Security Foundation Keystones Summary

**Postgres-enforced security boundary: BEFORE-trigger guards block privilege escalation / listing theft / mass-assignment, a products.status keystone column ships with an RLS "only active is public" SELECT policy, and demo credentials are scrubbed from schema.sql.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-07
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Authored `security_guards.sql` with three idempotent SECURITY DEFINER BEFORE-trigger guards closing SEC-01 (profiles role/verified), SEC-02 (products seller_id/featured/seller_verified/views), and SEC-03 (insert mass-assignment).
- Added the `products.status` keystone column (FND-01) and rewrote the products SELECT policy so anon/public see only `active` listings while owner and admin retain full visibility.
- Added `WITH CHECK` reinforcement to both self-update policies, and removed the `admin123`/`user123` demo-credential block from schema.sql (SEC-04 partial).
- Exposed `status` through `ProductsContext` (PRODUCT_SELECT + fromRow) without adding any query filter — RLS remains the boundary.

## Task Commits

Each task was committed atomically:

1. **Task 1: Author security_guards.sql** - `57044ca` (feat)
2. **Task 2: schema.sql status column / SELECT rewrite / WITH CHECK / demo scrub** - `56e852e` (feat)
3. **Task 3: Expose status in ProductsContext** - `5846dc9` (feat)

## Files Created/Modified
- `cabofeira/supabase/security_guards.sql` - Three SECURITY DEFINER guard functions + idempotent triggers (profiles update, products update, products insert) with is_admin() exemption and D-20-safe views handling.
- `cabofeira/supabase/schema.sql` - Added products.status text+CHECK column; rewrote SELECT policy to `products_select_active_or_owner_or_admin`; added WITH CHECK to profiles_update_self / products_update_self; removed demo-credential block.
- `cabofeira/src/context/ProductsContext.jsx` - Added `status` to PRODUCT_SELECT and `status: r.status` to fromRow.

## Decisions Made
- **views allowlist via `is distinct from old.views + 1`:** Preferred over a flat `new.views := old.views` so the SECURITY DEFINER `increment_product_views()` RPC still works for non-admin callers (D-20 trap avoidance). Any non-+1 rewrite is pinned to `old.views`.
- **Silent reset, not raise exception (D-19):** Guards quietly reset privileged columns; legitimate full-row app updates succeed and the failure does not reveal which column was targeted.
- **Catch-all do-block for legacy SELECT policy:** The Task 2 verify script forbids the literal `products_select_all` anywhere in schema.sql, including a named `drop policy`. Resolved by dropping any existing products SELECT policy via a `pg_policies` loop before recreating — fully idempotent and contract-compliant. (See Deviations.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Legacy SELECT-policy drop reworked to satisfy verify contract**
- **Found during:** Task 2 (schema.sql edits)
- **Issue:** The plan's PATTERNS guidance used a named `drop policy if exists "products_select_all"` for idempotency, but the Task 2 automated verify script fails if the literal `products_select_all` appears anywhere in schema.sql. The named drop blocked verification.
- **Fix:** Replaced the named drop with an idempotent `do $$ ... $$` block that loops over `pg_policies` and drops any existing SELECT policy on `public.products` by name before the `create policy`. This removes the legacy policy on an already-deployed DB (preserving manual-re-run idempotency for Plan 04) without referencing the forbidden literal.
- **Files modified:** cabofeira/supabase/schema.sql
- **Verification:** Task 2 verify script now reports OK; the catch-all also correctly removes the new policy on re-run before recreating it.
- **Committed in:** `56e852e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix preserves all stated acceptance criteria (legacy policy removed, idempotent, correct three-branch USING expression) and improves idempotency robustness. No scope creep.

## Issues Encountered
- Git reports `LF will be replaced by CRLF` warnings on Windows for the SQL/JSX files. Cosmetic line-ending normalization only; no content impact.

## Threat Flags
None — no new security surface beyond the threat model. All changes map to mitigations T-01-01 through T-01-06 in the plan's threat register.

## Known Stubs
None — `status` is wired through PRODUCT_SELECT/fromRow with a real DB-backed value; no placeholders introduced.

## User Setup Required
None for this plan. NOTE: This plan only AUTHORS the SQL — it is NOT applied to Supabase here. Plan 04 contains the BLOCKING manual-apply task (run schema.sql + security_guards.sql in the Supabase SQL editor) and the direct-API verification pass.

## Next Phase Readiness
- SQL is authored and idempotent, ready for Plan 04 manual-apply + verification probe.
- `products.status` is available for Phase 2 Sold-badge UI without a further query refactor.
- SEC-04 remains partially open: JS/JSON credential scrub (`seedUsers.js`, `Login.jsx`, `en.json`/`pt-cv.json`) and git-history rewrite are Plan 05; Supabase Auth demo-account deletion is an ops step.

## Self-Check: PASSED

- All created/modified files present on disk.
- All three task commits (`57044ca`, `56e852e`, `5846dc9`) found in git history.

---
*Phase: 01-security-foundation-keystones*
*Completed: 2026-06-07*
