# Project Research Summary

**Project:** CaboFeira -- Cape Verde classifieds marketplace
**Domain:** Contact-the-seller classifieds / online marketplace (brownfield pre-launch hardening)
**Researched:** 2026-06-07
**Confidence:** HIGH (stack fixed + verified; pitfalls read directly from source SQL; architecture inferred from codebase map)

## Executive Summary

CaboFeira is a brownfield React 19 + Supabase classifieds app that has most of the core features built but is not yet safe or complete enough to launch. The pre-launch milestone has three sequential thrusts -- add missing marketplace features, make every existing feature actually work, then close security holes -- but two of those thrusts have hard ordering constraints that override the user-stated sequence: the role-escalation RLS hole must be patched before any real users arrive, and the two keystone data structures -- the listing status enum and the notifications table -- must land early because five or more later features depend on them. These keystones should be treated as Phase 1 deliverables, not mid-project work.

The security surface is larger than PROJECT.md describes. Research reading the actual SQL surfaced two RLS holes not on the original list: products_update_self (no WITH CHECK) lets a seller reassign a listing to another seller_id, flip featured=true (free paid placement), and fake seller_verified; products_insert_self accepts client-supplied featured, seller_verified, and views on new listings without forcing safe defaults. Both are exploitable via a direct supabase-js call with no UI interaction. Critically, the chosen QA strategy -- manual UI testing -- cannot detect authorization holes, because PostgREST exposes every RLS-guarded table directly. A dedicated direct-API security verification pass (curl/supabase-js as a normal account, attempting each forbidden operation) is the only valid security QA method here.

For the feature thrust, CaboFeira already has all the hard infrastructure (auth, posting, messaging, favorites, search, admin panel, i18n) and is missing a focused, achievable set: listing status + mark-as-sold (keystone 1), in-app notifications (keystone 2), structured report reasons, block user, WhatsApp contact/share buttons (the highest-ROI differentiator for this WhatsApp-first market), verified-seller badge surface, and admin audit log. Seller ratings/reviews are deliberately deferred -- they require sold status and messaging history as an anti-fake gate, making them a v2 feature. The recommended stack adds only four client libraries and leans on Supabase-native capabilities for everything else.

## Key Findings

### Recommended Stack

The core stack is fixed: React 19.1, React Router 7.6, @supabase/supabase-js 2.105, Create React App, vanilla CSS, react-icons, React Context (no TypeScript, no Redux). The governing principle is Supabase-native first, npm dependency second.

**Core additive technologies:**
- **Postgres FTS + pg_trgm** -- replace ilike keyword search with ranked, typo-tolerant full-text search; zero new npm deps, single CREATE EXTENSION
- **pg_cron + pg_net** -- listing expiry cron job and saved-search digest; available on Supabase Free plan
- **Supabase Realtime (postgres_changes)** -- notifications feed reuses the exact pattern already in MessagesContext; no new infrastructure
- **Supabase Edge Functions (Deno)** -- only for outbound HTTP with secrets (transactional email via Resend); all in-DB logic stays in triggers/RPCs
- **react-hook-form 7.77.0 + zod 4.4.3 + @hookform/resolvers** -- form validation that works in browser and Edge Functions; closes client-only validation security gap
- **browser-image-compression 2.0.2** -- client-side resize before Storage upload; avoids Supabase Storage Image Transformations (Pro-plan-only, $5/1000 origin images -- verified)
- **Resend resend@4.4.0 (Edge Function only)** -- Supabase-recommended email; permanent free tier; SendGrid free tier retired May 2025

**What NOT to use:** Any new state library (Redux, Zustand, React Query), TypeScript migration, Algolia/Elasticsearch, Storage Transforms as primary pipeline, SendGrid, CSS framework (Tailwind/MUI), or Realtime Broadcast/Presence.

### Expected Features -- HAS vs MISSING

**Already built (QA only -- confirm they work):**
- Browse / category / detail / search + filter + pagination
- Post / edit / delete own ads with up to 6 images
- Email/password auth + profiles (name, phone, bio, avatar, verified flag)
- Buyer-seller private messaging with realtime delivery + unread badges
- Favorites, free-text report a listing, admin panel (users/ads/reports/pricing)
- Admin-controlled posting prices + featured surcharge, live-synced
- EN + pt-CV i18n with locale detection

**MISSING -- must build for launch (table stakes):**

