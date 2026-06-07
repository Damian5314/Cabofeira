---
phase: 01-security-foundation-keystones
audited: 2026-06-08
auditor: gsd-security-auditor
asvs_level: default
block_on: high
threats_total: 26
threats_closed: 24
threats_open: 0
threats_partial: 2
status: secured_with_deferrals
---

# Phase 01: Security Audit — Security Foundation Keystones

Verification of every declared threat mitigation against implemented code. Implementation files were read-only; no implementation was modified. Each threat resolved to CLOSED (mitigation present in code or accepted-risk documented), PARTIAL (code mitigation present but a planned sub-step deferred), or OPEN.

## Verdict

No OPEN threats. All declared code-level mitigations are present and verified by grep/line evidence. Two threats are **PARTIAL** by explicit, documented user deferral — neither leaves a live exploitable hole, but each carries an outstanding sub-requirement that must not be marked complete until executed. Under `block_on: high`, neither PARTIAL item is a launch blocker for *this* phase boundary, but both are tracked as outstanding gates (one is the Phase-4 runtime-proof gate; one is the SEC-04 git-history scrub).

## Threat Verification (Plans 01-03 — code mitigations)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-01-01 | Elevation of Privilege | mitigate | CLOSED | `security_guards.sql:37-38` pins `new.role := old.role` / `new.verified := old.verified` for non-admins; `schema.sql:132` `with check (auth.uid() = id)` on `profiles_update_self` |
| T-01-02 | Tampering (listing theft) | mitigate | CLOSED | `security_guards.sql:62` pins `new.seller_id := old.seller_id`; `schema.sql:157` `with check (auth.uid() = seller_id)`. Admin exemption (`security_guards.sql:58`) is the documented accepted residual deferred to Phase 4 SEC-09 |
| T-01-03 | Tampering (insert mass-assign) | mitigate | CLOSED | `security_guards.sql:96-99` forces `featured:=false`, `seller_verified:=false`, `views:=0`, `status:='active'` for non-admins |
| T-01-04 | Tampering (arbitrary views) | mitigate | CLOSED | `security_guards.sql:69-71` allows only `old.views + 1` (`is distinct from old.views + 1` → pinned back); D-20-safe so `increment_product_views()` survives |
| T-01-05 | Information Disclosure | mitigate | CLOSED | `schema.sql:155` `products_select_active_or_owner_or_admin` USING `(status = 'active' or auth.uid() = seller_id or public.is_admin())`; legacy `products_select_all` removed via `pg_policies` catch-all loop (`schema.sql:140-147`) — literal absent |
| T-01-06 | Elevation of Privilege (search_path) | mitigate | CLOSED | `security_guards.sql:30,55,88` each guard `set search_path = public`; underlying `is_admin()`/`increment_product_views()` also pinned (`schema.sql:102,114`) |
| T-01-SC | Tampering (installs) | accept | CLOSED | No package installs in plan 01 (SQL + JS edit only); documented accepted |
| T-02-01 | Information Disclosure | mitigate | CLOSED | `notifications.sql:32-34` `notifications_select_own` USING `auth.uid() = user_id`; RLS-filtered realtime via guarded `pg_publication_tables` block (`notifications.sql:96-106`) |
| T-02-02 | Spoofing/Tampering (forge) | mitigate | CLOSED | No INSERT policy; sole path `create_notification()` SECURITY DEFINER. **CR-01 forgery hole FIXED**: in-function gate `if p_user_id <> auth.uid() and not public.is_admin() then raise exception` (`notifications.sql:76-78`), committed `5ccd6c4` |
| T-02-03 | Tampering (mark-read cross-user) | mitigate | CLOSED | `notifications.sql:38-39` `notifications_update_own` `with check (auth.uid() = user_id)` |
| T-02-04 | Elevation of Privilege (search_path) | mitigate | CLOSED | `notifications.sql:65` `set search_path = public`; `notifications.sql:88` execute revoked from public/anon |
| T-02-SC | Tampering (installs) | accept | CLOSED | SQL-only plan; documented accepted |
| T-03-01 | Repudiation/Tampering (alter/delete audit) | mitigate | CLOSED | `admin_audit_log.sql` has NO insert/update/delete policy + `admin_audit_log.sql:43` `revoke insert, update, delete ... from anon, authenticated` |
| T-03-02 | Elevation of Privilege (non-admin write) | mitigate | CLOSED | `admin_audit_log.sql:66` `if not public.is_admin() then raise exception 'Not authorized'` in-function gate |
| T-03-03 | Information Disclosure (non-admin read) | mitigate | CLOSED | `admin_audit_log.sql:37-39` `audit_select_admin` USING `(public.is_admin())`; default-deny otherwise |
| T-03-04 | Elevation of Privilege (search_path) | mitigate | CLOSED | `admin_audit_log.sql:61` `set search_path = public`; `admin_audit_log.sql:78` execute revoked from public/anon |
| T-03-SC | Tampering (installs) | accept | CLOSED | SQL-only plan; documented accepted |

