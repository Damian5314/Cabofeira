# Phase 2: Missing Table-Stakes Features - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

With the Phase 1 keystones in place (`products.status`, `notifications` table +
`create_notification()`, `admin_audit_log` + `log_admin_action()`), build the
twelve trust-and-completeness features whose absence loses user trust at first
visit and wire them into the existing Context-based UI and Supabase backend.

**In scope (12 requirements):**
- **FEAT-01** — Mark-as-sold: seller flips a listing to `sold`; it leaves the default feed/search and shows a "Sold" badge
- **FEAT-02** — Structured report reasons (scam/spam/prohibited/already-sold/duplicate/other) + admin filter by reason
- **FEAT-03** — Duplicate reports by the same user on the same listing are deduped
- **FEAT-04** — Verified-seller badge shown on product cards, product detail, and seller profile
- **FEAT-05** — Block another user; blocked user's conversations/messages hidden
- **FEAT-06** — WhatsApp "contact seller" button (wa.me deep link prefilled)
- **FEAT-07** — Share a listing via native share / WhatsApp / copy-link
- **FEAT-08** — In-app bell notification on new message
- **ABUSE-01** — Server-side per-user ad-posting rate limit
- **ABUSE-02** — CAPTCHA on signup AND on posting
- **ADMIN-01** — Admin mutations (delete ad, change role, verify, change prices) recorded in the audit log
- **ADMIN-02** — Admin can view the audit log in the admin panel

**Out of scope (later phases / v2):** listing expiry+renewal, saved searches/alerts,
price-drop alerts, seller ratings/reviews, moderation/approval queue, transactional
emails beyond welcome, richer seller profiles, phone masking. Manual QA of all
features and the known-bug fixes are Phase 3; the broad security audit + direct-API
verification pass is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Anti-Spam — CAPTCHA (ABUSE-02)
- **D-01:** Use **Cloudflare Turnstile**. Chosen because it's free/unlimited, privacy-friendly, and **natively supported by Supabase Auth** for signup (hCaptcha is the other native option; reCAPTCHA is NOT natively supported and was rejected to avoid custom verification everywhere). Needs a Cloudflare Turnstile site key + secret key in env config.
- **D-02:** CAPTCHA on **both signup and posting**. Signup uses Supabase Auth's native CAPTCHA integration (enable in dashboard + pass token from the Register form). Posting is NOT an auth endpoint, so the Turnstile token must be **verified server-side** (Supabase Edge Function or an RPC/`pg_net` call to Turnstile's siteverify) before the product insert is allowed.
- **D-03:** Localized, user-facing CAPTCHA failure handling (bilingual strings) — block the action and surface a clear message.

### Anti-Spam — Rate Limit (ABUSE-01)
- **D-04:** Limit = **10 ad inserts per user per rolling 1-hour window** (chosen over 5/24h or 3/24h to accommodate legit bulk sellers e.g. dealerships while still stopping rapid-fire bot floods).
- **D-05:** Enforced **server-side** in the ad-creation path (DB-side count in an RPC/trigger, not client-only — a client check is bypassable). **Count every insert in the window, including ads later deleted**, so delete-and-repost cannot reset the counter.
- **D-06:** On trip, **block the insert and show a friendly "try again in X minutes" message + toast** — not a silent failure, not a hard cryptic error.