| Feature | Complexity | Why launch-blocking |
|---------|-----------|----------------------|
| Listing status enum (active/sold/expired/hidden) + Mark as Sold | S | KEYSTONE 1 -- 5+ features depend on it; is-this-available trust killer |
| In-app notifications (new message at minimum) | M | KEYSTONE 2 -- alerts, saved-search hits, price-drop all need one notifications table + existing Realtime pattern |
| Structured report reasons (enum dropdown) | S | Free-text reports are unactionable; cheap fix that makes moderation real |
| Block user | M | Harassment safety floor for any messaging marketplace |
| Verified-seller badge surfaced on cards/detail | S | Flag is stored but not rendered to buyers; zero cost to realize the trust value |
| WhatsApp contact button + share listing | S | Highest-ROI differentiator; Cape Verde commerce runs on WhatsApp |
| Admin audit log | M | Accountability gate before real users -- entirely absent today |
| Anti-spam: per-user post rate limit + CAPTCHA on signup/post | S-M | Block automated abuse from day one |
| Phone reveal gated to authenticated users | M | seller_phone/seller_email in every public row -- bulk PII harvesting risk |

**MISSING -- add after launch validation (v1.x):**
- Saved searches + new-listing alerts (M) -- needs notifications subsystem first
- Listing expiry + renewal (M) -- needs status field + pg_cron; deploy once catalog shows staleness
- Price-drop alerts on favorites (S-M) -- needs notifications + favorites (HAS)
- Transactional emails beyond welcome: new message, report outcome (M)
- Moderation/approval queue for new-user posts (M) -- turn on if spam appears despite rate limits
- Richer seller profiles: aggregate stats, response indicator (S)

**Deliberately deferred to v2+:**
- Seller ratings and reviews (L) -- heavy, abuse-prone; requires sold status + messaging history as proof-of-interaction anti-fake gate; defer until real transaction volume exists
- Online checkout, payments, escrow -- explicitly anti-feature; cash/Vinti4 offline is Cape Verde reality; adds PCI scope
- Native mobile apps -- mobile-responsive PWA web first; native is a future milestone
- End-to-end message encryption -- breaks moderation, low value for meetup-coordination chat

**Cape Verde-specific differentiators (high-ROI, low-cost):**
- WhatsApp contact/share buttons -- WhatsApp is the dominant commerce channel in Cape Verde and across Lusophone Africa
- Genuine pt-CV (Cape Verdean Creole) UX -- a moat global competitors (OLX, FB Marketplace) do not bother with; already partially built
- Island-aware discovery (my island first default sort) -- Cape Verde is an archipelago; cross-island logistics are real friction

**Feature dependency graph (build order follows this):**



### Architecture Approach

The architecture is the existing one, extended -- no rewrite. Every new feature follows the established three-layer shape: per-domain React Context provider (owns state, Supabase queries, realtime subscription, custom hook) talking to RLS-enforced Postgres tables, with SECURITY DEFINER RPCs for any write that needs a controlled RLS bypass, Realtime for live UI updates, and pg_cron for time-based work. The codebase already contains a working example of every pattern the new features need.

**Major components:**
1. **Context provider (per feature domain)** -- owns state cache, Supabase queries, realtime subscription, custom hook. New: NotificationsContext.jsx, SavedSearchesContext.jsx. Admin-only domains extend Admin.jsx rather than spawning global providers.
2. **RLS policy** -- first line of authorization; row-ownership checked via auth.uid(). UPDATE policies must always pair USING with WITH CHECK. Every new table gets policies for all four commands (select/insert/update/delete).
3. **SECURITY DEFINER RPC** -- controlled RLS bypass. Always: set search_path = public, derive identity from auth.uid() internally (never trust passed-in user_id), revoke from public/anon, grant execute to authenticated only. Template: existing mark_conversation_read / delete_my_account.
4. **Postgres trigger** -- derived/denormalized data kept consistent server-side (notification fan-out, rating rollups, last_message_at, insert-time column forcing for featured/seller_verified/views). Never trust the client for derived values.
5. **pg_cron job** -- time-based work with no user trigger (listing expiry, saved-search digest). Enable extension in Dashboard before any cron SQL.
6. **Edge Function (Deno)** -- only when work needs a secret + outbound HTTP (transactional email via Resend). All in-DB logic stays in triggers/RPCs.
7. **Idempotent SQL migration files** -- one file per feature in cabofeira/supabase/, applied manually via Supabase SQL editor.

**Recommended SQL build order:**


### Critical Pitfalls