## Threat Verification (Plan 04 — runtime proof)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-04-01 | EoP/Tampering/Info-Disclosure | mitigate | **PARTIAL** | All underlying guards/policies verified present in code (T-01-*, T-02-*, T-03-*). The declared mitigation was the direct-API probe pass — `verification-probe.mjs` is authored (`b831c9b`) but **NOT RUN** (deferred to Phase 4 per user). Boundary is APPLIED to live DB (user-confirmed) but UNPROVEN at runtime. |
| T-04-02 | Tampering (SQL wrong-order) | mitigate | CLOSED | Ordered manual-apply checkpoint; user confirmed all four files applied clean (01-04-SUMMARY) |
| T-04-03 | Repudiation (audit mutable after apply) | mitigate | **PARTIAL** | Code-level immutability verified present (T-03-01: no mutation policy + revoked grants). Runtime denial proof was the FND-03 probe — same deferred probe, not run. |
| T-04-SC | Tampering (installs) | accept | CLOSED | Uses already-present `@supabase/supabase-js`; documented accepted |

## Threat Verification (Plan 05 — SEC-04 demo credentials)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-05-01 | Spoofing (demo login) | mitigate | CLOSED | Demo Auth accounts `admin@cabofeira.cv` / `user@cabofeira.cv` deleted from prod Auth (user-confirmed, 01-05-SUMMARY) — `admin123`/`user123` authenticate nothing. Working-tree strings scrubbed: `seedUsers.js` deleted, `Login.jsx` + both i18n files clean (grep over `cabofeira/src` for `admin123|user123|demoAccounts` → no matches) |
| T-05-02 | Information Disclosure (passwords in git history) | mitigate | **PARTIAL / NOT DONE** | History rewrite + force-push **NOT performed**. Verified live: `git log -S admin123 --oneline` and `git log -S user123 --oneline` BOTH still return commits (`7bf50ac`, `3c67242`, `6849513`, `bfac3e5`, and the scrub diff `65fa5a4`). The declared mitigation does not exist in the artifact (git history). Live risk neutralized by T-05-01, but the history-scrub sub-requirement is outstanding. |
| T-05-03 | Elevation of Privilege (lose only admin) | mitigate | CLOSED | Runbook step 1 requires confirming a real admin exists first; user confirmed accounts deleted without lockout (01-05-SUMMARY) |
| T-05-04 | Tampering (tainted re-merge) | accept | CLOSED | Small/solo repo; documented accepted with re-clone/no-merge guidance |
| T-05-SC | Tampering (git-filter-repo install) | mitigate | CLOSED | Official GitHub-documented tool; BFG fallback needs no install (Package Legitimacy Audit — Approved) |

## Open Threats

None.

## Partial / Outstanding Verification Gates

These are NOT open code holes, but declared mitigations whose final sub-step was deferred. Classified honestly per the deferral context:

1. **T-04-01 / T-04-03 — runtime proof DEFERRED (code mitigation EXISTS).**
   The underlying RLS policies, BEFORE-trigger guards, append-only audit design, and SECURITY-DEFINER gates are all verified present in the SQL files and applied to the live DB. What is missing is the declared *runtime proof* — `verification-probe.mjs` has not been run. This is a "mitigation exists in code but lacks its planned runtime proof" gate, deliberately deferred to the Phase-4 "Full Audit + API Verification" launch gate. Action: run `verification-probe.mjs` (env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TEST_EMAIL`, `TEST_PASSWORD`, optional `TEST2_*`) before launch.

2. **T-05-02 — git-history scrub NOT PERFORMED (mitigation absent in artifact).**
   This is distinct from #1: the declared mitigation (history rewrite + force-push so `git log -S` is empty) was *not done at all*. I verified directly that the strings remain in history. The live spoofing risk is neutralized (T-05-01 CLOSED — accounts deleted), so this is residual exposure of dead credential strings, not a live auth bypass. Action: execute the documented runbook (`git filter-repo --replace-text replacements.txt` or BFG), confirm both `git log -S` searches empty, then `git push --force`. SEC-04 must not be marked fully complete until then.

## Unregistered Flags

None. Every `## Threat Flags` section across 01-01 through 01-05 SUMMARYs reported "None — no new security surface beyond the threat model." No new attack surface appeared during implementation without a mapped threat ID.

## Notable In-Scope Finding (resolved before this audit)

- **CR-01** (code review): `create_notification()` originally inserted attacker-controlled `p_user_id` with no authorization check — a forgery/phishing channel that contradicted the table's owner-only model. **This is FIXED in the audited code** (`notifications.sql:76-78`, commit `5ccd6c4`) with a self-or-admin gate. Verified present. No escalation needed.

## Accepted Risks Log

| Risk | Disposition | Rationale |
|------|-------------|-----------|
| Admin can change `seller_id`/`featured`/`seller_verified` via guard admin-exemption (T-01-02 residual) | accept | Admin-account compromise deferred to Phase 4 SEC-09; documented in plan |
| No package installs audit table (T-01-SC, T-02-SC, T-03-SC, T-04-SC) | accept | SQL/JS-only plans; no new dependencies |
| Tainted pre-rewrite branch re-merge (T-05-04) | accept | Small/solo repo; re-clone guidance documented |

## Out-of-Scope Observations (NOT phase-1 threats — for Phase-4 register)

The code review (01-REVIEW.md) raised WR-01 (world-readable `profiles` exposes email/phone to anon) and IN-01 (`increment_product_views` implicit PUBLIC execute). These are not part of the phase-1 threat register and are not blockers for this phase, but WR-01 in particular is a PII-disclosure concern that should be entered into the Phase-4 security register. Flagged for awareness only; no action taken here.

---
*Audited: 2026-06-08 — gsd-security-auditor. Implementation files read-only; only SECURITY.md written.*
