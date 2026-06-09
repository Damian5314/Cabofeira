# Roadmap: CaboFeira

## Overview

CaboFeira is a brownfield React 19 + Supabase classifieds marketplace with most core features built but not yet safe or complete enough to launch. This pre-launch milestone closes the gap in four phases that respect hard data dependencies and security urgency: first lay the secure foundation (patch the role/listing-theft RLS holes and build the keystone data structures every later feature depends on), then build the missing table-stakes marketplace features onto those keystones, then run a full manual QA pass against the now-complete feature set, and finally gate launch with a full security audit and a direct-API verification pass that UI testing cannot provide. The journey ends with a marketplace where browse → find → message works for every feature and no user can be harmed by a security hole.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security Foundation + Keystones** - Patch the highest-severity RLS holes and build the listing-status, notifications, and audit-log keystones that unlock every later feature (completed 2026-06-08)
- [ ] **Phase 2: Missing Table-Stakes Features** - Build mark-as-sold, structured reports, verified badge, block user, WhatsApp/share, message notifications, and anti-spam onto the Phase 1 keystones
- [ ] **Phase 3: Correctness — Manual QA + Bug Fixes** - Exercise every feature end-to-end and fix the known codebase bugs (cache staleness, realtime leaks, badge race, i18n gaps)
- [ ] **Phase 4: Security Hardening — Full Audit + API Verification** - Launch gate: storage/redirect/definer/FORCE-RLS audit, Supabase Advisors, secrets audit, and the direct-API authorization verification pass

## Phase Details

### Phase 1: Security Foundation + Keystones

**Goal**: The three highest-severity pre-launch security holes are closed and the keystone data structures (listing status, notifications, audit log) exist so every later feature composes cheaply instead of retrofitting schema mid-project.
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):

  1. A normal authenticated account calling supabase-js directly cannot change its own `role` or `verified` (blocked by WITH CHECK + BEFORE UPDATE trigger)
  2. A direct `products` update cannot reassign `seller_id`, flip `featured`, fake `seller_verified`, or alter `views`; a direct insert is forced to `featured=false`, `seller_verified=false`, `views=0` for non-admins
  3. The `products.status` enum (active/sold/expired/hidden) exists and only `active` listings appear in public browse and search
  4. A `notifications` table with RLS + realtime publication + reusable fan-out trigger exists, and an append-only `admin_audit_log` table with `log_admin_action()` RPC exists
  5. No demo admin/user account authenticates against prod Auth and the demo-credential block is scrubbed from `schema.sql` and git history

**Plans**: 5 plans in 2 waves
Plans:

- [x] 01-01-PLAN.md — RLS guard triggers (SEC-01/02/03) + products.status column + SELECT policy rewrite (FND-01)
- [x] 01-02-PLAN.md — notifications keystone: table + owner-only RLS + create_notification() + realtime (FND-02)
- [x] 01-03-PLAN.md — admin_audit_log keystone: append-only table + log_admin_action() RPC (FND-03)
- [x] 01-04-PLAN.md — [BLOCKING] manual-apply SQL in Supabase (applied clean) + probe authored. NOTE: direct-API probe run DEFERRED to /gsd-verify-work — boundary applied but not yet probe-verified.
- [~] 01-05-PLAN.md — SEC-04: working-tree scrub DONE (65fa5a4) + demo Auth accounts DELETED (admin123/user123 authenticate nothing). Git-history rewrite + force-push DEFERRED (tracked in STATE.md Deferred Items). SEC-04 substantially mitigated, NOT fully complete.

### Phase 2: Missing Table-Stakes Features

**Goal**: With the keystones in place, the marketplace features whose absence loses user trust at first visit are built and wired into the existing UI and infrastructure.
**Depends on**: Phase 1
**Requirements**: FEAT-01, FEAT-02, FEAT-03, FEAT-04, FEAT-05, FEAT-06, FEAT-07, FEAT-08, ABUSE-01, ABUSE-02, ADMIN-01, ADMIN-02
**Success Criteria** (what must be TRUE):

  1. A seller can mark a listing as Sold; it leaves the default feed/search and shows a "Sold" badge, and a verified-seller badge renders on cards, detail, and seller profile
  2. A reporter picks a structured reason (scam/spam/prohibited/already-sold/duplicate/other), duplicate reports on the same listing are deduped, and an admin can filter reports by reason
  3. A buyer can contact a seller via a prefilled WhatsApp (wa.me) button and share a listing via native share / WhatsApp / copy-link; a user can block another user and the blocked user's conversations/messages disappear
  4. A user receives an in-app bell notification when they get a new message
  5. Bulk posting is blocked by a server-side per-user rate limit and CAPTCHA on signup/post, and every admin mutation (delete ad, change role, verify, change prices) is recorded in and viewable from the audit log

