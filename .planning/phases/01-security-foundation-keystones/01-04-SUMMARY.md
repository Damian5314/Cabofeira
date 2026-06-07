---
phase: 01-security-foundation-keystones
plan: 04
subsystem: security-verification
tags: [supabase, rls, sql-apply, verification-probe, supabase-js]
provides:
  - "verification-probe.mjs: runnable direct-API probe encoding all 5 ROADMAP success criteria (authored, not yet run)"
  - "All 4 Phase-1 SQL files applied clean to the live Supabase project (user-confirmed)"
affects: [phase-01-security-foundation-keystones, phase-04-security-hardening]
tech-stack:
  added: []
  patterns: ["direct-API authorization probe via anon-key supabase-js as a throwaway normal user"]
key-files:
  created: [.planning/phases/01-security-foundation-keystones/verification-probe.mjs]
  modified: []
key-decisions:
  - "Task 3 direct-API probe DEFERRED by explicit user decision — run later via /gsd-verify-work; phase boundary is APPLIED but UNPROVEN"
duration: continuation
completed: 2026-06-07
---

# Phase 01 Plan 04: Manual SQL Apply + Verification Probe Summary

**All four Phase-1 SQL files were applied clean to the live Supabase project and the direct-API verification probe was authored — but the probe has NOT been run, so the security boundary is APPLIED yet UNPROVEN until it runs green.**

## Performance
- **Duration:** continuation (probe authored in prior session; SQL applied by user; this session records state)
- **Tasks:** 2 of 3 complete; 1 deferred
- **Files modified:** 1 created (verification-probe.mjs)

## Accomplishments
- **Task 1 (auto) — COMPLETE:** Authored `verification-probe.mjs`, an ESM Node script using `@supabase/supabase-js` `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`. It signs in as a throwaway NORMAL user and encodes every probe from the RESEARCH probe table (SEC-01/02/03, D-20, FND-01/02/03) plus the SEC-04 dead-demo-login assertions. Credential-free, prints PASS/FAIL per probe, exits non-zero on any FAIL. Passes `node --check` and the token-presence verify. Committed `b831c9b`.
- **Task 2 (checkpoint:human-action, BLOCKING) — COMPLETE:** The user applied all four SQL files in the required order in the Supabase SQL Editor and confirmed "all the sql ran clean":
  1. `cabofeira/supabase/schema.sql` (products.status column, rewritten products SELECT policy, WITH CHECK on self-update policies)
  2. `cabofeira/supabase/security_guards.sql` (three BEFORE-trigger guards)
  3. `cabofeira/supabase/notifications.sql`
  4. `cabofeira/supabase/admin_audit_log.sql`
  All ran without error against the live project.

## Task Commits
1. **Task 1: Author the direct-API verification probe script** - `b831c9b`
2. **Task 2: [BLOCKING] Apply all Phase 1 SQL in Supabase** - no commit (manual SQL apply in Supabase Dashboard; no repo change)
3. **Task 3: [BLOCKING] Run the verification probe** - DEFERRED (not run)

## Files Created/Modified
- `.planning/phases/01-security-foundation-keystones/verification-probe.mjs` - Runnable direct-API authorization probe encoding all 5 ROADMAP success criteria; awaiting its first run.

## ROADMAP Success Criteria — Status

The underlying SQL for all 5 criteria is now APPLIED to the live database, but NONE has been probe-verified yet. Status below reads APPLIED (in-DB) / NOT YET PROBE-VERIFIED:

1. **Self-update cannot change `role`/`verified`** (SEC-01) — APPLIED (WITH CHECK + BEFORE UPDATE trigger live). NOT YET PROBE-VERIFIED.
2. **`products` update cannot reassign `seller_id`/flip `featured`/fake `seller_verified`/alter `views`; insert forces safe defaults** (SEC-02/03) — APPLIED (guard triggers live). NOT YET PROBE-VERIFIED.
3. **`products.status` enum exists; only `active` appears in public browse/search** (FND-01) — APPLIED (column + SELECT policy live). NOT YET PROBE-VERIFIED.
4. **`notifications` (RLS + realtime + fan-out) and append-only `admin_audit_log` + `log_admin_action()` exist** (FND-02/FND-03) — APPLIED. NOT YET PROBE-VERIFIED.
5. **No demo admin/user account authenticates against prod Auth; demo block scrubbed** (SEC-04) — PARTIAL: handled by Plan 01-05 (demo-credential scrub + Auth-account deletion + history rewrite). The probe's SEC-04 assertions only pass once 01-05 completes. NOT YET PROBE-VERIFIED.

## OUTSTANDING VERIFICATION GATE (Task 3 — DEFERRED)

> **The phase's security boundary is APPLIED but UNPROVEN.** The direct-API verification probe has NOT been run. This is the deliberately-deferred human verification (UAT) step — the user chose to finish the phase as PENDING and run the probe later via `/gsd-verify-work`. Until the probe runs green, no ROADMAP success criterion is demonstrably proven against the live DB.

**To run the probe (do this after Plan 01-05 completes, so the SEC-04 demo-login assertions can pass):**

1. Ensure a throwaway NORMAL (non-admin) test account exists in Supabase Auth (signup via the app or create in the dashboard). A second normal account is needed for the cross-user notification check.
2. Set environment variables:
   - `SUPABASE_URL` (Dashboard → Project Settings → API → Project URL)
   - `SUPABASE_ANON_KEY` (Dashboard → Project Settings → API → anon public key)
   - `TEST_EMAIL`, `TEST_PASSWORD` (the throwaway normal account)
   - optional `TEST2_EMAIL`, `TEST2_PASSWORD` (the second normal account, for the cross-user notification probe)
3. From the repo root run:
   ```
   node .planning/phases/01-security-foundation-keystones/verification-probe.mjs
   ```
4. Confirm EVERY probe prints PASS and the process exits 0. Any FAIL is a real RLS hole that must be fixed before the phase can complete.

## Decisions & Deviations
- **Deviation (user decision):** Task 3 (run the probe) was deferred rather than executed in this plan. The user opted to close the phase as PENDING-verification and run the direct-API probe later via `/gsd-verify-work`. This is an outstanding verification gate, not a completed task — the SUMMARY does not claim the boundary is proven.
- No SQL was run and no probe was run by this continuation agent; its scope was strictly to record the resolved checkpoint state and update tracking.

## Next Phase Readiness
- Plan 01-05 (SEC-04: demo-credential scrub + Auth-account deletion + git-history rewrite) is the remaining BLOCKING plan in Phase 1. It must complete before the probe's SEC-04 demo-login assertions can pass.
- After 01-05, run `verification-probe.mjs` (env vars above) via `/gsd-verify-work` to close the outstanding verification gate and prove all 5 ROADMAP success criteria against the live DB.
- Phase 1 remains IN PROGRESS / PENDING VERIFICATION — not complete — until the probe runs green.

## Self-Check: PASSED
- `verification-probe.mjs` exists at `.planning/phases/01-security-foundation-keystones/verification-probe.mjs` — FOUND.
- Commit `b831c9b` (probe authoring) exists in git log — FOUND.
- Task 2 SQL apply is a manual Supabase action with no repo artifact; user-confirmed "all the sql ran clean" — recorded as complete, not git-verifiable by design.
- Task 3 probe is DEFERRED by explicit user decision, not failed — the authored + applied work is sound; the probe is a deliberately deferred human step tracked above as the outstanding verification gate.
