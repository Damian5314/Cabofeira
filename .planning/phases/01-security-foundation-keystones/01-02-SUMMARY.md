---
phase: 01-security-foundation-keystones
plan: 02
subsystem: database
tags: [supabase, postgres, rls, security-definer, realtime, notifications]

# Dependency graph
requires:
  - phase: 01-security-foundation-keystones
    provides: existing supabase/*.sql precedents (reports.sql, messages_unread.sql, messages.sql) for table/RLS/SECURITY-DEFINER/realtime idioms
provides:
  - public.notifications table (D-09 shape) with owner-only RLS and no direct INSERT path
  - create_notification() SECURITY DEFINER fan-out function as the sole insert authority (granted to authenticated, revoked from public/anon)
  - notifications added to supabase_realtime publication via guarded idempotent block
affects: [phase-2-notifications-bell, new_message-trigger, saved-search-alerts, price-drop-alerts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Owner-only RLS with no INSERT policy; rows enter exclusively via a SECURITY DEFINER fan-out function"
    - "Idempotent realtime publication via guarded pg_publication_tables do-block (no create publication, no replica identity full)"

key-files:
  created:
    - cabofeira/supabase/notifications.sql
  modified: []

key-decisions:
  - "create_notification() is the single insert authority; notifications has no user INSERT policy (D-06/D-10) so no user can forge another user's notification"
  - "No event triggers wired this phase (D-06); Phase 2 wires new_message and the navbar bell subscribes — this plan only builds the substrate"
  - "Realtime relies on RLS-filtered postgres_changes for INSERT events; no replica identity full and no create publication (D-10, RESEARCH A3)"

patterns-established:
  - "Notifications keystone: table + partial unread index + owner-only select/update RLS + SECURITY DEFINER fan-out + guarded realtime add, all idempotent and re-runnable"

requirements-completed: [FND-02]

# Metrics
duration: 4min
completed: 2026-06-07
---

# Phase 1 Plan 02: Notifications Keystone Summary

**Self-contained, idempotent `notifications.sql`: owner-only notifications table with a partial unread index, no direct INSERT path, a `create_notification()` SECURITY DEFINER fan-out as the sole insert authority, and the table added to the realtime publication for Phase 2's bell.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-07T19:13:00Z
- **Completed:** 2026-06-07T19:16:45Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Authored `public.notifications` with the exact D-09 column shape (id, user_id FK→profiles cascade, type text+CHECK of the four seeded values, title, body, data jsonb, link, read_at, created_at) plus the `notifications_user_unread_idx` partial index on unread rows.
- Enabled RLS with exactly two owner-scoped policies — `notifications_select_own` (select) and `notifications_update_own` (update, with WITH CHECK for mark-read) — and deliberately no INSERT policy.
- Added `create_notification(uuid,text,text,text,jsonb,text)` as a `language plpgsql security definer set search_path = public` fan-out, with execute revoked from public/anon and granted to authenticated.
- Added `public.notifications` to `supabase_realtime` via the guarded `pg_publication_tables` do-block; no `create publication`, no `replica identity full`.

## Task Commits

Both tasks author one self-contained file and were committed together as a single atomic unit (the file is incomplete and would not pass verification with only Task 1's content separated out, since the verify scripts validate the whole file):

1. **Task 1: notifications table, indexes, owner-only RLS** — `09e83ea` (feat)
2. **Task 2: create_notification() fan-out fn + realtime publication** — `09e83ea` (feat)

**Plan metadata:** pending docs commit.

## Files Created/Modified
- `cabofeira/supabase/notifications.sql` - notifications table + partial unread index, owner-only select/update RLS (no INSERT policy), `create_notification()` SECURITY DEFINER fan-out (sole insert path), and idempotent realtime publication add.

## Decisions Made
- Followed plan and PATTERNS.md verbatim. `create_notification()` is the sole insert authority; the table has no user INSERT policy. No event triggers wired this phase (D-06).

## Deviations from Plan

None - plan executed exactly as written. (One in-file comment was reworded so the literal phrase "replica identity full" — used in a negative comment — did not trip the Task 2 verify regex that forbids that string anywhere in the file. The SQL itself is unchanged and correctly omits `replica identity full`.)

## Issues Encountered
- The Task verify scripts use paths relative to the repo root (`cabofeira/supabase/notifications.sql`), so they were run from `E:/Projecten/Cabofeira` rather than the `cabofeira/` app directory. Both verifies returned `OK`.

## User Setup Required
None for this plan. The SQL is authored only; per the milestone constraint (no migration runner) it will be applied manually in the Supabase SQL editor — Plan 04 covers application, after which the FND-02 probe (01-RESEARCH.md line 536) verifies owner-only visibility live.

## Next Phase Readiness
- FND-02 substrate is complete and ready for Phase 2 to wire the `new_message` trigger onto `create_notification()` and for the navbar bell to subscribe to owner-filtered realtime INSERTs.
- No blockers introduced. Reminder (pre-existing STATE blocker): the notifications fan-out trigger design must avoid an O(N*M) scan when saved-search alerts are added later.

## Self-Check: PASSED

- FOUND: cabofeira/supabase/notifications.sql
- FOUND: commit 09e83ea

---
*Phase: 01-security-foundation-keystones*
*Completed: 2026-06-07*