**Plans**: 8 plans in 8 wavesPlans:
**Wave 1**

- [x] 02-01-PLAN.md — Author all 6 Phase-2 SQL files + verify-turnstile Edge Function (no DB apply)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — [BLOCKING] human gate: apply SQL in order, provision Turnstile, deploy Edge Function, install widget

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 02-03-PLAN.md — Mark-as-sold + active-only feed/search + sold/verified card badges (FEAT-01, FEAT-04)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-04-PLAN.md — ProductDetail WhatsApp/share/structured-report + Profile verified badge (FEAT-02/03/04/06/07)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-05-PLAN.md — Block user: messaging refresh, browse filter, block/unblock UI (FEAT-05)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 02-06-PLAN.md — Notifications bell: NotificationsContext + navbar dropdown (FEAT-08)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 02-07-PLAN.md — Anti-spam: Turnstile signup+post CAPTCHA + rate-limit surfacing (ABUSE-01/02)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 02-08-PLAN.md — Admin audit writes + audit-log viewer tab + reports reason filter (ADMIN-01/02, FEAT-02)

**UI hint**: yes

### Phase 3: Correctness — Manual QA + Bug Fixes

**Goal**: Every existing and newly built feature is verified working end-to-end and the known codebase bugs are fixed, against a stable and complete feature set.
**Depends on**: Phase 2
**Requirements**: QA-01, QA-02, QA-03, QA-04, QA-05, QA-06, QA-07, QA-08
**Success Criteria** (what must be TRUE):

  1. Every feature is exercised end-to-end (auth, post/edit/delete, image-upload edge cases, search/filter combinations, messaging + realtime, favorites, structured reports, admin actions) with bugs found and fixed
  2. Product detail always fetches fresh by ID and sold/edited listings reflect promptly across sessions (cache staleness fixed)
  3. Realtime channels are torn down on unmount/user-change with no cross-account event leaks, and the unread-message badge race is fixed
  4. View-count increment is debounced to one per session per product, swallowed async/storage-cleanup errors are surfaced, and null-safety + stale password-recovery flag are fixed
  5. Every new user-facing string is present in both `en.json` and `pt-cv.json`

**Plans**: TBD
**UI hint**: yes

### Phase 4: Security Hardening — Full Audit + API Verification

**Goal**: The launch gate — the remaining security surface is hardened and a direct-API verification pass confirms a normal account cannot perform any forbidden authorization operation.
**Depends on**: Phase 3
**Requirements**: SEC-05, SEC-06, SEC-07, SEC-08, SEC-09, SEC-10
**Success Criteria** (what must be TRUE):

  1. The Storage bucket rejects non-image MIME types and oversized files server-side (a direct SVG/HTML or oversized upload fails), and the `Login.jsx` redirect param is allowlisted to internal paths (`://`, `//`, backslash rejected)
  2. All SECURITY DEFINER functions have pinned `search_path`, minimal grants, and are revoked from anon/public; FORCE RLS is enabled on critical tables with no accidental `using (true)`
  3. All Supabase Database Advisors security findings are cleared
  4. The direct-API verification pass confirms a normal authenticated account cannot: change role/verified, mass-assign featured/verified, steal a listing via seller_id rewrite, read others' conversations, write admin tables, log in with demo credentials, or upload a non-image/oversized file
  5. The secrets audit confirms `.env.local` is git-ignored and no anon/service-role key or password exists in git history

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Foundation + Keystones | 5/5 | Complete    | 2026-06-08 |
| 2. Missing Table-Stakes Features | 1/8 | In Progress|  |
| 3. Correctness — Manual QA + Bug Fixes | 0/TBD | Not started | - |
| 4. Security Hardening — Full Audit + API Verification | 0/TBD | Not started | - |
