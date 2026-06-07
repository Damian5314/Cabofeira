---
phase: 01-security-foundation-keystones
verified: 2026-06-07T22:30:00Z
status: human_needed
score: 4/5 must-haves verified (SC-5 partially mitigated, probe unrun)
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "Run the direct-API verification probe against the live Supabase DB"
    expected: "Every probe prints PASS and the process exits 0 — confirming all five ROADMAP success criteria hold against the applied DB"
    why_human: "Requires Supabase credentials and a throwaway test account; cannot verify RLS enforcement without a live DB connection. The SQL is applied (user-confirmed 'all the sql ran clean'), but the security boundary is APPLIED-NOT-PROVEN until the probe runs green."
  - test: "Confirm CR-01 fix (notifications.sql re-apply) is live in Supabase"
    expected: "After pasting cabofeira/supabase/notifications.sql in the Supabase SQL Editor, create_notification() with a foreign p_user_id raises 'Not authorized' for a non-admin caller"
    why_human: "The working-tree file carries the fix (commit 5ccd6c4 — self-or-admin gate), but STATE.md records the re-apply as an outstanding ops task. Until the file is re-applied to the live DB, the forgery hole (CR-01) remains open in production."
  - test: "Complete SEC-04 git-history rewrite + force-push"
    expected: "git log -S admin123 --oneline and git log -S user123 --oneline both return nothing after running git-filter-repo (or BFG) with replacements.txt and force-pushing"
    why_human: "Destructive git operation requiring developer action. demo Auth accounts are already deleted (live risk neutralized), but the credential strings still appear in commits 7bf50ac, 3c67242, 6849513, bfac3e5. Cannot be verified without running git-filter-repo/BFG and git push --force."
---

# Phase 01: Security Foundation + Keystones — Verification Report

**Phase Goal:** The three highest-severity pre-launch security holes are closed and the keystone data structures (listing status, notifications, audit log) exist so every later feature composes cheaply instead of retrofitting schema mid-project.
**Verified:** 2026-06-07T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | A normal authenticated account calling supabase-js directly cannot change its own `role` or `verified` (blocked by WITH CHECK + BEFORE UPDATE trigger) | VERIFIED | `guard_profiles_update()` in `security_guards.sql:26-46` pins `new.role := old.role` and `new.verified := old.verified` for non-admins; `schema.sql:132` adds `with check (auth.uid() = id)` to `profiles_update_self`. Both code checks pass. |
| SC-2 | A direct `products` update cannot reassign `seller_id`, flip `featured`, fake `seller_verified`, or alter `views`; a direct insert is forced to `featured=false`, `seller_verified=false`, `views=0` for non-admins | VERIFIED | `guard_products_update()` pins `seller_id`, `featured`, `seller_verified`; views guard uses D-20-safe `if new.views is distinct from old.views + 1` allowlist. `guard_products_insert()` forces all four safe defaults including `status='active'`. `schema.sql:157` adds `with check (auth.uid() = seller_id)` to `products_update_self`. All automated checks pass. |
| SC-3 | The `products.status` enum (active/sold/expired/hidden) exists and only `active` listings appear in public browse and search | VERIFIED | `schema.sql:49-51` adds the column with `not null default 'active' check (status in ('active','sold','expired','hidden'))`. `schema.sql:155` rewrites the SELECT policy to `products_select_active_or_owner_or_admin` with `(status = 'active' or auth.uid() = seller_id or public.is_admin())`. `ProductsContext.jsx:15` exposes `status` in PRODUCT_SELECT; `fromRow` maps `status: r.status`. All automated checks pass. |
| SC-4 | A `notifications` table with RLS + realtime publication + reusable fan-out trigger exists, and an append-only `admin_audit_log` table with `log_admin_action()` RPC exists | VERIFIED | `notifications.sql` contains: table with correct columns and type CHECK, partial unread index, owner-only RLS (SELECT + UPDATE with WITH CHECK, no INSERT policy), `create_notification()` SECURITY DEFINER with `set search_path = public` and CR-01 self-or-admin gate, revoke/grant correct, idempotent realtime publication block. `admin_audit_log.sql` contains: table with `actor_id default auth.uid()`, append-only (admin SELECT only, no mutation policies), `revoke insert, update, delete from anon, authenticated`, `log_admin_action()` SECURITY DEFINER with `if not public.is_admin() raise exception 'Not authorized'` in-body gate, revoke/grant correct. All automated checks pass. |
| SC-5 | No demo admin/user account authenticates against prod Auth and the demo-credential block is scrubbed from `schema.sql` and git history | PARTIAL — human verification required | Working-tree scrub: VERIFIED — `seedUsers.js` deleted, `Login.jsx` demo block removed, both i18n files free of `demoAccounts`/`admin123`. `schema.sql` free of `admin123`/`user123`. Demo Auth accounts deleted (user-confirmed). Git-history rewrite: NOT COMPLETE — `git log -S admin123` returns 8 commits; strings persist in `7bf50ac`, `3c67242`, `6849513`, `bfac3e5` and in the scrub-diff of `65fa5a4`. Deferred per STATE.md. |

