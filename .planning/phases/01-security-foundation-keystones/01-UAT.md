---
status: complete
phase: 01-security-foundation-keystones
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md, 01-VERIFICATION.md, 01-REVIEW.md]
started: 2026-06-07T22:10:00Z
updated: 2026-06-07T22:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Re-apply notifications.sql (CR-01 fix) to live DB
expected: |
  Paste cabofeira/supabase/notifications.sql (idempotent create-or-replace) in the
  Supabase SQL Editor. Afterward, a normal user can only create a notification for
  themselves; cross-user create_notification() raises 'Not authorized'. This must
  be done BEFORE Test 2 so the FND-02 forgery assertion reflects the fixed function.
result: pass

### 2. Run the direct-API verification probe (all 5 ROADMAP success criteria)
expected: |
  From repo root with SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD
  (and optional TEST2_* for the cross-user notification check) set, and a throwaway
  NORMAL test account existing:
    node .planning/phases/01-security-foundation-keystones/verification-probe.mjs
  Every probe prints PASS and the process exits 0 — proving: role/verified silently
  reset (SEC-01), seller_id/featured/seller_verified/arbitrary-views pinned (SEC-02),
  insert forced to safe defaults + status='active' (SEC-03), increment_product_views
  bumps by exactly 1 (D-20), anon sees only active rows / owner sees own non-active
  (FND-01), create_notification visible only to owner (FND-02), log_admin_action
  rejects non-admins and the audit table cannot be mutated (FND-03), and BOTH demo
  logins (admin@cabofeira.cv/admin123, user@cabofeira.cv/user123) fail (SEC-04).
result: skipped
reason: |
  User opted not to run the direct-API probe now. SQL is applied and the
  enforcement code is verifier-confirmed correct, but the runtime proof is
  deferred to Phase 4 ("Security Hardening — Full Audit + API Verification"),
  the dedicated launch-gate that runs this exact direct-API verification pass.
  UI login cannot substitute (RLS holes are only reachable via direct DB API).

### 3. Complete SEC-04 git-history rewrite + force-push
expected: |
  Demo Auth accounts are already deleted (admin123/user123 authenticate nothing).
  Finish the history scrub: create replacements.txt with admin123==>***REMOVED***
  and user123==>***REMOVED***, run `git filter-repo --replace-text replacements.txt`
  (or BFG), confirm `git log -S admin123 --oneline` and `git log -S user123 --oneline`
  are BOTH empty, then `git push --force origin main`. Re-clone any other working
  copies; never merge a pre-rewrite branch back. (Deferred destructive step — runbook
  in 01-05-SUMMARY.md and STATE.md Deferred Items.)
result: skipped
reason: |
  User deferred the destructive history rewrite. Live risk already neutralized
  (demo Auth accounts deleted — admin123/user123 authenticate nothing). The
  history scrub remains tracked in STATE.md Deferred Items; revisit at the
  Phase 4 launch gate (secrets audit) or whenever convenient.

## Summary

total: 3
passed: 1
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps
