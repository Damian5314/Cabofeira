# Phase 2: Missing Table-Stakes Features - Research

**Researched:** 2026-06-08
**Domain:** React 19 + Supabase (Postgres/RLS/Realtime/Auth/Edge Functions) marketplace feature build, composing onto Phase 1 keystones
**Confidence:** HIGH (codebase + Phase-1 SQL read directly; library/CAPTCHA facts verified against official docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Cloudflare Turnstile (free, privacy-friendly, natively supported by Supabase Auth). Needs site key + secret key in env config.
- **D-02:** CAPTCHA on both signup AND posting. Signup uses Supabase Auth native CAPTCHA (dashboard toggle + token from Register form). Posting is NOT an auth endpoint → token must be verified server-side (Edge Function or RPC/`pg_net` to siteverify) before product insert.
- **D-03:** Localized, user-facing CAPTCHA failure handling (bilingual) — block the action, surface a clear message.
- **D-04:** Rate limit = 10 ad inserts per user per rolling 1-hour window (tolerates legit bulk sellers, stops bot bursts).
- **D-05:** Enforced server-side in the ad-creation path (DB-side count in RPC/trigger, not client-only). Count every insert in the window, including ads later deleted, so delete-and-repost cannot reset the counter.
- **D-06:** On trip, block the insert + show friendly "try again in X minutes" message + toast.
- **D-07:** New `blocked_users` table (`blocker_id`, `blocked_id`, `created_at`, PK/unique on the pair) + RLS.
- **D-08:** Blocking is mutual and silent: A blocks B → each invisible to the other in messaging; B is NOT notified; B's attempts to message A silently do not deliver.
- **D-09:** Block effects (all four): (1) hide existing convos/messages both sides; (2) block new messages both directions, enforced server-side (RLS/trigger), not merely hidden; (3) hide B's active listings from A's browse/search (and vice-versa) — RLS-vs-app-level is researcher/planner call; (4) block control surfaces on seller profile + conversation thread + an unblock list in profile/settings.
- **D-10:** Realtime message subscriptions must respect blocks (no leaked INSERT events into blocker's live view).
- **D-11:** Mark-as-sold trigger lives on each ad in My Ads, using existing `ConfirmDialog`; implemented via existing `ProductsContext.updateProduct()` setting `status='sold'`.
- **D-12:** Reversible — seller can toggle `sold → active` again. Not terminal.
- **D-13:** Sold listings stay publicly visible with a "Sold" badge on the seller's public profile / public ad list, but removed from main feed and search.
- **D-14 (IMPORTANT):** Phase 1 `products` SELECT policy exposes only `status='active'` publicly. To satisfy D-13, relax SELECT to also expose `status='sold'` publicly, keep `expired`/`hidden` owner/admin-only. Main feed/search must then explicitly filter `status='active'` at the app/query layer. Reconcile with Phase 1 policy.
- **D-15:** "Sold" badge reuses existing `.badge-*` convention — add `.badge-sold`.
- **D-16:** Bell fed by `new_message` + `system` types this phase. New-message events create a notification via Phase 1 `create_notification()` (trigger on `messages` insert, or in send-message path).
- **D-17:** Navbar dropdown: bell + unread count; click opens dropdown of recent notifications; each links to conversation/listing. Mark-read on open (sets `read_at = now()` for shown unread items).
- **D-18:** New client-side notifications context/subscription, mirroring `MessagesContext`/`PricingContext` realtime pattern (RLS-filtered `postgres_changes`).
- **D-19:** Bell is complementary to the existing Messages-link unread badge, not a replacement. A `new_message` notification should also be considered read when the user opens the underlying conversation. (Mechanism = Claude's discretion; flag if it conflicts with D-17.)
- **D-20:** Add a `reason` constrained column to `reports` using `text + CHECK`: `('scam','spam','prohibited','already_sold','duplicate','other')`. Replace free-text `<select>` in report modal with structured options (bilingual labels).
- **D-21:** Dedup = silent. Second report by same user on same listing silently deduped (no error), via unique constraint on `(reporter, product)` (upsert/ignore-on-conflict). Does NOT hard-error.
- **D-22:** Admin reports view gains a filter by reason.
- **D-23:** WhatsApp button on product detail: `https://wa.me/<sellerPhone>?text=<prefilled>` (prefill = title + listing URL). Rendered only when seller has a phone. Sits alongside existing contact buttons.
- **D-24:** Share: extend existing `share()` with explicit WhatsApp-share target + copy-link fallback (Web Share API where available, manual otherwise).
- **D-25:** Verified badge already renders on `ProductDetail` (`product.seller.verified`). Extend to product cards (`ProductCard`) and seller profile. `seller.verified` already in `PRODUCT_SELECT`/`fromRow`. Reuse `.badge-verified`.
- **D-26:** Wire `log_admin_action(action, target_table, target_id, details)` into the four admin mutations: delete ad (`removeProduct`), change role (`setUserRole`), verify user (`setUserVerified`), change prices (`setPrice`/`setFeaturedPrice`). Caller serializes before/after into `details jsonb`.
- **D-27:** Read-only audit-log tab in `Admin.jsx`, admin-only (RLS already restricts SELECT), showing action/target/actor/timestamp, with filter (by action/reason) + pagination.

### Claude's Discretion
- Exact Turnstile server-side verification mechanism (Edge Function vs RPC + `pg_net`) — verify availability for this project.
- Block-listing browse filtering: RLS vs app-level filter in `ProductsContext`/`fetchProducts` (D-09 effect 3).
- New SQL file organization in `cabofeira/supabase/` (per-concern files, applied manually).
- Exact mechanism for keeping `new_message` notification + existing unread-message badge consistent (D-19).
- Whether mark-as-sold also appears on owner's product-detail view (My Ads chosen as primary; detail-page optional polish).

### Deferred Ideas (OUT OF SCOPE)
- Report-outcome notifications (notify reporter/seller on admin resolve) — deferred; bell wired for `new_message` + `system` only.
- Mark-as-sold on the product-detail owner view — optional polish, not required.
- Saved-search / price-drop notifications — v2.
- Listing expiry+renewal, seller ratings/reviews, moderation/approval queue, transactional emails, phone masking, richer profiles — v1.x/v2.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FEAT-01 | Mark-as-sold; leaves default feed/search; "Sold" badge | `updateProduct({status:'sold'})` already works through Phase-1 update guard (status is NOT pinned); relax SELECT policy + app-filter `active`; `.badge-sold`. See §Mark-as-Sold. |
| FEAT-02 | Structured report reason + admin filter by reason | `reports.reason` text+CHECK; replace `<select>` options; Admin reports filter. See §Structured Reports. |
| FEAT-03 | Dedup duplicate reports same user+listing | `unique (reporter_id, product_id)` + `.upsert(..., {onConflict, ignoreDuplicates:true})`. See §Structured Reports. |
| FEAT-04 | Verified badge on cards + detail + profile | `seller.verified` already in `PRODUCT_SELECT`/`fromRow`; render `.badge-verified` in `ProductCard` + `Profile`. See §Verified Badge. |
| FEAT-05 | Block user; hide convos/messages | `blocked_users` table + RLS rewrite on conversations/messages + browse filter + unblock UI. See §Block User. |
| FEAT-06 | WhatsApp contact button | `wa.me` deep link gated on `seller.phone`. See §WhatsApp & Share. |
| FEAT-07 | Share via native/WhatsApp/copy-link | Extend existing `share()` on `ProductDetail`. See §WhatsApp & Share. |
| FEAT-08 | In-app bell on new message | Trigger on `messages` INSERT → `create_notification()`; new `NotificationsContext` + navbar bell. See §Notifications Bell. |
| ABUSE-01 | Server-side ad-posting rate limit | Append-only `product_post_log` + `BEFORE INSERT` count guard (survives hard-delete). See §Rate Limit. |
| ABUSE-02 | CAPTCHA on signup + posting | Turnstile: native Auth CAPTCHA on signup; Edge Function siteverify gate on posting. See §CAPTCHA. |
| ADMIN-01 | Admin mutations recorded in audit log | Wire `log_admin_action()` into four mutation paths. See §Audit Log. |
| ADMIN-02 | Admin can view audit log | New `audit` tab in `Admin.jsx`. See §Audit Log. |
</phase_requirements>

## Summary

Phase 2 is a feature-completion build that wires twelve trust-and-completeness features onto three Phase-1 keystones (`products.status`, `notifications` + `create_notification()`, `admin_audit_log` + `log_admin_action()`) and three security guard triggers (`security_guards.sql`). All SQL ships as new per-concern files in `cabofeira/supabase/` applied manually in the Supabase SQL editor — there is no migration runner. All React work extends the existing Context-provider architecture; no new top-level libraries except the Turnstile React widget.

The single highest-risk integration is the **`products` SELECT policy relaxation (D-14) interacting with the Phase-1 guards and block-list filtering**. The Phase-1 SELECT policy is `status = 'active' OR auth.uid() = seller_id OR public.is_admin()`. Relaxing it to also surface `sold` while keeping the main feed `active`-only requires both an RLS edit AND a query-layer change in `ProductsContext` (`refreshProducts`, `fetchProducts`), and must not regress the `guard_products_update()` (which legitimately does NOT pin `status`, so mark-as-sold works) or `guard_products_insert()` (which forces `status='active'` for non-admins — meaning a "sold" status can only ever be reached via UPDATE, never INSERT — exactly what we want).

The CAPTCHA split is well-supported: signup uses Supabase's native Auth CAPTCHA (a dashboard toggle + `captchaToken` passed into `supabase.auth.signUp`), while posting — not being an auth endpoint — needs a server-side siteverify call. A **Supabase Edge Function is the recommended mechanism** (official Supabase example exists); `pg_net` is a viable but messier alternative and the project's own STATE.md flags that `pg_net` enablement is unverified. The rate limit must use an **append-only log table** because products can be hard-deleted (`removeProduct` does a real `DELETE`), so any count over `products.created_at` would reset on delete-and-repost — defeating D-05.

**Primary recommendation:** Ship eight per-concern SQL files (block_users, reports_reason, product_post_log + rate-limit guard, products_select_sold relax, new_message notification trigger, audit-write is code-only) applied in a strict order; install `@marsidev/react-turnstile@1.5.2` (Cloudflare-recommended, CRA-compatible); deploy one Supabase Edge Function `verify-turnstile` for the posting CAPTCHA; add one `NotificationsContext`; and extend existing components rather than rebuild. Sequence dependencies are real and listed in §Ordering Constraints.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mark-as-sold | Database (RLS SELECT + status) | Client (My Ads UI + feed filter) | Visibility boundary must be RLS (defense-in-depth, Phase-1 D-01); UI flips status via existing update path |
| Structured report reason + dedup | Database (CHECK + unique constraint) | Client (report modal options + admin filter) | Constraint enforcement and dedup belong in Postgres; UI surfaces choices |
| Verified badge | Client (render) | — | Data (`seller.verified`) already flows; pure presentation across 3 surfaces |
| Block user | Database (RLS on conversations/messages, server-side enforcement) | Client (browse filter + block/unblock UI) | "Server-side not merely hidden" (D-09 #2) mandates RLS/trigger; per-viewer browse filter is app-level |
| WhatsApp / Share | Client (browser) | — | `wa.me` deep link + Web Share API are pure client concerns |
| Notifications bell | Database (trigger → create_notification + realtime) | Client (NotificationsContext + navbar dropdown) | Fan-out must run server-side (SECURITY DEFINER); bell subscribes to RLS-filtered channel |
| Rate limit | Database (append-only log + BEFORE INSERT guard) | Client (friendly error surfacing) | "Bypass-resistant, server-side" (D-05) mandates DB enforcement; client only surfaces the message |
| CAPTCHA (signup) | Supabase Auth (managed) | Client (Turnstile widget + token pass) | Native Auth integration verifies token server-side inside GoTrue |
| CAPTCHA (posting) | Edge Function (siteverify) | Client (widget) + DB (insert gated on verify) | Non-auth action; token must be verified server-side before insert |
| Audit log writes | Database (log_admin_action SECURITY DEFINER) | Client (admin mutation callers serialize details) | Append-only integrity is DB-enforced; callers pass `details` |
| Audit log viewer | Client (admin tab) | Database (RLS admin-only SELECT) | Read-only presentation over an admin-gated table |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.105.4` (already installed) | DB/Auth/Storage/Realtime + `signUp({options:{captchaToken}})` | Project's sole backend client; native CAPTCHA support added in this major. `[VERIFIED: package.json]` |
| `@marsidev/react-turnstile` | `1.5.2` | Cloudflare Turnstile React widget (signup + posting) | Cloudflare officially recommends it for React; 1.58M weekly downloads; CRA-compatible (no SSR/hooks-only). `[VERIFIED: npm registry]` `[CITED: developers.cloudflare.com/turnstile/community-resources]` |
| `react` / `react-dom` | `^19.1.0` (already installed) | UI framework | Project constraint — no rewrite. `[VERIFIED: package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Edge Functions (Deno) | platform feature | Server-side Turnstile siteverify for the posting CAPTCHA | Only the posting path (signup is verified inside GoTrue). One function `verify-turnstile`. `[CITED: supabase.com/docs/guides/functions/examples/cloudflare-turnstile]` |
| `react-icons` | `^5.6.0` (already installed) | Bell icon (`HiBell`/`HiOutlineBell`), WhatsApp/share icons | Navbar bell + share buttons. `[VERIFIED: package.json]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Edge Function for posting CAPTCHA | RPC + `pg_net` to siteverify | `pg_net` enablement is UNVERIFIED for this project (STATE.md flags it); async `pg_net` makes synchronous "block the insert on failure" awkward — Edge Function is the cleaner, officially-documented fit. |
| `@marsidev/react-turnstile` | `react-turnstile` (1.1.5) | Both Turnstile-team-recommended; `react-turnstile` is less actively maintained (4 mo since publish vs days) and NOT the Cloudflare-recommended one. |
| Append-only `product_post_log` | Count over `products.created_at` | A count over `products` resets when an ad is hard-deleted (`removeProduct` does real DELETE) — directly defeats D-05 "count deleted inserts". Log table is required. |
| RLS-based per-viewer block browse filter | App-level filter in `fetchProducts` | RLS cannot cheaply reference an `auth.uid()`-scoped block list on every `products` SELECT row without a correlated subquery on every row; app-level filter is simpler and the browse hide is a UX nicety, not a security boundary (the security boundary is the messaging RLS). |

**Installation:**
```bash
cd cabofeira
npm install @marsidev/react-turnstile@1.5.2
```

**Version verification (performed this session):**
- `@marsidev/react-turnstile`: `npm view` → `1.5.2`, modified `2026-05-05`, repo `github.com/marsidev/react-turnstile`, no `postinstall` script, 1,582,161 downloads/week. `[VERIFIED: npm registry 2026-06-08]`
- `@supabase/supabase-js`: already `^2.105.4` in package.json — supports `signUp` `captchaToken`. `[VERIFIED: package.json]`

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@marsidev/react-turnstile` | npm | published 2026-05-05 (v1.5.2) | 1.58M/wk | github.com/marsidev/react-turnstile | unavailable | Approved (strong manual signals: Cloudflare-recommended, 1.58M dl/wk, real repo, no postinstall) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

> **slopcheck note:** `slopcheck` 0.6.1 installed but could not be invoked in this environment (not on PATH; `python -m slopcheck` failed). Per the graceful-degradation rule, the package is technically `[ASSUMED]` and the planner SHOULD add a `checkpoint:human-verify` before `npm install`. However, the manual verification signals are unusually strong: 1.58M weekly downloads, a real and active GitHub repository, an absent `postinstall` script, and explicit recommendation in Cloudflare's official Turnstile docs. Recommend a lightweight confirm rather than a hard block.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────── BROWSER (React 19 SPA) ───────────────────────────┐
                          │                                                                              │
  Register.jsx ──token──► │  Turnstile widget ──captchaToken──► AuthContext.register()                  │
                          │                                          │                                   │
  PostAd.jsx   ──token──► │  Turnstile widget ──token──► ProductsContext.addProduct()                   │
                          │                                          │ (1) invoke verify-turnstile       │
  ProductDetail/Card ───► │  share() / wa.me / verified badge / sold badge                               │
                          │                                          │                                   │
  Navbar ◄── bell ◄────── │  NotificationsContext (realtime postgres_changes on notifications)           │
                          │                                          │                                   │
  Profile ──block/unblk─► │  blocked_users insert/delete + unblock list                                  │
                          └──────────────────────────────────────────┼───────────────────────────────────┘
                                                                      │ supabase-js (anon JWT)
                          ┌───────────────────────────────────────────▼──────────────────────────────────┐
                          │  EDGE FUNCTION verify-turnstile  ──POST──► challenges.cloudflare.com/.../siteverify
                          │      (Deno; CLOUDFLARE_SECRET_KEY)  ◄── {success:true|false}                   │
                          └───────────────────────────────────────────┬──────────────────────────────────┘
                                                                      │
  ┌────────────────────────────────────────── POSTGRES (RLS + triggers) ──────────────────────────────────┐
  │                                                                                                        │
  │  products  ──BEFORE INSERT── guard_products_insert() (status:=active for non-admin)                    │
  │            ──BEFORE INSERT── enforce_post_rate_limit() ──count──► product_post_log (append-only)        │
  │            ──AFTER  INSERT── log_post()  ──► product_post_log                                           │
  │            SELECT policy: status IN ('active','sold') OR owner OR admin   ◄── D-14 relax                │
  │                                                                                                        │
  │  messages  ──BEFORE INSERT── guard: reject if blocked_pair(sender, recipient)                          │
  │            ──AFTER  INSERT── notify_new_message() ──► create_notification() (SECURITY DEFINER)          │
  │            SELECT policy: participant AND NOT blocked_pair                                              │
  │  conversations SELECT policy: participant AND NOT blocked_pair                                          │
  │                                                                                                        │
  │  notifications  ◄── create_notification() (sole insert path) ──realtime──► bell                         │
  │  blocked_users  (blocker_id, blocked_id) + helper is_blocked_pair(a,b)                                 │
  │  reports  +reason CHECK  +unique(reporter_id,product_id)                                                │
  │  admin_audit_log  ◄── log_admin_action() (sole write path) ──RLS admin SELECT──► audit tab             │
  └────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended SQL File Organization (per-concern, applied manually, in order)
```
cabofeira/supabase/
├── blocked_users.sql            # NEW: table + RLS + is_blocked_pair() helper
├── messages_block_rls.sql       # NEW: rewrite conversations/messages SELECT + messages INSERT guard
├── reports_reason.sql           # ALTER: reason CHECK + unique(reporter_id,product_id) + dedup-safe insert
├── products_sold_visibility.sql # ALTER: relax SELECT to include 'sold' (D-14)
├── product_post_log.sql         # NEW: append-only log + enforce_post_rate_limit() BEFORE INSERT + log AFTER INSERT
├── new_message_notification.sql # NEW: notify_new_message() AFTER INSERT on messages → create_notification()
└── (Edge Function)              # supabase/functions/verify-turnstile/index.ts (deployed via CLI, not SQL editor)
```
(Audit-log writes ADMIN-01 are code-only — `log_admin_action()` already exists. ADMIN-02 viewer is code-only.)

### Pattern 1: Realtime notifications context (mirror MessagesContext)
**What:** New `NotificationsContext` subscribing to RLS-filtered `postgres_changes` INSERT on `notifications`.
**When to use:** FEAT-08 bell.
**Example:**
```jsx
// Source: pattern mirrored from cabofeira/src/context/MessagesContext.jsx L69-92
// NotificationsContext.jsx
useEffect(() => {
  if (!user) { setNotifications([]); return; }
  refresh(); // initial: select * from notifications order by created_at desc limit 20
  const channel = supabase
    .channel(`notif-${user.id}`)
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => setNotifications((prev) => [payload.new, ...prev]))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [user, refresh]);
```
Note the `filter: user_id=eq.${user.id}` — RLS already restricts to the owner, but the explicit filter avoids unnecessary client-side noise. Provider must be nested INSIDE `AuthProvider` (App.jsx already nests `...AuthProvider > ProductsProvider > PricingProvider > MessagesProvider`); add `NotificationsProvider` alongside `MessagesProvider`.

### Pattern 2: Mark-read on open (D-17) reusing the `read_at` shape (Phase-1 D-08)
```jsx
// Mark all currently-shown unread as read when the dropdown opens.
const markAllRead = async () => {
  const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id);
  if (unreadIds.length === 0) return;
  setNotifications(prev => prev.map(n => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  // RLS notifications_update_own (Phase-1 D-10) already restricts to owner rows.
};
```

### Pattern 3: New-message notification trigger (D-16) — server-side fan-out
```sql
-- Source: composes Phase-1 create_notification() (notifications.sql L54) with messages.sql AFTER-INSERT precedent (bump_conversation_last_message L46-49)
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer            -- runs as owner → create_notification() admin/self gate is satisfied (cross-user fan-out)
set search_path = public
as $$
declare
  v_recipient uuid;
  v_sender_name text;
begin
  select case when c.buyer_id = new.sender_id then c.seller_id else c.buyer_id end
    into v_recipient
    from public.conversations c where c.id = new.conversation_id;
  -- Do not notify if blocked (mutual silent block — D-08/D-10)
  if public.is_blocked_pair(new.sender_id, v_recipient) then return new; end if;
  select name into v_sender_name from public.profiles where id = new.sender_id;
  perform public.create_notification(
    v_recipient, 'new_message',
    v_sender_name, left(new.body, 140),
    jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id),
    '/messages'
  );
  return new;
end;
$$;
drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message after insert on public.messages
  for each row execute function public.notify_new_message();
```
> **Why a trigger, not the send-message path:** the send path is duplicated (ProductDetail `sendMessage` inserts directly; a future Messages-page reply does too). A trigger guarantees every message produces a notification with no client coupling, and runs SECURITY DEFINER so `create_notification()`'s cross-user gate (notifications.sql L76) is satisfied. `[CITED: notifications.sql L54-89, messages.sql L32-49]`

### Anti-Patterns to Avoid
- **Client-only rate limit / block / CAPTCHA:** all three are explicitly required server-side (D-05, D-09 #2, D-02). A client check is a UX hint, never the enforcement boundary — Phase 4's direct-API probe (SEC-09) will exercise these via raw supabase-js.
- **Counting `products` for the rate limit:** breaks on hard-delete (D-05). Use the append-only log.
- **Letting `removeProduct` delete `product_post_log` rows:** the log must NOT have `on delete cascade` from products, or the count resets. Store `user_id` (not a product FK with cascade) — see §Rate Limit.
- **Mark-as-sold via INSERT:** `guard_products_insert()` forces `status='active'` for non-admins (security_guards.sql L99). Sold is reachable ONLY via UPDATE — correct; do not try to insert sold rows.
- **Forgetting the feed `.eq('status','active')`:** once SELECT permits `sold`, `refreshProducts` and `fetchProducts` will start returning sold ads into Home/Search unless explicitly filtered (D-14).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bot/CAPTCHA on signup | Custom challenge | Supabase native Auth CAPTCHA (dashboard toggle + `captchaToken`) | GoTrue verifies the token server-side; zero custom verify code on the signup path. `[CITED: supabase.com/docs/guides/auth/auth-captcha]` |
| Turnstile widget rendering | Manual `<script>` + `window.turnstile.render` | `@marsidev/react-turnstile` `<Turnstile onSuccess={setToken} />` | Handles script injection, lifecycle, reset, theme; Cloudflare-recommended. |
| Token siteverify | Hand-rolled fetch scattered in client | One Edge Function `verify-turnstile` | Keeps the secret key off the client; one audited choke point. `[CITED: supabase.com/docs/guides/functions/examples/cloudflare-turnstile]` |
| Notification fan-out + cross-user insert auth | Per-call client insert | Phase-1 `create_notification()` via trigger | Sole insert path; SECURITY DEFINER; client cannot forge another user's bell (notifications.sql L76). |
| Audit-write integrity | New audit columns/triggers | Phase-1 `log_admin_action()` | Append-only, admin-gated, single signature (admin_audit_log.sql). |
| Share sheet | Custom modal | `navigator.share` with copy-link fallback (already half-built) | Web Share API on mobile; the existing `share()` already does this. |

**Key insight:** Nearly every server-side primitive this phase needs already exists from Phase 1 (`create_notification`, `log_admin_action`, `is_admin`, the status column, the guard triggers). The work is almost entirely *wiring* + new RLS for blocks + the rate-limit log + the Turnstile glue. Resist building anything new server-side beyond `blocked_users`, `product_post_log`, the new-message trigger, and the reports `reason`/unique alter.

## Runtime State Inventory

> Not a rename/refactor phase. This is a greenfield-feature build onto an existing schema. Section omitted per template guidance — no stored-key/registered-state migration applies. One data-shape note: existing `reports.reason` rows hold free-text values that will NOT match the new CHECK set — see Pitfall 4.

## Common Pitfalls

### Pitfall 1: Sold listings leak into the main feed after the SELECT relax
**What goes wrong:** After relaxing `products` SELECT to permit `status IN ('active','sold')`, Home (`refreshProducts`) and Search (`fetchProducts`) start showing sold ads because they never filtered by status (Phase-1 D-05 left app filtering optional).
**Why it happens:** RLS was the only gate before; the feed query has no `.eq('status','active')`.
**How to avoid:** In `ProductsContext`, add `.eq("status", "active")` to `refreshProducts` (L82-86) and `fetchProducts` (L124-156). For the seller's PUBLIC profile/ad list (D-13), explicitly query `.in("status", ["active","sold"])` or filter client-side so sold shows there only.
**Warning signs:** Sold ads appear on Home or in search results.

### Pitfall 2: Rate-limit count resets on delete-and-repost
**What goes wrong:** A spammer posts 10, deletes them, posts 10 more — never tripping the limit.
**Why it happens:** Counting `products.created_at` (which disappears on hard delete via `removeProduct`'s real `DELETE`).
**How to avoid:** Append-only `product_post_log(user_id, created_at)` written by an AFTER INSERT trigger; count over the log in the BEFORE INSERT guard. The log row is NEVER deleted when the product is. Do not FK-cascade it to products.
**Warning signs:** Posting more than 10/hour succeeds after deleting earlier ads.

### Pitfall 3: New-message trigger can't insert for the recipient (auth gate)
**What goes wrong:** `create_notification()` raises `Not authorized` because `p_user_id <> auth.uid()` (notifications.sql L76) — the sender is creating a notification for the recipient.
**Why it happens:** The cross-user gate only allows admins or SECURITY DEFINER callers running as owner.
**How to avoid:** `notify_new_message()` MUST be `security definer set search_path = public` (mirrors `bump_conversation_last_message`). As definer it bypasses the per-user gate. Verify the function owner is a role `is_admin()`-equivalent OR that the gate's "SECURITY DEFINER caller" assumption holds — test with a real two-account message.
**Warning signs:** Sending a message errors, or the bell never updates.

### Pitfall 4: Existing `reports.reason` free-text values violate the new CHECK
**What goes wrong:** `ALTER TABLE ... ADD CONSTRAINT ... CHECK (reason in (...))` fails because existing rows hold old free-text reasons (the current modal sends translated label strings, ProductDetail.jsx L422-427).
**Why it happens:** The current `reason` column is unconstrained `text not null` and stores whatever the `<select>` option label was.
**How to avoid:** Decide a migration: either (a) backfill existing rows to `'other'` before adding the CHECK, or (b) `ADD CONSTRAINT ... NOT VALID` then `VALIDATE` after backfill. Plan a one-line `update public.reports set reason='other' where reason not in (...)` first. Also note the modal currently stores the *label* — switch the `<option value="scam">` etc. so the stored value is the enum key, with bilingual labels as display text.
**Warning signs:** The `reports_reason.sql` apply errors with a check-violation.

### Pitfall 5: Block browse-filter degrades the cached 200-item pool
**What goes wrong:** `refreshProducts` caches 200 ads with no per-viewer awareness; filtering blocked sellers client-side shrinks the visible set unpredictably and can desync with `userProducts`/favorites.
**Why it happens:** The cache is global, not per-viewer.
**How to avoid:** Fetch the viewer's block list once (small) into `ProductsContext`/`AuthContext`, then filter `products`/`fetchProducts` results client-side at render. Treat browse-hiding as best-effort UX (the security boundary is messaging RLS). Don't try to make RLS do per-row block subqueries on `products`.
**Warning signs:** Counts flicker; a blocked seller's ad still appears after navigation (acceptable for UX, NOT for messaging).

### Pitfall 6: Realtime channel leak on block / user-change
**What goes wrong:** New `NotificationsContext` channel not torn down on logout/user-change leaks another account's events (this is exactly QA-03, deferred to Phase 3, but don't introduce a fresh instance of it).
**How to avoid:** Return `supabase.removeChannel(channel)` in the effect cleanup and key the effect on `user` (mirror MessagesContext L89-92).

## Code Examples

### blocked_users table + helper (FEAT-05)
```sql
-- Source: composes schema.sql RLS conventions + is_admin() precedent
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocked_users enable row level security;
-- A user manages only their OWN block list.
create policy "blocked_select_own" on public.blocked_users for select using (auth.uid() = blocker_id);
create policy "blocked_insert_own" on public.blocked_users for insert with check (auth.uid() = blocker_id);
create policy "blocked_delete_own" on public.blocked_users for delete using (auth.uid() = blocker_id);

-- Mutual check: is there a block in EITHER direction between a and b?
create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocked_users
     where (blocker_id = a and blocked_id = b)
        or (blocker_id = b and blocked_id = a)
  );
$$;
```

### Block-aware messaging RLS (FEAT-05 / D-09 #1+#2, server-side)
```sql
-- Conversations: participant AND not blocked in either direction.
drop policy if exists "conversations_select_participant" on public.conversations;
create policy "conversations_select_participant" on public.conversations for select
  using (
    (auth.uid() = buyer_id or auth.uid() = seller_id)
    and not public.is_blocked_pair(buyer_id, seller_id)
  );
-- Messages SELECT: participant AND conversation not blocked.
drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages for select
  using (exists (
    select 1 from public.conversations c
     where c.id = messages.conversation_id
       and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
       and not public.is_blocked_pair(c.buyer_id, c.seller_id)
  ));
-- Messages INSERT: existing participant check AND not blocked → blocks new messages both ways.
drop policy if exists "messages_insert_participant" on public.messages;
create policy "messages_insert_participant" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
         and not public.is_blocked_pair(c.buyer_id, c.seller_id)
    )
  );
```
> The INSERT `with check` failing is what makes B's message "silently not deliver" (D-08): supabase-js returns an RLS error; the client should swallow it and show the normal optimistic UI without surfacing "you are blocked" (silent). The planner must decide the exact client UX so it does not leak the block.

### Rate limit, hard-delete-proof (ABUSE-01)
```sql
-- Source: append-only log + BEFORE INSERT guard (D-04/D-05)
create table if not exists public.product_post_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,           -- NOT a cascading FK to products; survives ad deletion
  created_at timestamptz not null default now()
);
create index if not exists product_post_log_user_idx
  on public.product_post_log (user_id, created_at desc);
alter table public.product_post_log enable row level security;
-- No client policies; rows enter only via the AFTER INSERT trigger (definer).

create or replace function public.enforce_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if public.is_admin() then return new; end if;       -- admins exempt
  select count(*) into v_count from public.product_post_log
   where user_id = new.seller_id and created_at > now() - interval '1 hour';
  if v_count >= 10 then
    raise exception 'RATE_LIMIT' using errcode = 'P0001',
      detail = 'ad_post_rate_limit';                  -- client maps to friendly localized message (D-06)
  end if;
  return new;
end;
$$;
drop trigger if exists trg_enforce_post_rate_limit on public.products;
create trigger trg_enforce_post_rate_limit before insert on public.products
  for each row execute function public.enforce_post_rate_limit();

create or replace function public.log_product_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.product_post_log (user_id) values (new.seller_id);
  return new;
end;
$$;
drop trigger if exists trg_log_product_post on public.products;
create trigger trg_log_product_post after insert on public.products
  for each row execute function public.log_product_post();
```
> **Trigger ordering caveat:** Postgres fires BEFORE INSERT triggers alphabetically by trigger name. `trg_enforce_post_rate_limit` must evaluate using `new.seller_id`, which the Phase-1 `trg_guard_products_insert` does not change — order is safe. But the rate-limit guard raising an exception is a *hard error* (unlike Phase-1 guards' silent reset) — that is correct and intended for D-06 (block + message), and contrasts with Phase-1 D-19. Flag this divergence to the planner: silent reset is wrong for a rate limit; raising is right.

### Edge Function: verify-turnstile (ABUSE-02 posting)
```ts
// Source: supabase.com/docs/guides/functions/examples/cloudflare-turnstile
// supabase/functions/verify-turnstile/index.ts
Deno.serve(async (req) => {
  const { token } = await req.json();
  const ip = req.headers.get("CF-Connecting-IP") ?? "";
  const form = new FormData();
  form.append("secret", Deno.env.get("CLOUDFLARE_SECRET_KEY") ?? "");
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form });
  const outcome = await r.json();
  return new Response(JSON.stringify({ success: outcome.success === true }),
    { headers: { "Content-Type": "application/json" }, status: outcome.success ? 200 : 403 });
});
```
Client (`PostAd.submit`) calls `await supabase.functions.invoke("verify-turnstile", { body: { token } })` and only proceeds to `addProduct` when `data.success`. Secret set via `supabase secrets set CLOUDFLARE_SECRET_KEY=...`.
> **Residual gap (flag to planner):** the Edge Function gate is enforced in the client call path, so a raw supabase-js insert (Phase-4 SEC-09 probe) bypasses it — the CAPTCHA on posting is anti-bot, not an authorization boundary. The rate-limit trigger (DB-enforced) is the bypass-resistant backstop. Document this so SEC-09 expectations are correct.

### Turnstile widget on Register (ABUSE-02 signup)
```jsx
// Source: marsidev/react-turnstile README + supabase.com/docs/guides/auth/auth-captcha
import { Turnstile } from "@marsidev/react-turnstile";
const [captchaToken, setCaptchaToken] = useState("");
// in the form:
<Turnstile siteKey={process.env.REACT_APP_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} />
// AuthContext.register passes it through:
await supabase.auth.signUp({ email, password, options: { data: { name, phone }, captchaToken } });
```
After signUp, reset the widget (`ref.reset()`) since Turnstile tokens are single-use.

### Audit-log wiring (ADMIN-01)
```js
// Source: admin_audit_log.sql log_admin_action() L52
// e.g. in AuthContext.setUserRole, after the successful profiles update:
await supabase.rpc("log_admin_action", {
  p_action: "change_role", p_target_table: "profiles", p_target_id: userId,
  p_details: { old_role: prevRole, new_role: role },
});
```
Wire into: `setUserRole` (change_role), `setUserVerified` (verify_user, details `{old,new}`), `removeProduct` (delete_ad — but note `removeProduct` is shared by sellers too; only call `log_admin_action` when `isAdmin` to avoid non-admin sellers hitting the admin-gated RPC and erroring), `setPrice`/`setFeaturedPrice` (change_price). For prices, the debounced persist in `PricingContext` is the right hook but fires often — log on the persisted write, with `{category, old, new}`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `<script src="turnstile">` + global render | `@marsidev/react-turnstile` component | current | Lifecycle/reset handled; Cloudflare-recommended for React. |
| reCAPTCHA | Turnstile / hCaptcha for Supabase Auth | current | reCAPTCHA is NOT natively supported by Supabase Auth (D-01 rationale). |
| Custom auth-CAPTCHA verify code | Native `captchaToken` in `signUp` (supabase-js ≥2.x) | supabase-js v2 | No verify code on signup path. |

**Deprecated/outdated:**
- Do not use `react-google-recaptcha` — not natively supported by Supabase Auth; would require custom verification everywhere (explicitly rejected, D-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `pg_net` and Edge Functions availability: Edge Functions assumed available (cloud Supabase); `pg_net` enablement UNVERIFIED (STATE.md flag). | CAPTCHA / Alternatives | If this is self-hosted Supabase without Edge Functions, the posting-CAPTCHA mechanism must change — confirm hosting model and Edge Function availability with user. |
| A2 | `notify_new_message()` running SECURITY DEFINER satisfies `create_notification()`'s cross-user gate (the function owner is treated as privileged). | Pattern 3 / Pitfall 3 | If the definer's `auth.uid()` is still the sender (not null/owner), the gate raises — would need to grant the function owner admin-equivalence or relax the gate for the trigger. MUST be tested with two real accounts. |
| A3 | Existing `reports.reason` rows hold free-text labels incompatible with the new CHECK set. | Pitfall 4 | If reports table is empty in prod, no backfill needed — confirm row count before applying the CHECK. |
| A4 | `slopcheck` verdict for `@marsidev/react-turnstile` (tool couldn't run); relying on manual signals. | Package Legitimacy Audit | Low risk given 1.58M dl/wk + Cloudflare recommendation + real repo; planner may add a light human-verify checkpoint. |
| A5 | The browse-hide block effect (D-09 #3) is treated as best-effort UX, not a security boundary. | Block User / Pitfall 5 | If product owner asks for it to be a hard guarantee, RLS or a heavier query is needed; confirm acceptance that the messaging RLS is the real boundary. |
| A6 | New env vars `REACT_APP_TURNSTILE_SITE_KEY` (client) + `CLOUDFLARE_SECRET_KEY` (Edge Function secret) follow CRA `REACT_APP_*` convention. | Environment | `[VERIFIED: lib/supabase.js uses process.env.REACT_APP_*]` — CRA only exposes `REACT_APP_`-prefixed vars to the client. The secret must NOT use the `REACT_APP_` prefix (would leak to bundle). |

## Open Questions

1. **Is this Supabase project cloud-hosted (Edge Functions available) or self-hosted?**
   - What we know: env vars point to a `*.supabase.co` URL pattern (INTEGRATIONS.md); cloud is implied.
   - What's unclear: whether Edge Functions are enabled/deployable and whether `pg_net` is on.
   - Recommendation: Confirm with user before locking the posting-CAPTCHA mechanism; default to Edge Function (officially documented). Add a `checkpoint:human-verify`.

2. **Does the new-message notification trigger satisfy `create_notification()`'s authorization gate?**
   - What we know: Phase-1 gate allows admins or SECURITY DEFINER owner callers (notifications.sql L70-78).
   - What's unclear: the exact behavior of `auth.uid()` inside a definer trigger fired by a non-admin sender.
   - Recommendation: Plan an explicit two-account integration test (A blocks nobody, B messages A, A's bell updates) as the trigger's acceptance criterion.

3. **Report-table row count in production** — determines whether the CHECK needs a backfill (Pitfall 4).
   - Recommendation: Planner adds a pre-apply `select count(*) ... where reason not in (...)` check step.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project (cloud) | All backend | ✓ (assumed) | — | none |
| Supabase Edge Functions | Posting CAPTCHA siteverify | ? UNVERIFIED | — | RPC + `pg_net` (also unverified) — see Open Q1 |
| `pg_net` extension | Alt posting-CAPTCHA path | ✗ UNVERIFIED (STATE.md flag) | — | Edge Function (preferred) |
| Cloudflare Turnstile keys | signup + posting CAPTCHA | ✗ must be provisioned | — | none — user creates a free Turnstile widget (site+secret key) |
| `npm` (CRA build) | `@marsidev/react-turnstile` install | ✓ | v11.3.0+ | none |
| Supabase CLI | Edge Function deploy + `secrets set` | ? | — | deploy via dashboard |

**Missing dependencies with no fallback:**
- Cloudflare Turnstile site/secret keys — user must create a Turnstile widget in the Cloudflare dashboard (free) before signup/posting CAPTCHA can be tested. Planner: add a `checkpoint:human-verify` for key provisioning + the Supabase dashboard CAPTCHA toggle (manual, like all SQL).

**Missing dependencies with fallback:**
- Edge Functions vs `pg_net` for posting verify — Edge Function preferred and documented; `pg_net` is the fallback only if Edge Functions are unavailable.

## Security Domain

### Applicable ASVS Categories (Level 1, block on HIGH)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth native CAPTCHA on signup (anti-automation); existing email/password + email confirmation |
| V3 Session Management | no (unchanged) | Supabase-managed JWT; not modified this phase |
| V4 Access Control | yes | RLS everywhere: `blocked_users` owner-scoped; messaging RLS excludes blocked pairs; audit log admin-only SELECT; `log_admin_action` in-function admin gate; rate-limit + insert guards |
| V5 Input Validation | yes | `reports.reason` `text + CHECK` enum; message body length check (existing); status CHECK (Phase 1) |
| V6 Cryptography | no | No new crypto; Turnstile secret handled by Edge Function/Cloudflare; never in client bundle |
| V7 Error Handling | yes | Rate-limit raises a coded error mapped to a localized friendly message (no internal leak); block failures are silent (no "you are blocked" disclosure) |

### Known Threat Patterns for React 19 SPA + Supabase (planner must encode in each PLAN.md <threat_model>)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-only rate limit bypassed via raw supabase-js | Tampering / DoS | DB-enforced `enforce_post_rate_limit()` BEFORE INSERT over append-only log (ABUSE-01); not a client check |
| Block bypassed by direct message INSERT | Spoofing / Tampering | `messages` INSERT `with check` includes `not is_blocked_pair(...)` — server-side (D-09 #2) |
| Reading a blocked user's messages via direct SELECT | Information Disclosure | `messages`/`conversations` SELECT policies exclude blocked pairs |
| CAPTCHA token replay / reuse | Spoofing | Turnstile tokens single-use; reset widget after submit; siteverify rejects reused tokens |
| Secret key leaked into client bundle | Information Disclosure | `CLOUDFLARE_SECRET_KEY` lives only in the Edge Function env (NOT `REACT_APP_*`); only site key is public |
| Forging a notification to a victim's bell | Spoofing | `create_notification()` cross-user gate (Phase 1); trigger is the only cross-user caller (SECURITY DEFINER) |
| Non-admin invoking `log_admin_action` to forge audit rows | Tampering / Repudiation | In-function `is_admin()` gate; append-only RLS; only call from admin-gated UI paths |
| Mark-as-sold relax accidentally exposing `hidden`/`expired` | Information Disclosure | Relax SELECT to `status IN ('active','sold')` ONLY — keep `expired`/`hidden` to owner/admin (D-14); verify with Phase-4 probe |
| Self-XSS via report `details` / message body rendered | XSS | React escapes by default; ensure no `dangerouslySetInnerHTML`; admin reports render `r.details` as text (it does today) |
| Open conversation enumeration for blocked browse-hide | Information Disclosure | Browse-hide is UX-only; do not rely on it for confidentiality (the RLS is the boundary) |

> **Block-on-HIGH note:** The HIGH-severity items here are the three "must be server-side" enforcement points (rate limit, block messaging, CAPTCHA-as-anti-bot-not-authz). The planner MUST encode the rate-limit and block-messaging controls as DB-enforced (RLS/trigger) in their respective PLAN.md threat models; a client-only implementation of either is a blocking finding.

## Ordering / Dependency Constraints

These constrain plan/wave sequencing (SQL applied manually, in order):

1. `blocked_users.sql` (table + `is_blocked_pair`) **before** `messages_block_rls.sql` (RLS references the helper) **before** the block-aware bits of `new_message_notification.sql` (calls `is_blocked_pair`).
2. `reports_reason.sql` CHECK/unique **before** the Admin reason filter (FEAT-02) and the report-modal value change (FEAT-03). Backfill old `reason` values first (Pitfall 4).
3. `products_sold_visibility.sql` (SELECT relax) **paired with** the `ProductsContext` `.eq('status','active')` feed/search edits — apply together or Home/Search leak sold ads (Pitfall 1).
4. `product_post_log.sql` **before** the PostAd rate-limit error surfacing (the client maps the coded error; the DB must raise it).
5. Turnstile keys provisioned + Supabase dashboard CAPTCHA toggled **before** the Register widget signup test; Edge Function deployed + secret set **before** the PostAd posting-CAPTCHA test.
6. Audit-log writes (ADMIN-01, code-only) can land independently; the viewer tab (ADMIN-02) depends only on the existing `admin_audit_log` SELECT RLS — no new SQL.
7. Verified badge (FEAT-04), WhatsApp/Share (FEAT-06/07) have NO SQL and NO ordering deps — pure client, parallelizable.

## Project Constraints (from CLAUDE.md)

- **No rewrite:** stay on React 19 + Supabase + CRA; extend the Context architecture (`.planning/codebase/CONVENTIONS.md`). The only new dependency is `@marsidev/react-turnstile`.
- **Backend changes ship as new SQL files in `cabofeira/supabase/`, applied manually in Supabase** — no migration runner. Use `drop policy if exists ...; create policy ...` idempotent blocks; `create ... if not exists`; `do $$ ... add table to supabase_realtime ... $$` guard pattern (mirror existing files).
- **Bilingual mandatory:** every new user-facing string (sold badge, block/unblock, report reasons, CAPTCHA failure, rate-limit message, notifications, WhatsApp/share labels, audit tab) MUST exist in BOTH `cabofeira/src/i18n/en.json` AND `pt-cv.json`. Nested-namespace dictionaries with English fallback.
- **GSD workflow enforcement:** file edits go through a GSD command (planner/executor context).
- **Naming/style:** React components PascalCase; hooks `useX` camelCase; CSS file matches component; constants UPPER_SNAKE_CASE; async utils return `{ ok, error? }`; SQL per-concern files; `[module] operation: message` console prefixes with `// eslint-disable-next-line no-console`.
- **Security bar:** no backdoors, no privilege escalation, no leaked secrets — the Turnstile secret never enters the client bundle; rate-limit/block enforced server-side.
- **Validation Architecture section omitted:** `workflow.nyquist_validation` is `false` in config.json — no automated test suite this milestone (manual QA + fix is Phase 3).

## Sources

### Primary (HIGH confidence)
- Codebase (read directly this session): `cabofeira/supabase/{schema,notifications,admin_audit_log,messages,messages_unread,reports,security_guards,app_settings}.sql`; `cabofeira/src/context/{ProductsContext,MessagesContext,AuthContext,PricingContext}.jsx`; `cabofeira/src/pages/{ProductDetail,Admin,Register,MyAds,PostAd,Profile}.jsx`; `cabofeira/src/components/{Navbar,ProductCard,ConfirmDialog}.jsx`; `cabofeira/src/lib/supabase.js`; `cabofeira/package.json`
- `.planning/phases/02-missing-table-stakes-features/02-CONTEXT.md`, `.planning/phases/01-security-foundation-keystones/01-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/codebase/INTEGRATIONS.md`, `.planning/config.json`
- Supabase Auth CAPTCHA docs — `https://supabase.com/docs/guides/auth/auth-captcha` (dashboard toggle + `signUp({options:{captchaToken}})`)
- Supabase Edge Function Turnstile example — `https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile` (siteverify endpoint, FormData, `Deno.env.get('CLOUDFLARE_SECRET_KEY')`)
- npm registry (`npm view`) — `@marsidev/react-turnstile@1.5.2`, no postinstall, real repo

### Secondary (MEDIUM confidence)
- Cloudflare Turnstile community resources — `https://developers.cloudflare.com/turnstile/community-resources/` (recommends `@marsidev/react-turnstile`)
- npm downloads API — 1,582,161 weekly downloads for `@marsidev/react-turnstile`

### Tertiary (LOW confidence)
- GitHub issues #29231 / #35750 — reports of Turnstile-on-signup edge cases; flagged so the planner adds a real two-account signup test rather than assuming it works first try.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified via npm; CAPTCHA mechanism via official Supabase docs.
- Architecture: HIGH — all Phase-1 substrate read directly; integration points are exact file/line refs.
- Pitfalls: HIGH — derived from reading the actual guard triggers, RLS policies, and `removeProduct` hard-delete behavior.
- Edge Function vs pg_net availability: MEDIUM — hosting model assumed cloud; flagged as Open Question.

**Research date:** 2026-06-08
**Valid until:** 2026-07-08 (stable stack; Turnstile/Supabase docs slow-moving — re-verify package version if install slips a month)
