# Requirements: CaboFeira

**Defined:** 2026-06-07
**Core Value:** A trustworthy marketplace where a buyer can find a listing and safely contact the seller — and no user can be harmed by a security hole.

> Pre-launch completion milestone with three thrusts: **add missing marketplace features**, **make every feature work (manual QA + fix)**, and **eliminate security holes/backdoors before launch**. v1 feature scope adopted from competitor research MVP (`.planning/research/FEATURES.md`).

## v1 Requirements

### Foundation (keystones — build first, unlock later features)

- [x] **FND-01**: Listings carry a `status` (active / sold / expired / hidden); only `active` listings appear in public browse and search
- [x] **FND-02**: A `notifications` table + RLS + realtime publication + reusable fan-out trigger exist (keystone for all alerts)
- [x] **FND-03**: An append-only `admin_audit_log` table + `log_admin_action()` RPC exist (built before admin features write to it)

### Marketplace Features (missing table-stakes + market-fit)

- [ ] **FEAT-01**: Seller can mark a listing as Sold; sold listings leave the default feed/search and show a "Sold" badge
- [ ] **FEAT-02**: Reporter selects a structured reason (scam / spam / prohibited / already-sold / duplicate / other) when reporting; admin can filter reports by reason
- [ ] **FEAT-03**: Duplicate reports by the same user on the same listing are prevented/deduped
- [ ] **FEAT-04**: A verified-seller badge is shown to buyers on product cards, product detail, and seller profile
- [ ] **FEAT-05**: User can block another user; the blocked user's conversations and messages are hidden
- [ ] **FEAT-06**: Buyer can contact a seller via a WhatsApp button (wa.me deep link prefilled with the listing title)
- [ ] **FEAT-07**: User can share a listing via native share / WhatsApp / copy-link
- [ ] **FEAT-08**: User receives an in-app notification (bell in navbar) when they get a new message

### Anti-Abuse

- [ ] **ABUSE-01**: Per-user ad-posting rate limit enforced server-side (blocks bulk spam posting)
- [ ] **ABUSE-02**: CAPTCHA challenge on signup and on posting an ad

### Admin & Accountability

- [ ] **ADMIN-01**: Admin mutations (delete ad, change role, verify user, change prices) are recorded in the audit log
- [ ] **ADMIN-02**: Admin can view the audit log in the admin panel

### Correctness — every feature works (manual QA + fix)

- [ ] **QA-01**: Every existing feature verified working end-to-end (auth, post/edit/delete, image upload edge cases, search/filter combinations, messaging + realtime, favorites, reports, admin actions, i18n)
- [ ] **QA-02**: Product cache staleness fixed — detail page fetches fresh; sold/edited listings reflect promptly across sessions
- [ ] **QA-03**: Realtime channels torn down on unmount/user-change (no cross-account event leaks)
- [ ] **QA-04**: Unread-message badge race condition fixed
- [ ] **QA-05**: View-count increment debounced (one per session per product)
- [ ] **QA-06**: Swallowed async/storage-cleanup errors surfaced and handled
- [ ] **QA-07**: Null-safety gaps and stale password-recovery flag fixed
- [ ] **QA-08**: Every new user-facing string present in both `en.json` and `pt-cv.json`

### Security Hardening — launch gate

- [x] **SEC-01**: `profiles` self-update cannot change `role` or `verified` (WITH CHECK + BEFORE UPDATE trigger; admin/RPC only)
- [x] **SEC-02**: `products` self-update cannot change `seller_id` / `featured` / `seller_verified` / `views`; listings cannot be stolen
- [x] **SEC-03**: `products` insert forces `featured=false`, `seller_verified=false`, `views=0` for non-admins (no mass-assignment)
- [~] **SEC-04**: Demo admin/user accounts removed from prod; demo credentials scrubbed from `schema.sql` and git history — PARTIAL: demo Auth accounts deleted (admin123/user123 authenticate nothing) + working-tree/`schema.sql` scrubbed; git-history rewrite + force-push DEFERRED (tracked in STATE.md Deferred Items). NOT fully complete until `git log -S admin123`/`-S user123` are empty.
- [ ] **SEC-05**: Storage bucket enforces allowed MIME types + file-size limit server-side (not client-only)
- [ ] **SEC-06**: Open-redirect in `Login.jsx` fixed — `redirect` param allowlisted to internal paths
- [ ] **SEC-07**: SECURITY DEFINER functions audited (pinned `search_path`, minimal grants, revoked from anon/public); FORCE RLS where appropriate
- [ ] **SEC-08**: Supabase Database Advisors security findings cleared
- [ ] **SEC-09**: Direct-API security verification pass — a normal authenticated account, calling supabase-js/curl directly, cannot: change role/verified, mass-assign featured/verified, steal a listing, read others' conversations, write admin tables, log in with demo credentials, or upload a non-image/oversized file
- [ ] **SEC-10**: Secrets audit — `.env.local` git-ignored; no anon/service-role keys or passwords in git history