**Score:** 4/5 truths code-verified (SC-5 partially mitigated — working-tree + live accounts done, git-history outstanding)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `cabofeira/supabase/security_guards.sql` | Three SECURITY DEFINER guard functions + idempotent triggers | VERIFIED | Contains `guard_profiles_update`, `guard_products_update`, `guard_products_insert`; each has `security definer set search_path = public` and `if public.is_admin() then return new`; D-20-safe views allowlist confirmed. |
| `cabofeira/supabase/schema.sql` | status column, rewritten SELECT policy, WITH CHECK, no demo credentials | VERIFIED | `add column if not exists status`, `products_select_active_or_owner_or_admin`, `with check (auth.uid() = id)` on profiles, `with check (auth.uid() = seller_id)` on products; `admin123`/`user123`/`products_select_all` absent. |
| `cabofeira/supabase/notifications.sql` | Table + owner-only RLS + create_notification() + realtime pub | VERIFIED | All required elements present including the CR-01 authorization gate (`p_user_id <> auth.uid() and not public.is_admin() → raise exception`). Source is post-fix (commit 5ccd6c4). |
| `cabofeira/supabase/admin_audit_log.sql` | Append-only table + admin SELECT only + log_admin_action() | VERIFIED | Append-only design confirmed: `audit_select_admin` for select only, no insert/update/delete policies, `revoke insert, update, delete from anon, authenticated`, `log_admin_action()` with in-function admin gate. |
| `cabofeira/src/context/ProductsContext.jsx` | status in PRODUCT_SELECT and fromRow, no .eq(status) filter | VERIFIED | `status` present in PRODUCT_SELECT literal; `status: r.status` in `fromRow`; no `.eq('status',...)` filter added. |
| `.planning/phases/01-security-foundation-keystones/verification-probe.mjs` | Runnable probe encoding all 5 ROADMAP SCs | VERIFIED (authored, not yet run) | Passes `node --check`; contains `createClient`, `increment_product_views`, `create_notification`, `log_admin_action`, `seller_id`, `status`, `signInWithPassword`. Encodes SEC-01/02/03, D-20, FND-01/02/03, SEC-04 demo-login assertions. Credential-free, exits non-zero on FAIL. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `security_guards.sql` guard functions | `public.is_admin()` | admin-exemption branch | WIRED | `if public.is_admin() then return new; end if;` present in all three guards |
| `schema.sql` products SELECT policy | `products.status` | `status = 'active'` predicate | WIRED | `status = 'active' or auth.uid() = seller_id or public.is_admin()` in policy USING |
| `create_notification()` | `public.notifications` | sole INSERT path (SECURITY DEFINER) | WIRED | `insert into public.notifications` inside function; no user INSERT policy exists |
| `supabase_realtime` publication | `public.notifications` | idempotent `pg_publication_tables` guard | WIRED | `if not exists (...pg_publication_tables...) then alter publication supabase_realtime add table public.notifications` |
| `log_admin_action()` | `public.admin_audit_log` | sole INSERT path (SECURITY DEFINER, admin-gated) | WIRED | `if not public.is_admin() then raise exception 'Not authorized'; end if;` precedes `insert into public.admin_audit_log` |
| `log_admin_action()` body | `public.is_admin()` | in-function admin gate | WIRED | `if not public.is_admin()` present; confirmed by automated check |
| `notifications.sql` CR-01 gate | `auth.uid()` vs `p_user_id` | self-or-admin authorization check | WIRED (source only — re-apply outstanding) | `if p_user_id <> auth.uid() and not public.is_admin() then raise exception 'Not authorized'` in source (commit 5ccd6c4); live DB has NOT yet been re-applied per STATE.md |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `ProductsContext.jsx` PRODUCT_SELECT | `status` | `public.products` column via Supabase query | Yes — `r.status` maps a real DB column | FLOWING |
| `schema.sql` SELECT policy | filtered product rows | `products.status` column value | Yes — RLS policy evaluates real column value | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for SQL/RLS artifacts — all behavioral verification requires a live Supabase connection and is routed to human verification (verification-probe.mjs).