### Block User (FEAT-05)
- **D-07:** New **`blocked_users` table** (`blocker_id`, `blocked_id`, `created_at`, PK/unique on the pair) + RLS — none exists today.
- **D-08:** Blocking is **mutual and silent**: A blocks B → each becomes invisible to the other in messaging, and B is **not notified** they were blocked (B's attempts to message A silently do not deliver). Standard marketplace pattern; avoids retaliation.
- **D-09:** Block **effects (all four):**
  1. **Hide existing conversations/messages** between A and B from both sides' Messages view.
  2. **Block new messages** from B to A (and A to B) — enforced **server-side** (RLS/trigger on `messages`/`conversations` insert checks `blocked_users`), not merely hidden client-side.
  3. **Hide B's active listings from A's browse/search** (and vice-versa). NOTE: per-viewer block-list filtering is awkward in RLS; planner/researcher to decide RLS vs app-level filter in `ProductsContext`/`fetchProducts` — flagged below.
  4. **Block control surfaces** on the seller's profile and inside the conversation thread, plus an **unblock list** (managed in profile/settings).
- **D-10:** Realtime message subscriptions (`MessagesContext`) must respect blocks so a blocked user's INSERT events don't leak into the blocker's live view.

### Mark-as-Sold (FEAT-01)
- **D-11:** Trigger lives on each ad in the **My Ads** list (where sellers manage listings), using the existing **`ConfirmDialog`** pattern (mirrors the current delete flow). Implemented via the existing `ProductsContext.updateProduct()` path setting `status='sold'`.
- **D-12:** **Reversible** — seller can toggle `sold → active` again (deal fell through). Not a one-way terminal state.
- **D-13:** Sold listings **stay publicly visible with a "Sold" badge** on the seller's public profile / their public ad list, but are **removed from the main feed and search**. Rationale: preserves a "this seller has sold things" trust signal and sets up future reviews.
- **D-14:** **RLS interaction (IMPORTANT):** Phase 1's `products` SELECT policy (D-04 of Phase 1) currently exposes only `status='active'` to the public, with `sold`/`expired`/`hidden` visible to owner+admin only. To satisfy D-13, the SELECT policy must be **relaxed to also expose `status='sold'` publicly**, while keeping `expired`/`hidden` owner/admin-only. The main feed/search must then explicitly filter `status='active'` at the app/query layer (since RLS now also permits `sold`). Planner must reconcile this with Phase 1's policy.
- **D-15:** "Sold" badge reuses the existing badge styling convention (`.badge-*` classes on `ProductCard`/`ProductDetail`) — add `.badge-sold`.

### Notifications Bell (FEAT-08)
- **D-16:** Bell is fed by **`new_message` + `system`** notification types this phase (`saved_search`/`price_drop` stay unwired — v2). New-message events create a notification via the Phase 1 `create_notification()` SECURITY DEFINER fn (wired by a trigger on `messages` insert, or in the send-message path).
- **D-17:** **Navbar dropdown** presentation: bell icon + unread count; clicking opens a dropdown list of recent notifications; each item links to the relevant conversation/listing. **Mark-read on open** (opening the dropdown sets `read_at = now()` for shown unread items).
- **D-18:** New client-side **notifications context/subscription** (none exists yet — only the DB table). Mirror the existing realtime subscription pattern in `MessagesContext`/`PricingContext`, subscribing to RLS-filtered `postgres_changes` on the user's notification rows.
- **D-19:** The bell is **complementary to the existing Messages-link unread badge** (which is per-conversation), not a replacement. To keep them consistent, a `new_message` notification should also be considered read when the user opens the underlying conversation — not only when the bell dropdown is opened. *(Claude's discretion on exact mechanism; flag if it conflicts with D-17.)*

### Structured Reports (FEAT-02, FEAT-03) — defaults accepted
- **D-20:** Add a **`reason` constrained column** to the existing `reports` table using the **`text + CHECK`** convention (matches Phase 1 D-02/D-07): fixed set `('scam','spam','prohibited','already_sold','duplicate','other')`. Replace the current free-text `<select>` in the report modal (`ProductDetail.jsx`) with these structured options (bilingual labels).
- **D-21:** **Dedup = silent** — a second report by the same user on the same listing is **silently deduped (no error shown)**, via a unique-ish constraint on `(reporter, product)` (upsert or ignore-on-conflict). Does NOT hard-error at the user.
- **D-22:** Admin reports view (`Admin.jsx` reports tab) gains a **filter by reason**.

### WhatsApp & Share (FEAT-06, FEAT-07) — defaults accepted
- **D-23:** **WhatsApp button** on product detail: `https://wa.me/<sellerPhone>?text=<prefilled>` with the prefill = listing title + listing URL. Rendered **only when the seller has a phone number**. Sits alongside the existing phone/email/message contact buttons.
- **D-24:** **Share**: a native `share()` function already exists on `ProductDetail`. Extend it with an explicit **WhatsApp-share** target and a **copy-link** fallback (Web Share API where available, manual options otherwise).

### Verified Badge (FEAT-04) — defaults accepted
- **D-25:** A verified badge **already renders on `ProductDetail`** (`product.seller.verified`). Extend the same badge to **product cards (`ProductCard`)** and the **seller profile page**. `seller.verified` is already in `PRODUCT_SELECT`/`fromRow`. Reuse `.badge-verified` styling.

### Admin Audit Log (ADMIN-01, ADMIN-02) — defaults accepted
- **D-26:** Wire **`log_admin_action(action, target_table, target_id, details)`** (Phase 1 keystone) into the **four admin mutations**: delete ad (`removeProduct`), change role (`setUserRole`), verify user (`setUserVerified`), change prices (`setPrice`/`setFeaturedPrice`). Caller serializes before/after into `details jsonb` per Phase 1 D-12 (e.g. `{"old_role":"user","new_role":"admin"}`).
- **D-27:** Add a **read-only audit-log tab** in `Admin.jsx` (alongside users/ads/reports/pricing), admin-only (RLS already restricts SELECT to admins), showing action / target / actor / timestamp, with a **filter** (by action/reason) and pagination for volume.

### Claude's Discretion
- Exact Turnstile server-side verification mechanism (Edge Function vs RPC + `pg_net` to siteverify) — researcher/planner's call; verify `pg_net`/Edge Function availability for this Supabase project.
- Block-listing browse filtering: **RLS vs app-level** filter in `ProductsContext`/`fetchProducts` (D-09 effect 3) — choose based on RLS feasibility for per-viewer block lists and the existing query shape.
- New SQL file organization in `cabofeira/supabase/` (per-concern files, applied manually — no migration runner), following the established convention (`reports.sql`, `messages.sql`, etc.).
- Exact mechanism for keeping the new_message notification and the existing unread-message badge consistent (D-19).
- Whether mark-as-sold also appears on the owner's product-detail view (chosen "My Ads only" as the primary surface; adding detail-page is optional polish).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 2: Missing Table-Stakes Features" — goal, depends-on (Phase 1), 5 success criteria, UI hint
- `.planning/REQUIREMENTS.md` — FEAT-01..08, ABUSE-01/02, ADMIN-01/02 definitions
- `.planning/research/FEATURES.md` — competitor-research basis for the v1 feature set, complexity (S/M/L) and dependency notes per feature, and the MVP "Launch With" list these 12 requirements derive from

### Phase 1 keystones this phase composes onto (READ — these define the contracts)
- `.planning/phases/01-security-foundation-keystones/01-CONTEXT.md` — keystone decisions D-01..D-20, esp. notifications (D-06/D-10), audit log (D-11..D-15), and the products SELECT/guard policy (D-04, D-16..D-20) that mark-as-sold + sold-visibility must reconcile with
- `cabofeira/supabase/notifications.sql` — `notifications` table shape, `create_notification(user_id,type,title,body,data,link)` SECURITY DEFINER fn, realtime publication (substrate for the bell)
- `cabofeira/supabase/admin_audit_log.sql` — append-only `admin_audit_log` table + `log_admin_action(action,target_table,target_id,details)` RPC (audit writes)
- `cabofeira/supabase/schema.sql` — current `products` SELECT policy / status column (must relax to expose `sold` publicly — D-14), `is_admin()`, `profiles`
- `cabofeira/supabase/reports.sql` — current `reports` table (free-text reason; add structured `reason` + dedup constraint)
- `cabofeira/supabase/messages.sql`, `cabofeira/supabase/messages_unread.sql` — messaging + realtime/unread patterns (block-user filtering + new_message notification trigger)
- `cabofeira/supabase/storage_product_images.sql` — bucket (not changed here; SEC-05 is Phase 4)

### App integration points (from codebase scout)
- `cabofeira/src/context/ProductsContext.jsx` — `PRODUCT_SELECT` (~L16), `fromRow` (~L52, has `seller.verified`), `updateProduct` (~L195, mark-as-sold), `addProduct` (~L182, rate limit + post-CAPTCHA), feed/search query (status filter)
- `cabofeira/src/context/MessagesContext.jsx` — conversation/message fetch + realtime subscriptions (block filtering, new_message notification)
- `cabofeira/src/pages/MyAds.jsx` — mark-as-sold control (~L19-87)
- `cabofeira/src/pages/ProductDetail.jsx` — contact buttons (~L254-275), verified badge (~L310-314), share() (~L167-179), report modal (~L384-469), Modal pattern (~L475-493)
- `cabofeira/src/components/ProductCard.jsx` — sold + verified badge insertion (~L14-34)
- `cabofeira/src/components/Navbar.jsx` — unread-message badge pattern (~L108-151); notification bell goes here
- `cabofeira/src/pages/Profile.jsx` — verified badge on seller profile + unblock list
- `cabofeira/src/pages/Admin.jsx` — admin mutations (delete ad ~L439, role ~L275, verify ~L250, prices ~L343-367); reports tab (~L44-70); new audit tab (~L179-204)
- `cabofeira/src/pages/Register.jsx` (~L30-47) + `cabofeira/src/context/AuthContext.jsx` (`register`) — signup CAPTCHA
- `cabofeira/src/pages/PostAd.jsx` — post-ad submit (post CAPTCHA + rate-limit surfacing)
- `cabofeira/src/components/ConfirmDialog.jsx` — reusable dialog (mark-as-sold, block)
- `cabofeira/src/i18n/en.json` + `pt-cv.json` — nested-namespace dictionaries; every new string MUST exist in both

### Codebase conventions
- `.planning/codebase/CONVENTIONS.md` — naming/style for new SQL + React
- `.planning/codebase/CONCERNS.md` — independent confirmation of these gaps (structured reports, audit log, dedup)
- `.planning/codebase/INTEGRATIONS.md` — Supabase integration surface (realtime, Edge Functions, `pg_net`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ConfirmDialog`** (`components/ConfirmDialog.jsx`) — supports `danger`, `requireText`, `busy`; reuse for mark-as-sold and block-user confirmations.
- **Phase 1 `create_notification()`** — sole insert authority for notifications (no direct INSERT policy); the new_message trigger and any `system` notification call this.
- **Phase 1 `log_admin_action()`** — single signature for every admin mutation; caller serializes `details`.
- **`PRODUCT_SELECT`/`fromRow`** already expose `seller.verified` — verified badge needs no query change.
- **Existing native `share()`** on `ProductDetail` — extend rather than rebuild for FEAT-07.
- **`.badge-*` CSS convention + existing `.badge-verified`** — add `.badge-sold`; reuse verified badge across surfaces.

### Established Patterns
- **Realtime subscription pattern** in `MessagesContext`/`PricingContext` (RLS-filtered `postgres_changes`) — mirror for the notifications client context.
- **`text + CHECK`** for constrained columns (Phase 1 D-02/D-07) — drives the report `reason` enum.
- **Per-concern SQL files** in `cabofeira/supabase/`, applied manually in the Supabase SQL editor (no migration runner). New tables (`blocked_users`) + alters (`reports.reason`, products SELECT policy relax) ship as new files here.
- **Optimistic UI + async DB sync** (favorites, views) — applicable to mark-as-sold / mark-read.

### Integration Points
- Mark-as-sold + sold-visibility **reconcile with Phase 1's `products` SELECT policy** (relax to expose `sold`; app filters `active` for the feed — D-14).
- Block-user touches **three query surfaces**: messages fetch, realtime message subscription, and product browse/search (D-09).
- New_message notification wires into the **messages insert path** (trigger calling `create_notification()`), and the bell subscribes to the notifications realtime channel (Phase 1 publication).
- Audit writes wrap the **four existing admin mutation paths**; the viewer is a new admin tab.

</code_context>

<specifics>
## Specific Ideas

- CAPTCHA: prefer Cloudflare Turnstile specifically for its native Supabase Auth integration on signup (minimizes custom code on the signup path).
- Rate limit deliberately tuned to per-hour (10/h) rather than per-day to tolerate legit dealership-style bulk posting while stopping bot bursts.
- Block is "silent + mutual" by explicit choice — the blocked user is never told, to avoid retaliation dynamics.
- Sold listings are kept publicly visible (badged) rather than hidden, specifically to preserve a seller track-record signal that future reviews can build on.

</specifics>

<deferred>
## Deferred Ideas

- **Report-outcome notifications** (notify reporter/seller when an admin resolves a report or removes an ad) — considered for the bell; deferred (bell wired for `new_message` + `system` only this phase). Easy to add later via `create_notification()`.
- **Mark-as-sold on the product-detail owner view** — primary surface is My Ads; adding the detail-page control is optional polish, not required.
- **Saved-search / price-drop notifications** — v2 (keystone ready, not wired).
- **Listing expiry + renewal, seller ratings/reviews, moderation/approval queue, transactional emails, phone masking, richer profiles** — explicitly v1.x/v2 per `REQUIREMENTS.md` and `FEATURES.md`.

</deferred>

---

*Phase: 02-missing-table-stakes-features*
*Context gathered: 2026-06-08*