1. **products_update_self and profiles_update_self have no WITH CHECK** -- any authenticated user can escalate to admin/verified (profiles) or steal/reprice/feature another listing (products) via a direct supabase-js call. The React UI never sends the role field; that makes it invisible to UI-based QA but trivially exploitable at the API layer. Fix: add WITH CHECK to every self-update policy + a BEFORE UPDATE trigger blocking privileged columns (role, verified, seller_id, featured, seller_verified, views) unless is_admin().

2. **products_insert_self accepts client-supplied featured/seller_verified/views** -- a seller can POST featured=true (free paid placement) and seller_verified=true (fake trust badge) via a crafted API call. The UI form never exposes these fields so UI-only QA completely misses it. Fix: BEFORE INSERT trigger forcing featured=false, seller_verified=false, views=0 unless is_admin(); derive seller snapshot from profiles server-side.

3. **Demo admin backdoor (admin@cabofeira.cv / admin123)** -- schema.sql lines 153-169 document creating this account with a trivially guessable password. If applied to production, there is a known-credential admin account live. Fix: verify prod Auth Users, delete/rotate the demo account, scrub the credential block from schema.sql and git history.

4. **UI-based manual QA cannot validate authorization** -- PostgREST exposes every RLS-guarded table at the API layer. The UI not sending a role field is irrelevant; a direct supabase.from(profiles).update({ role: admin }) call is always possible. Security must be verified by attempting each forbidden operation directly via supabase-js/curl as a normal authenticated account, not by clicking through the app.

5. **Realtime channel lifecycle leaks** -- channels in MessagesContext.jsx, Messages.jsx, and PricingContext.jsx are not consistently torn down on unmount or user change. A stale channel keyed to a previous user ID can continue delivering that user events to a new session -- an information leak across account switches. Fix: every supabase.channel(...).subscribe() must have a paired return () => supabase.removeChannel(channel) in the same useEffect.

