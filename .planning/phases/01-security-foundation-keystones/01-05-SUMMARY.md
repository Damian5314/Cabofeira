---
phase: 01-security-foundation-keystones
plan: 05
subsystem: security
tags: [auth, demo-credentials, secrets, git-history, supabase-auth]
provides:
  - "Demo Auth accounts (admin@cabofeira.cv, user@cabofeira.cv) deleted from prod Supabase Auth — admin123/user123 authenticate nothing"
  - "Demo-credential strings scrubbed from the working tree (seedUsers.js deleted, Login.jsx demo block removed, i18n demoAccounts key + Demo parentheticals removed)"
  - "Documented, ready-to-run runbook for the deferred git-history rewrite"
affects: [Phase 4 Security Hardening, SEC-10 secrets audit]
tech-stack:
  added: []
  patterns: ["secret neutralization first (delete live accounts) before history scrub"]
key-files:
  created: []
  modified:
    - cabofeira/src/pages/Login.jsx
    - cabofeira/src/i18n/en.json
    - cabofeira/src/i18n/pt-cv.json
key-decisions:
  - "Live risk neutralized by deleting the demo Auth accounts; git-history rewrite + force-push DEFERRED by explicit user decision (belt-and-suspenders, not live risk)"
  - "SEC-04 is SUBSTANTIALLY mitigated but NOT fully complete — the history-scrub sub-requirement remains outstanding"
duration: ~10min
completed: 2026-06-07
---

# Phase 01 Plan 05: SEC-04 Demo-Credential Scrub + Auth-Account Deletion Summary

**Demo Auth accounts deleted (admin123/user123 now authenticate nothing) and demo-credential strings scrubbed from the working tree; the destructive git-history rewrite + force-push is deliberately DEFERRED and tracked as outstanding.**

## Performance
- **Duration:** ~10 min (continuation: tracking + summary only)
- **Tasks:** 1 of 2 fully complete; Task 2 split — 2(a) complete, 2(b) deferred
- **Files modified:** 4 (Task 1, committed `65fa5a4`)

## Accomplishments
- **Task 1 (auto) — working-tree scrub — COMPLETE** (commit `65fa5a4`):
  - Deleted dead `cabofeira/src/data/seedUsers.js` (carried `admin123`/`user123`, confirmed no importer).
  - Removed the commented-out demo-login block from `cabofeira/src/pages/Login.jsx`.
  - Removed the `auth.demoAccounts` i18n key and the "Demo" parenthetical from `featuredHint` in BOTH `en.json` and `pt-cv.json` — bilingual parity preserved, both files valid JSON.
  - Working tree contains no `admin123`/`user123`/`demoAccounts`; build compiles.
- **Task 2(a) — delete demo Auth accounts — COMPLETE** (user-confirmed):
  - `admin@cabofeira.cv` and `user@cabofeira.cv` deleted from Supabase Auth.
  - This is the PRIMARY security win for SEC-04: the demo credentials `admin123`/`user123` now authenticate nothing. The live spoofing risk (T-05-01) is neutralized.

## Task Commits
1. **Task 1: Scrub demo credentials from the working tree** — `65fa5a4`
2. **Task 2(a): Delete demo Auth accounts** — no commit (live-system action in Supabase Dashboard; user-confirmed)
3. **Task 2(b): Rewrite git history + force-push** — DEFERRED (see below)

## Files Created/Modified
- `cabofeira/src/data/seedUsers.js` — DELETED (dead code carrying demo credentials)
- `cabofeira/src/pages/Login.jsx` — removed commented-out demo-login block
- `cabofeira/src/i18n/en.json` — removed `auth.demoAccounts` key + "Demo" parenthetical
- `cabofeira/src/i18n/pt-cv.json` — removed matching `auth.demoAccounts` key + "Demo" parenthetical

## Decisions & Deviations

### DEFERRED: Task 2(b) — git-history rewrite + force-push (OUTSTANDING)
By explicit user decision, the destructive git-history rewrite was NOT performed. The plan itself labels this belt-and-suspenders: the live risk is already neutralized by deleting the accounts (Task 2a), so the residual exposure is only that the dead strings remain readable in old commits.

**The demo-credential strings `admin123`/`user123` still exist in git history** in commits `7bf50ac`, `3c67242`, `6849513`, `bfac3e5` (plus they appear as removed lines in the scrub commit `65fa5a4` diff). `git log -S admin123` and `git log -S user123` are NOT empty.

**Deferred runbook (run to finish SEC-04 fully):**
1. Confirm a real (non-demo) admin account exists in `public.profiles` with `role='admin'` (already true — demo accounts already deleted).
2. Create `replacements.txt` with two lines:
   ```
   admin123==>***REMOVED***
   user123==>***REMOVED***
   ```
3. Run ONE of:
   - `git filter-repo --replace-text replacements.txt` (requires `pip install git-filter-repo` first — not currently installed), OR
   - `java -jar bfg.jar --replace-text replacements.txt .git` then `git reflog expire --expire=now --all && git gc --prune=now --aggressive` (Java 1.8 is installed; download `bfg.jar`).
4. Verify the scrub: `git log -S admin123 --oneline` AND `git log -S user123 --oneline` BOTH return nothing.
5. `git push --force origin main`.
6. Re-clone any other working copies; NEVER merge a pre-rewrite branch back (it would reintroduce the tainted history — threat T-05-04).

**SEC-04 status:** SUBSTANTIALLY MITIGATED (live accounts dead — the demo credentials authenticate nothing) but NOT fully complete (the git-history-scrub sub-requirement remains outstanding). SEC-04 must NOT be marked fully complete until the runbook above is executed and both `git log -S` searches are empty.

## Next Phase Readiness
- The live spoofing hole is closed; the demo credentials are dead.
- The outstanding history-scrub is durably recorded in STATE.md Deferred Items and flagged in ROADMAP.md / REQUIREMENTS.md.
- Phase 1's other outstanding gate (01-04 Task 3 direct-API probe via `/gsd-verify-work`) is unchanged and still pending; the SEC-04 demo-login assertion in that probe now passes (accounts deleted).

## Self-Check: PASSED
- Task 1 working-tree scrub verified: `seedUsers.js` deleted, `Login.jsx` + both i18n files free of demo strings (commit `65fa5a4` confirmed in `git log`).
- Task 2(a) account deletion confirmed by user (live-system action, no repo artifact expected).
- Task 2(b) git-history rewrite is a DELIBERATELY DEFERRED destructive step, not a failure — the residual strings in history are expected and documented above with a complete runbook.
- No FAILED status: the completed work (scrub + account deletion) is verified; the only incomplete item is the intentionally-deferred history rewrite.