## v2 Requirements

Deferred to after launch validation. Tracked, not in this roadmap.

### Re-engagement & Lifecycle

- **SAVE-01**: Saved searches + new-listing alerts (needs notifications subsystem)
- **LIFE-01**: Listing expiry + renewal (needs `status` + `pg_cron` scheduled job)
- **ALERT-01**: Price-drop alerts on favorited listings
- **EMAIL-01**: Transactional emails beyond welcome (new message, report outcome) via Resend Edge Function

### Moderation & Profiles

- **MOD-01**: Optional pre-publish moderation/approval queue for new-user posts
- **PROF-01**: Richer seller profiles (aggregate listing count, response indicator)

## Out of Scope

Explicitly excluded for this milestone, documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Seller ratings & reviews | High value but heavy and abuse-prone; needs sold-status + messaging maturity as anti-fake gate — defer to v2+ |
| Online checkout / cart / card payments | App is contact-the-seller classifieds; Cape Verde deals settle cash/Vinti4 offline; adds PCI scope with near-zero local demand |
| Escrow / buyer-protection / payment holds | Requires money-services licensing and dispute arbitration — out of scope for a small launch |
| Integrated shipping / delivery booking | No inter-island courier API; huge ops burden; arrange offline instead |
| Native mobile apps | Web-first / mobile-responsive now; native is a future milestone |
| End-to-end message encryption | Breaks moderation; low value for meetup-coordination chat |
| Public comments / auctions / algorithmic feed | Spam/abuse magnets or wrong product category for classifieds |
| AI content-moderation pipeline | Over-engineered for current catalog size; rate limits + structured reports suffice |
| Automated test suite (Jest/Playwright) | User chose manual QA + fix for this milestone; revisit post-launch |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| FND-02 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| FND-03 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| SEC-01 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| SEC-02 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| SEC-03 | Phase 1 | Applied; probe-verification deferred (01-04 Task 3) |
| SEC-04 | Phase 1 | Mitigated-with-caveat — demo accounts deleted + working-tree scrubbed (01-05); git-history rewrite DEFERRED/outstanding |
| FEAT-01 | Phase 2 | Pending |
| FEAT-02 | Phase 2 | Pending |
| FEAT-03 | Phase 2 | Pending |
| FEAT-04 | Phase 2 | Pending |
| FEAT-05 | Phase 2 | Pending |
| FEAT-06 | Phase 2 | Pending |
| FEAT-07 | Phase 2 | Pending |
| FEAT-08 | Phase 2 | Pending |
| ABUSE-01 | Phase 2 | Pending |
| ABUSE-02 | Phase 2 | Pending |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| QA-01 | Phase 3 | Pending |
| QA-02 | Phase 3 | Pending |
| QA-03 | Phase 3 | Pending |
| QA-04 | Phase 3 | Pending |
| QA-05 | Phase 3 | Pending |
| QA-06 | Phase 3 | Pending |
| QA-07 | Phase 3 | Pending |
| QA-08 | Phase 3 | Pending |
| SEC-05 | Phase 4 | Pending |
| SEC-06 | Phase 4 | Pending |
| SEC-07 | Phase 4 | Pending |
| SEC-08 | Phase 4 | Pending |
| SEC-09 | Phase 4 | Pending |
| SEC-10 | Phase 4 | Pending |

**Coverage:**

- v1 requirements: 31 total
- Mapped to phases: 31 ✓
- Unmapped: 0 ✓

**Note:** The SEC category is intentionally split across two phases — the three highest-severity, independently-deployable RLS holes (SEC-01/02/03) plus the demo-account removal (SEC-04) land in Phase 1 (urgent + keystone-blocking), while the broader audit and the launch-gating direct-API verification pass (SEC-05 → SEC-10) close the milestone in Phase 4. ADMIN-01/02 sit in Phase 2 because the audit-log table they write to (FND-03) is built in Phase 1.

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after 01-05 — demo Auth accounts deleted + working-tree demo-credential scrub committed (65fa5a4). SEC-04 mitigated-with-caveat: git-history rewrite + force-push DEFERRED (tracked in STATE.md Deferred Items) — not fully complete. Direct-API probe-verification (01-04 Task 3) still deferred to /gsd-verify-work.*