6. **Storage accepts any file type and size server-side** -- the 5MB cap and image/* check live only in PostAd.jsx. A direct storage.upload call can push SVG/HTML (stored XSS on a public bucket) or a 500MB file. Fix: enforce allowed_mime_types and file_size_limit at the bucket configuration level.

7. **seller_phone/seller_email exposed in every public listing row** -- unauthenticated callers can harvest all seller contact details, enabling off-platform spam/phishing. Fix: remove from the public listing select; reveal only to authenticated users on the detail page.

## Implications for Roadmap

Based on combined research, the recommended phase structure reorders the user-stated sequence (Features then Correctness then Security) to respect hard data dependencies and security urgency. The highest-severity security fixes land first because they are independent of features and cannot wait; the broad security audit gates launch last so it wraps the complete, QA-verified feature set.

### Phase 1: Security Foundation + Keystones

**Rationale:** The role-escalation hole is independently deployable -- patch it before building anything else. The listing status enum and notifications table are keystones that unlock 5+ later features; building them in Phase 1 means every subsequent phase composes cheaply rather than retrofitting schema mid-project.

**Delivers:**
- profiles_update_self WITH CHECK + BEFORE UPDATE trigger blocking role/verified writes for non-admins
- products_update_self WITH CHECK (auth.uid() = seller_id) + BEFORE INSERT trigger forcing featured=false, seller_verified=false, views=0
- products.status enum (active/sold/expired/hidden) + products.expires_at column
- notifications table + RLS + realtime publication + generic fan-out trigger helper
- admin_audit_log table + log_admin_action() RPC (append-only; needed before any admin feature is built)
- Demo account verification and removal from prod Auth + scrub credential block from git history

**Avoids:** Pitfalls 1, 2, 3 (three highest-severity pre-launch holes). Unblocks all feature phases.

**Research flag:** Standard patterns -- existing mark_conversation_read / delete_my_account are the correct definer templates; is_admin() is load-bearing, do not change its definer status. No phase-level research needed.

---

### Phase 2: Missing Table-Stakes Features

**Rationale:** With the keystones in place, all features compose onto existing infrastructure. These are the features whose absence loses user trust at first visit. All are complexity S or M; none introduce new infra beyond Phase 1.

**Delivers:**
- Mark as Sold -- button on MyAds; feed filters to status = active; sold badge on product detail
- Structured report reasons -- report_reason enum; categorized dropdown in modal; admin filter; dedup constraint on (reporter_id, product_id)
- Verified-seller badge surfaced -- render existing verified flag on product cards, detail page, seller profile
- Block user -- blocked_users table + RLS; filter conversations and messages
- In-app notifications new message -- wire to new-message insert trigger; NotificationsContext.jsx + bell icon in Navbar
- WhatsApp contact button + Share listing -- wa.me deep link from seller phone; Web Share API + copy-link
- Anti-spam post rate limit -- SECURITY DEFINER RPC wrapper for addProduct with per-user time-window count
- CAPTCHA on signup and post -- hCaptcha or Cloudflare Turnstile
- Phone reveal gated -- remove seller_phone/seller_email from public listing select; authenticated-only reveal on detail

**Uses:** listing status (Phase 1), notifications table (Phase 1), admin_audit_log (Phase 1), existing messaging/realtime patterns

**Research flag:** Standard patterns. WhatsApp deep link format (wa.me/{number}?text=) is well-documented. No phase-level research needed.

---

### Phase 3: Correctness -- Manual QA + Bug Fixes

**Rationale:** With new features built and keystones in place, a full end-to-end QA pass is meaningful against a stable, complete feature set.

**Delivers:**
- Exercise every feature end-to-end: auth flows, posting/editing/deleting, image upload edge cases, search/filter combos, messaging + realtime, favorites, structured reports, admin actions, i18n coverage
- Product cache staleness fix -- TTL/refetch-on-navigate; detail page always fetches fresh by ID
- Realtime channel lifecycle audit -- confirm every channel has paired removeChannel in same useEffect
- Unread-badge race condition fix in MessagesContext
- View-count RPC debounce -- one increment per session per product client-side
- Swallowed async errors in storage cleanup surfaced and handled
- Null-safety gaps and stale password-recovery flag fixed
- i18n completeness audit -- every new string from Phase 2 confirmed in both en.json and pt-cv.json

**Avoids:** Pitfalls 7, 8, 9 (correctness). Surfaces bugs before the security gate.

**Research flag:** No research needed -- execution against known issues from CONCERNS.md.

---

### Phase 4: Security Hardening -- Full Audit + API Verification

**Rationale:** This is the launch gate. Sequenced last to wrap the complete, QA-verified feature set. Phase 1 already closed the highest-severity holes; this phase covers the remaining surface and the direct-API verification pass that UI QA cannot provide.

**Delivers:**
- Storage hardening -- bucket allowed_mime_types + file_size_limit enforcement; extension whitelist; orphaned-image sweep
- Open redirect fix -- allowlist redirect param in Login.jsx; reject ://, //, backslash
- SECURITY DEFINER function audit -- verify search_path, revoke from public/anon, minimal grants; REVOKE CREATE ON SCHEMA public FROM authenticated/anon
- FORCE RLS audit -- enable FORCE ROW LEVEL SECURITY on critical tables; confirm no accidental select using (true)
- Supabase Database Advisors -- clear all open security + performance findings
- Direct-API security verification pass: normal account cannot set role/verified via raw update; raw insert forced featured=false by trigger; cannot steal listing via seller_id rewrite; SVG/HTML upload rejected; third party cannot read another user conversation; admin tables reject non-admin API calls; demo credentials do not authenticate
- Secrets audit -- .env.local git-ignored; no key/service-role/password in git history

**Avoids:** Pitfalls 4, 5, 6, 11. This phase gates launch.

**Research flag:** Supabase Advisor, FORCE RLS, and storage bucket config are fully documented. No phase research needed.

---

### Phase Ordering Rationale

- **Phase 1 before Phase 2** -- keystones must exist before features can use them; role-escalation fix is urgent and independent
- **Phase 1 before Phase 3** -- QA against a broken security model gives false confidence
- **Phase 2 before Phase 3** -- QA a complete feature set, not a partial one; avoids re-QA-ing features as they land
- **Phase 3 before Phase 4** -- security audit of a stable, QA-verified codebase is more meaningful
- **Phase 4 as launch gate** -- direct-API verification is the only method that validates authorization

### Research Flags

Phases needing deeper research during planning:
- **Phase 1 (notifications fan-out trigger):** The match-new-listing-against-saved-searches pattern needs a design pass to avoid an O(N*M) scan. Design saved_searches table with discrete indexed columns (category_id, island, price_min, price_max) now so a future move to batched pg_cron matching is low-friction.

Phases with standard patterns (skip research-phase):
- **Phase 1 (security SQL):** Existing mark_conversation_read/delete_my_account are correct definer templates. is_admin() definer status is load-bearing.
- **Phase 2 (all features):** WhatsApp deep link, Web Share API, enum columns, block-user RLS, and the notifications Realtime pattern all follow documented patterns.
- **Phase 3 (QA):** Execution against CONCERNS.md known issues.
- **Phase 4 (security audit):** Supabase Advisor, FORCE RLS, and storage bucket config are fully documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Stack fixed; additive libraries verified against live npm 2026-06-07; Supabase-native capabilities verified against current docs |
| Features | MEDIUM-HIGH | Table-stakes patterns HIGH (OLX/Jiji/Marktplaats/FB Marketplace); Cape Verde-specific behavior MEDIUM (inferred from regional statistics, not direct competitor data) |
| Architecture | HIGH | Inferred directly from codebase map (authoritative); RLS/trigger/definer patterns verified against current Supabase docs |
| Pitfalls | HIGH | RLS holes read directly from cabofeira/supabase/*.sql -- concrete and verified; cross-referenced with 2025/2026 Supabase security writeups and CVE-2025-48757 |

**Overall confidence:** HIGH

### Gaps to Address

- **Cape Verde adoption patterns:** No direct data on existing Cape Verde classifieds user behavior. Validate WhatsApp button click-through and island-filter usage in first weeks post-launch.
- **pg_cron on Supabase Free plan:** Documented as available but verify pg_cron, pg_net, pg_trgm are enabled in Dashboard -> Database -> Extensions for this specific project.
- **Email provider setup timing:** Resend requires a verified sender domain with DNS propagation delay. Configure before launch -- blocks all transactional email if skipped. Set as custom SMTP in Supabase Auth settings.
- **Featured listings rendering:** Research could not confirm from the code whether is_featured listings render differently in feed/category UI. Verify during Phase 3 QA.
- **Saved-search alerts scope for v1.x:** Decide before planning v1.x -- in-app only vs email digests (requires Edge Function + Resend). Two significantly different implementation paths.

## Sources

### Primary (HIGH confidence)
- cabofeira/supabase/schema.sql, storage_product_images.sql, messages.sql, reports.sql, delete_account.sql -- read directly; concrete RLS hole findings
- .planning/codebase/CONCERNS.md, ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, INTEGRATIONS.md -- authoritative codebase map
- https://supabase.com/docs/guides/database/postgres/row-level-security -- USING vs WITH CHECK; per-command policy requirement
- https://supabase.com/docs/guides/api/securing-your-api -- definer functions, grant scoping
- https://supabase.com/docs/guides/database/full-text-search -- FTS via tsvector/GIN, .textSearch()
- https://supabase.com/docs/guides/cron -- pg_cron scheduling, cron.job_run_details
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations -- Pro-plan only, $5/1000 origin images
- https://resend.com/docs/send-with-supabase-edge-functions -- Supabase-recommended email provider
- npm live versions 2026-06-07: react-hook-form 7.77.0, zod 4.4.3, browser-image-compression 2.0.2, resend 4.4.0

### Secondary (MEDIUM confidence)
- https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide -- FORCE RLS, definer bypass, mutable search_path
- https://vibeappscanner.com/supabase-row-level-security -- CVE-2025-48757 RLS misconfig class
- https://makerkit.dev/blog/tutorials/supabase-rls-best-practices -- privilege escalation prevention via WITH CHECK + triggers
- https://techtrendske.co.ke/2026/03/11/africa-whatsapp-commerce/ -- WhatsApp as primary commerce channel in Lusophone Africa
- https://www.africa-press.net/cape-verde/all-news/majority-of-cape-verdeans-access-the-internet-via-mobile-phone -- mobile-first market context
- https://www.transfi.com/blog/popular-local-payment-methods-and-solutions-in-cape-verde -- Vinti4/cash-on-meetup offline payment reality
- https://dreamlit.ai/blog/best-sendgrid-alternatives -- SendGrid free tier retired May 27 2025
- Supabase GitHub discussions #19493, #34707 -- no native DB-write rate limiting in PostgREST/RLS

### Tertiary (MEDIUM-LOW confidence)
- https://primocys.com/blog/build-classified-app-like-olx-craigslist/ -- general classifieds feature landscape; no Cape Verde-specific data
- https://www.unit21.ai/trust-safety-dictionary/marketplace-risk + https://datadome.co/solutions/online-marketplaces-classifieds-industry/ -- trust and safety patterns; no Cape Verde-specific data

---
*Research completed: 2026-06-07*
*Ready for roadmap: yes*