---

## Probe Execution

Step 7c: DEFERRED by explicit user decision (01-04 Task 3). The probe script `verification-probe.mjs` is authored and passes static checks, but has NOT been run against the live DB. This is the outstanding human verification gate.

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| `.planning/phases/01-security-foundation-keystones/verification-probe.mjs` | `node .planning/phases/01-security-foundation-keystones/verification-probe.mjs` | Not yet run | DEFERRED — awaiting human |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FND-01 | 01-01-PLAN.md | `products.status` column exists; only `active` visible publicly | SATISFIED (code-verified, probe pending) | `schema.sql` status column + `products_select_active_or_owner_or_admin` policy verified |
| FND-02 | 01-02-PLAN.md | `notifications` table + RLS + realtime + fan-out trigger | SATISFIED (code-verified, CR-01 re-apply outstanding) | `notifications.sql` fully implemented with self-or-admin gate; live DB re-apply of CR-01 fix outstanding |
| FND-03 | 01-03-PLAN.md | Append-only `admin_audit_log` + `log_admin_action()` RPC | SATISFIED (code-verified, probe pending) | `admin_audit_log.sql` fully implemented |
| SEC-01 | 01-01-PLAN.md | `profiles` self-update cannot change `role` or `verified` | SATISFIED (code-verified, probe pending) | `guard_profiles_update()` + WITH CHECK on `profiles_update_self` |
| SEC-02 | 01-01-PLAN.md | `products` self-update cannot change `seller_id`/`featured`/`seller_verified`/`views` | SATISFIED (code-verified, probe pending) | `guard_products_update()` with D-20-safe views allowlist + WITH CHECK |
| SEC-03 | 01-01-PLAN.md | `products` insert forces `featured=false`/`seller_verified=false`/`views=0` for non-admins | SATISFIED (code-verified, probe pending) | `guard_products_insert()` forces all four safe defaults including `status='active'` |
| SEC-04 | 01-05-PLAN.md | Demo accounts removed from prod; credentials scrubbed from schema.sql and git history | PARTIAL | Working-tree scrub done (65fa5a4); demo Auth accounts deleted (user-confirmed); git-history rewrite DEFERRED — strings still in commits 7bf50ac, 3c67242, 6849513, bfac3e5 |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `cabofeira/supabase/admin_audit_log.sql` | 16 | `default auth.uid()` on `actor_id` column | INFO (WR-04 from code review) | The column default is spoofable if a future migration or mis-scoped grant inserts directly; the documented sole write path `log_admin_action()` already passes `auth.uid()` explicitly, making the default redundant and misleading. Not a runtime risk today — the revoked grants + no insert policy prevent direct inserts. Phase 2/4 concern. |
| `cabofeira/supabase/notifications.sql` | ~92 | No `replica identity full` set | INFO (WR-05 from code review) | UPDATE/DELETE realtime payloads to future subscribers will have incomplete old-row data. Only INSERT is consumed today; INSERT-only subscription should be documented as a contract or `replica identity full` added. |

No `TBD`, `FIXME`, or `XXX` debt markers were found in any Phase 1 modified file.

---

## Human Verification Required

### 1. Run the direct-API verification probe

