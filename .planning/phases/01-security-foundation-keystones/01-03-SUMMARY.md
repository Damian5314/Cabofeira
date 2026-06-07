---
phase: 01-security-foundation-keystones
plan: 03
subsystem: database
tags: [supabase, postgres, rls, security-definer, audit-log, plpgsql]

# Dependency graph
requires:
  - phase: 01-security-foundation-keystones
    provides: public.is_admin() helper (schema.sql) used by the audit-log SELECT policy and the RPC admin gate
provides:
  - "public.admin_audit_log append-only table (admin-only SELECT, no mutation policies, revoked client grants)"
  - "public.log_admin_action(text, text, uuid, jsonb) — sole SECURITY DEFINER write path with an in-function admin gate"
affects: [phase-02-admin, ADMIN-01, ADMIN-02, admin-mutations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Append-only table via absence of INSERT/UPDATE/DELETE policies + revoked client grants (no trigger needed)"
    - "SECURITY DEFINER RPC as the sole write path with an in-function is_admin() gate (not the execute grant)"

key-files:
  created:
    - cabofeira/supabase/admin_audit_log.sql
  modified: []

key-decisions:
  - "Append-only enforced by RLS default-deny + revoked grants, not a raise-on-update trigger (D-14)"
  - "In-function is_admin() gate (not the execute grant) restricts writes to admins (D-11)"
  - "Callers serialize before/after context into p_details jsonb; no auto-capture triggers (D-12)"

patterns-established:
  - "Audit substrate: one generic RPC + one append-only table that every future admin mutation composes onto without a schema change"

requirements-completed: [FND-03]

# Metrics
duration: 1min
completed: 2026-06-07
---

# Phase 01 Plan 03: Admin Audit Log Keystone Summary

**Append-only `admin_audit_log` table plus a generic `log_admin_action()` SECURITY DEFINER RPC — the sole, admin-gated write path that every future admin mutation will compose onto without a schema change.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-06-07T19:19:27Z
- **Completed:** 2026-06-07T19:20:36Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `public.admin_audit_log` table with the exact D-13 shape (actor_id, action, target_table, target_id, details jsonb, created_at) and a `created_at desc` index.
- Append-only enforcement: a single `audit_select_admin` SELECT policy, no insert/update/delete policies, and revoked insert/update/delete grants from anon/authenticated (D-14/D-15).
- `public.log_admin_action(text, text, uuid, jsonb)` as the only write path — SECURITY DEFINER, pinned `search_path`, in-function `is_admin()` gate raising `'Not authorized'` for non-admins (D-11), execute revoked from public/anon and granted to authenticated.
- File is self-contained and idempotent (`create table if not exists`, `create or replace function`, drop-before-create policy).

## Task Commits

Each task was committed atomically:

1. **Task 1: Append-only table + admin-only SELECT RLS** - `e852e41` (feat)
2. **Task 2: log_admin_action() RPC with in-function admin gate** - `424b99f` (feat)

**Plan metadata:** docs commit (this SUMMARY + state files)

## Files Created/Modified
- `cabofeira/supabase/admin_audit_log.sql` - New per-concern SQL file: append-only audit table, admin-only SELECT RLS, revoked mutation grants, and the gated `log_admin_action()` RPC.

## Decisions Made
- Append-only is achieved by the deliberate absence of mutation policies plus revoked client grants — no raise-on-update trigger (D-14).
- The in-function `is_admin()` gate (not the execute grant) is the access control; the grant only allows the RPC to be invoked (D-11).
- Followed the messages_unread.sql / reports.sql conventions for the SECURITY DEFINER fn shape and admin-gated RLS.

## Deviations from Plan

None - plan executed exactly as written. (The Task 2 admin gate was authored on a single line to match the plan's verification string; this is a formatting choice within the planned content, not a behavioral deviation.)

## Issues Encountered
None. The Task 2 automated verify initially flagged the admin gate when it spanned two lines; collapsing it to the plan's single-line form (`if not public.is_admin() then raise exception 'Not authorized'; end if;`) satisfied the check. Valid, equivalent SQL.

## Known Stubs
None. This plan only authors the SQL substrate (D-11/D-12); no admin features write to the log this phase, by design. Phase 2 wires the writes and builds the viewer (ADMIN-01/02).

## User Setup Required
This SQL must be applied manually in the Supabase SQL editor (no migration runner exists for this project). After applying, Plan 04's FND-03 probe verifies: a non-admin `rpc('log_admin_action', ...)` errors `'Not authorized'`, an admin call succeeds, and direct update/delete on the table is denied.

## Next Phase Readiness
- FND-03 substrate complete: the audit table and generic RPC are ready for Phase 2 admin mutations and the audit-log viewer (ADMIN-01/02).
- No blockers introduced.

## Self-Check: PASSED

- FOUND: cabofeira/supabase/admin_audit_log.sql
- FOUND: 01-03-SUMMARY.md
- FOUND: commit e852e41 (Task 1)
- FOUND: commit 424b99f (Task 2)

---
*Phase: 01-security-foundation-keystones*
*Completed: 2026-06-07*