**Test:** Set environment variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_EMAIL`, `TEST_PASSWORD` (throwaway normal account) and optionally `TEST2_EMAIL`/`TEST2_PASSWORD` (second normal account). From the repo root run: `node .planning/phases/01-security-foundation-keystones/verification-probe.mjs`

**Expected:** Every probe prints PASS and the process exits 0. Specifically:
- SEC-01: after `update profiles set role='admin'`, role is still `'user'`; after `update ... set verified=true`, verified is still `false`
- SEC-02: seller_id cannot be reassigned; `featured`/`seller_verified` stay false; views cannot be set to 9999
- SEC-03: insert with `featured=true, seller_verified=true, views=50, status='hidden'` stores `false/false/0/active`
- D-20: `increment_product_views` bumps views by exactly 1
- FND-01: anon sees only `status='active'` rows; owner sees own non-active row
- FND-02: `create_notification` row is visible to owner; second normal user sees zero rows from another user's notifications; a cross-user `create_notification` call (p_user_id ≠ auth.uid()) raises 'Not authorized'
- FND-03: non-admin `log_admin_action` returns error 'Not authorized'; direct audit-log update/delete is denied
- SEC-04: both demo logins (`admin@cabofeira.cv/admin123`, `user@cabofeira.cv/user123`) fail with non-null error and null session

**Why human:** Requires live Supabase credentials and a throwaway test account. RLS enforcement cannot be verified from source code alone — the security boundary lives in Postgres and must be probed from outside.

---

### 2. Re-apply notifications.sql to fix CR-01 in the live DB

**Test:** Open Supabase Dashboard → SQL Editor. Paste the contents of `cabofeira/supabase/notifications.sql` and run it. Then call `rpc('create_notification', { p_user_id: '<other-user-uuid>', p_type: 'system', p_title: 'test' })` as a non-admin authenticated user and confirm it returns an error containing 'Not authorized'.

**Expected:** The re-apply succeeds without error (file is idempotent via `create or replace`). The cross-user notification call is rejected. The in-function gate `if p_user_id <> auth.uid() and not public.is_admin() then raise exception 'Not authorized'` is now live.

**Why human:** The source file carries the fix (commit 5ccd6c4, 2026-06-07), but STATE.md records the re-apply as an outstanding ops task. Until the file is re-applied, the live DB still has the forgeable `create_notification()` from the original apply (which lacked the CR-01 gate). This is a security-relevant live-DB gap that cannot be verified from git history alone.

---

### 3. Complete SEC-04 git-history rewrite + force-push

**Test:** Run `git log -S admin123 --oneline` and `git log -S user123 --oneline`. Both should return nothing after completing the runbook in `01-05-SUMMARY.md`.

**Expected:** Both `git log -S` searches return empty output. The force-push to `main` succeeds. All other working copies are re-cloned.

**Why human:** Destructive git operation (`git filter-repo` or BFG + `git push --force`). The credential strings `admin123`/`user123` still exist in git history (commits `7bf50ac`, `3c67242`, `6849513`, `bfac3e5`). The live Auth accounts are already deleted (primary risk neutralized), but the SEC-04 ROADMAP success criterion explicitly requires history scrubbing. Full runbook is in `01-05-SUMMARY.md` "DEFERRED" section.

---

## Gaps Summary

No automated gaps block phase readiness. All SQL artifacts are authored, code-correct, and applied to the live DB (user-confirmed). The three human verification items are:

1. **Probe unrun (human gate):** The direct-API verification probe covers all five ROADMAP success criteria but has not been executed. This is the definitive proof that the security boundary holds. The SQL is applied and the source is correct — the probe is the final gate.

2. **CR-01 live-DB re-apply (ops outstanding):** The `create_notification()` forgery fix (CR-01, commit 5ccd6c4) is in the source file but has NOT been re-applied to the live Supabase DB. Until re-applied, any authenticated user can forge a notification to any other user's bell. This is the highest-urgency outstanding item.

3. **SEC-04 git-history rewrite (deferred, explicitly tracked):** Demo credential strings persist in historical commits. The live risk is neutralized (accounts deleted), but the ROADMAP SC-5 git-history clause is unmet. Runbook is documented and tracked in STATE.md Deferred Items.

---

_Verified: 2026-06-07T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
