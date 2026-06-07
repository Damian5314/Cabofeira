# Pitfalls Research

**Domain:** Online classifieds marketplace (Cape Verde / CaboFeira) — React 19 SPA + Supabase (Postgres/Auth/Storage/Realtime), pre-launch hardening
**Researched:** 2026-06-07
**Confidence:** HIGH for the RLS/schema pitfalls (read directly from `cabofeira/supabase/*.sql`), MEDIUM–HIGH for Supabase platform pitfalls (verified against current Supabase docs + 2025/2026 security writeups incl. CVE-2025-48757), MEDIUM for classifieds trust-and-safety (industry sources, no Cape-Verde-specific data).

> **How to read this file.** Each pitfall is tagged with a **Thrust** (Security / Correctness / Features) so the roadmap can slot it into the right phase. The known privilege-escalation hole in `profiles` is real — but reading the actual SQL surfaced **four more write-side RLS holes of the same class** that are not yet on the PROJECT.md list. Those are called out first and explicitly because they are exploitable on day one of launch.

---

## Critical Pitfalls

### Pitfall 1: UPDATE RLS policies with no `WITH CHECK` → privilege escalation & ownership theft

**What goes wrong:**
A Postgres RLS `UPDATE` policy needs **two** clauses: `USING` (which existing rows may I touch?) and `WITH CHECK` (what may the row look like *after* I touch it?). Every `..._update_self` policy in this schema specifies only `USING` and omits `WITH CHECK`. Postgres then allows the row to be mutated into *any* shape as long as the pre-update row passed `USING`. Concretely, in `cabofeira/supabase/schema.sql`:

- **`profiles_update_self` (line 126)** — the known hole. A logged-in user can `update profiles set role='admin', verified=true where id = auth.uid()` and become an admin / verified seller. This is full privilege escalation, not a cosmetic bug.
- **`products_update_self` (line 138)** — the *unlisted* sibling hole. A seller passes `USING (auth.uid() = seller_id)` on their own row, then with no `WITH CHECK` can set `seller_id` to **someone else's** UUID (give away / frame another user), or flip `featured=true` / `seller_verified=true` (steal a paid placement and a trust badge for free), or rewrite `views`.

**Why it happens:**
`USING` alone "looks done" — the policy compiles, self-edits work in the happy path, and the gap only shows when an attacker crafts a raw PostgREST/`supabase-js` call with extra columns. The React UI never sends `role` or `seller_id`, so manual QA through the UI will never catch it. The trap is exactly the one named in current Supabase guidance and the recent **CVE-2025-48757** class (RLS misconfiguration exposing/mutating data via the anon key).

**How to avoid:**
1. Add `WITH CHECK` to every self-update policy that pins identity *and* immutable columns. For products: `with check (auth.uid() = seller_id)` at minimum.
2. Protect privileged columns at the **column level**, not just row level — RLS is row-granular and cannot say "you may update bio but not role." Use either (a) a `BEFORE UPDATE` trigger that rejects changes to `role`, `verified`, `email`, `seller_id`, `featured`, `seller_verified`, `views` unless `is_admin()`, or (b) `REVOKE UPDATE (role, verified, email) ON profiles FROM authenticated` + column grants (Supabase Column-Level Security). Trigger approach is more robust here because it also covers `featured`/`seller_verified` mass-assignment on insert.
3. Re-grant the admin path explicitly so admins keep their override.

**Warning signs:**
- Any policy block in the `.sql` files that has `for update ... using (...)` with no following `with check`.
- A non-admin account in the live DB whose `role='admin'` that you didn't create.
- `featured=true` listings that don't correspond to a paid/admin action.

**Phase to address:** **Security** (first-class, gating). Verify by attempting the exploit directly via `supabase-js` with a normal account before and after the fix.

---

### Pitfall 2: INSERT mass-assignment — sellers grant themselves "featured" and "verified" for free

**What goes wrong:**
`products_insert_self` (schema.sql line 137) only checks `with check (auth.uid() = seller_id)`. The columns `featured`, `seller_verified`, `views`, `price`, `currency`, and the denormalized `seller_*` snapshot are all client-supplied and **unconstrained**. A seller can POST a new listing with `featured=true` (skipping the paid featured surcharge entirely) and `seller_verified=true` (faking the trust badge that buyers rely on). Because pricing is the app's only revenue lever and verification is the app's only trust signal, this is both a revenue leak and a trust-and-safety hole.

**Why it happens:**
The insert policy was written to answer "is this my row?" not "are these values I'm allowed to set?" Trusting the client to send the right `featured`/`seller_verified` is invisible through the UI (the form never offers a free "featured" toggle), so manual QA misses it.

**How to avoid:**
- Force `featured`, `seller_verified`, and `views` to safe defaults on insert via a `BEFORE INSERT` trigger (`new.featured := false; new.seller_verified := false; new.views := 0;`) unless `is_admin()`.
- Derive the `seller_*` snapshot server-side from `profiles` in the trigger rather than trusting client input, so a seller can't spoof another seller's name/phone/verified status.
- Make `featured` only settable through the same admin/payment path that charges for it.

**Warning signs:** Featured listings with no corresponding pricing/admin record; verified badges on accounts `profiles.verified=false`.

**Phase to address:** **Security** (mass-assignment hardening, same SQL pass as Pitfall 1). Touches **Features** if a real "buy featured" flow is added.

---

### Pitfall 3: Demo/admin backdoor accounts with hardcoded credentials shipped to production

**What goes wrong:**
`schema.sql` lines 153–169 instruct the operator to create `admin@cabofeira.cv / admin123` and `user@cabofeira.cv / user123` and promote the first to admin. If those instructions were followed on the production Supabase project, there is a **known-credential admin account** on the live site. `admin123` is trivially guessable/brute-forceable, and it is documented in a committed file in a public-capable repo.

**Why it happens:**
Demo seed accounts are convenient during development and the "create them manually" comment makes them feel separate from code — so they survive into prod unnoticed. The credentials live in git history even after the comment is deleted.

**How to avoid:**
- Confirm whether these accounts exist on the **production** project (Auth → Users). If they do: delete the demo user, and either delete or rotate the admin account to a strong unique password + unique non-obvious email.
- Remove the demo-credential block from `schema.sql` and scrub it from git history if the repo is or will be public.
- Establish admins by promoting a real, MFA-protected operator account via SQL — never by a documented default password.
- Add a launch-checklist assertion: "no account in `auth.users` uses a password from any committed file."

**Warning signs:** Presence of `admin@cabofeira.cv` / `user@cabofeira.cv` in prod Auth; any login working with `admin123`.

**Phase to address:** **Security** (backdoor removal, hard launch gate).

---

### Pitfall 4: `security definer` functions without locked-down search_path / grants / `is_admin()` recursion

**What goes wrong:**
This app leans heavily on `security definer` functions: `handle_new_user`, `is_admin`, `increment_product_views`, `delete_my_account`, `bump_conversation_last_message`. `security definer` runs with the **owner's** privileges and can bypass RLS. Common failure modes that apply here:
- A mutable `search_path` lets an attacker who can create objects in a schema on the path shadow a function/table the definer calls (classic privilege-escalation vector). *Good news:* every function here already sets `search_path = public` — but any **new** definer function added during this milestone must do the same, and `public` being writable by `authenticated` is itself a sharp edge (lock down `CREATE` on `public`).
- Over-broad `EXECUTE` grants. `increment_product_views` is callable by anon with no rate limit (see Pitfall 9). New RPCs may inherit blanket `GRANT EXECUTE ... TO authenticated` from default privileges, silently widening the attack surface.
- `is_admin()` is used inside `profiles` policies and also reads `profiles`. Because it's `security definer` it avoids infinite RLS recursion — but if anyone "fixes" it to `security invoker`, the `profiles` policies that call it will recurse or silently deny. Treat its definer status as load-bearing.

**Why it happens:**
`security definer` is a sharp tool that's easy to copy-paste without re-checking search_path, grants, and whether the function should `FORCE`/respect RLS.

**How to avoid:**
- Audit every existing and new definer function for: `set search_path = public` present; minimal `EXECUTE` grant (`revoke ... from public, anon` then grant only the role that needs it — `delete_my_account` already does this correctly, use it as the template); body does only what's intended.
- `REVOKE CREATE ON SCHEMA public FROM authenticated, anon` so users can't plant shadow objects.
- Keep definer helpers out of exposed API schemas.

**Warning signs:** Supabase database **Advisor** flags ("function search path mutable", "security definer view"); any new function lacking the `set search_path` line.

**Phase to address:** **Security** (function audit pass). Run Supabase Advisors as the verification step.

---

### Pitfall 5: Storage policies trust client metadata — wrong-extension / oversized / non-image uploads

**What goes wrong:**
The `product-images` bucket is **public** and RLS only checks that the upload path's first folder equals `auth.uid()` (`storage_product_images.sql`). There is **no server-side enforcement** of content type or size — the 5MB cap and `image/*` check live only in `PostAd.jsx` (client-side, trivially bypassed via direct `supabase.storage` calls). A user can upload an HTML/SVG file (stored XSS risk on a public bucket served same-origin), a 500MB file (storage cost / DoS), or an arbitrary extension. Also note `product_images_update_own` (line 40-45) omits `bucket_id` from its predicate symmetry — keep it explicit. Orphaned-image cleanup on delete is fire-and-forget (`ProductsContext.jsx` ~line 234), so failed cleanups silently accumulate cost.

**Why it happens:**
"Public bucket + path-prefix policy" is the standard Supabase tutorial pattern and feels complete; the validation that actually matters (type/size) is assumed to be the client's job.

**How to avoid:**
- Enforce `allowed_mime_types` (e.g. `image/jpeg,image/png,image/webp`) and `file_size_limit` at the **bucket** level (Supabase bucket config), not just in React.
- Add a `with check` clause to the storage insert policy restricting `lower(right(name, 5))` to an allowed extension whitelist, and consider serving images via the image-transformation/render endpoint so SVG/script payloads can't execute.
- Replace fire-and-forget cleanup with a scheduled sweep (Edge Function / pg_cron) that deletes objects with no referencing product row; surface failures to admin.

**Warning signs:** Non-image objects in the bucket; bucket size growing faster than listing count; `console.warn` cleanup failures.

**Phase to address:** **Security** (storage hardening) + **Correctness** (orphan cleanup reliability).

---

### Pitfall 6: Open redirect via unvalidated `redirect` param on login

**What goes wrong:**
`Login.jsx:15` reads `redirect` from the URL and passes it to `navigate()`. React Router's `navigate()` blunts absolute-URL redirects somewhat, but a crafted value (`//evil.com`, `https:evil.com`, or a path that re-triggers a redirect chain) can still send users off-site or be used in phishing ("log in to CaboFeira, get bounced to a credential-harvesting clone"). For a trust-dependent marketplace, a login open-redirect is a reputation risk.

**Why it happens:**
"Redirect back to where they came from" is a convenience feature; the validation that the target is an in-app path is easy to skip.

**How to avoid:** Allowlist redirect targets: accept only values matching `^/[a-zA-Z0-9/_-]` (starts with a single `/`, no `://`, no `//`, no backslashes). Default to `/` on any mismatch. Apply the same check anywhere else a redirect/return param is read.

**Warning signs:** A `redirect=` value in the wild containing `:`, `//`, or `\`.

**Phase to address:** **Security** (quick win, same pass).

---

### Pitfall 7: Realtime subscription leaks — channels not torn down on unmount / user change

**What goes wrong:**
The app opens multiple Supabase Realtime channels with user-ID-derived names (`messages-${activeId}`, `conv-list-${user.id}`, `admin-reports`, `app_settings`) across `MessagesContext.jsx`, `Messages.jsx`, and `PricingContext.jsx`. If an effect re-runs (route change, active conversation switch, login→logout→login as a different user) without `supabase.removeChannel()` in its cleanup, old channels stay subscribed. This leaks WebSocket connections, can exhaust the project's concurrent Realtime quota, and — worse for correctness — a **stale channel keyed to a previous user's ID can keep delivering that user's message events to the new session**, an information leak across account switches.

**Why it happens:**
Channel lifecycle is subtle: the subscribe is obvious, the matching teardown in the effect's return is easy to forget or to mismatch (subscribing in one effect, cleaning up in another). The CONCERNS map already flags this as fragile.

**How to avoid:**
- Every `supabase.channel(...).subscribe()` must have a paired `return () => supabase.removeChannel(channel)` in the **same** `useEffect`, with the channel captured in a local variable.
- Key effects on `user.id` and active IDs so they re-subscribe cleanly on change; never reuse a channel object across renders.
- Add teardown logging in dev to confirm channels close 1:1.
- After logout, explicitly remove all channels.

**Warning signs:** Growing count in Realtime "Inspector"/dashboard; receiving messages for a conversation you've left; "update on unmounted component" warnings.

**Phase to address:** **Correctness** (subscription lifecycle QA), with the cross-user leak treated as **Security**.

---

### Pitfall 8: Cross-user cache staleness — one user sees another's stale/deleted listings

**What goes wrong:**
`ProductsContext` caches up to 200 products in memory and `refreshProducts()` keeps them "forever" (CONCERNS, line 95-99). In an SPA this cache is per-session, but the staleness bites within a session: a listing deleted or edited (price drop, sold) by its seller still shows in another browsing user's cached home feed; a moderated/removed scam listing can remain visible/contactable after admin deletion. Combined with the unread-badge race (`MessagesContext` lines 23-61), users can see counts and content that no longer reflect the database.

**Why it happens:**
A simple "fetch once, cache in context" is the path of least resistance and looks correct in single-user testing. Cross-user mutation invalidation requires either realtime on `products` (not currently subscribed) or TTL/refetch on navigation.

**How to avoid:**
- Add a TTL / refetch-on-focus or refetch-on-route-enter for the product feed and detail pages so deletions and edits propagate within seconds.
- For detail pages, always fetch fresh by ID rather than reading the list cache.
- Cap the cache (LRU) to bound memory.
- For moderation specifically, ensure a removed listing 404s on direct navigation (RLS/`deleted` flag), not just disappears from the feed.

**Warning signs:** Reports of "I deleted my ad but it's still up"; price shown in feed differs from detail page; contacting a seller about an already-sold/removed item.

**Phase to address:** **Correctness** (cache invalidation), with moderated-content visibility as **Security/Trust**.

---

### Pitfall 9: View-count RPC has no rate limit — vanity-metric inflation & cheap abuse vector

**What goes wrong:**
`increment_product_views(p_id)` is a `security definer` RPC callable by anonymous users with no throttle (schema.sql line 104; CONCERNS line 154). Anyone can loop it to inflate a listing's `views`, making junk/scam listings look popular (a known marketplace manipulation tactic) and adding write load. Because `featured`/sort can key off perceived popularity, inflated views can distort ranking.

**Why it happens:**
View counters are treated as harmless; the "anon can call it" convenience (so logged-out browsers count too) removes the natural per-user gate.

**How to avoid:**
- Debounce client-side (one increment per session per product) and enforce server-side: a lightweight per-(ip/user, product, time-window) guard, or move counting to an Edge Function / aggregate table updated on a schedule.
- Decouple display ranking from raw `views` so inflation can't game placement.

**Warning signs:** Listings with views wildly disproportionate to messages/favorites; spikes from single sessions.

**Phase to address:** **Correctness/Security** (low severity; can ride the function-audit pass).

---

### Pitfall 10: Trust & safety gaps — scam listings, spam, and seller-info harvesting

**What goes wrong:**
Classifieds attract a predictable fraud playbook (Sift/DataDome/Incognia industry reporting): too-good-to-be-true listings, duplicate/recycled images and text across many posts, "I'm out of town, pay via this link" social engineering in messages, fake-buyer phishing, and bulk listing floods from throwaway accounts. CaboFeira today has: free-text report reasons only (no structured categories, no duplicate-report dedupe — CONCERNS line 198), no rate limit on posting or messaging, no admin audit log, and seller phone/email denormalized onto every public `products` row (`seller_phone`, `seller_email` in schema.sql) — meaning a scraper can harvest every seller's contact details straight from the public listings read, enabling off-platform spam/phishing.

**Why it happens:**
Trust-and-safety is invisible until abuse arrives; pre-launch with zero users it feels premature. But the data model and policies that *enable* moderation must exist before launch — retrofitting is painful once listings and conversations accumulate.

**How to avoid:**
- **Structured report reasons** (enum dropdown: scam/spam/prohibited/miscategorized/other) + dedupe on (reporter, product) so one user can't spam-report and admins can triage by reason.
- **Rate limits** on new-listing creation and message sends per account/time-window (DB-side counter or Edge Function) to blunt listing floods and message spam.
- **Admin audit log** (`admin_actions` table) recording who deleted/promoted/repriced what and when — required for accountability and abuse investigation; currently entirely absent (CONCERNS line 204).
- **Don't over-expose contact info:** consider not returning `seller_phone`/`seller_email` in the public listing select; reveal phone only to authenticated users on the detail page, or behind the messaging flow. At minimum stop denormalizing live contact data into every public row.
- **Buyer-safety UX:** an inline "how to avoid scams / never pay in advance / meet in public" notice on listing/message views — the single highest-ROI trust feature for a launching classifieds site.

**Warning signs:** Multiple listings sharing identical images/text; off-platform-payment language in messages; complaints of unsolicited contact after posting.

**Phase to address:** **Features** (structured reports, safety notices, contact-reveal gating) + **Security** (rate limits, audit log).

---

### Pitfall 11: PostgREST exposes more than the UI — "the API is the attack surface, not the app"

**What goes wrong:**
Every table with RLS is automatically a REST + Realtime endpoint reachable with the public anon key. Whatever the React UI *chooses* not to request is still requestable directly. So pitfalls 1, 2, 5, 9 are all reachable without touching the front end. This also means manual QA "through the UI" — the chosen testing strategy for this milestone — **cannot validate security**: the UI is the wrong test harness for authorization.

**Why it happens:**
Teams reason about security from the UI inward ("the form doesn't let you set role") instead of from the API outward ("can a raw call set role?").

**How to avoid:**
- Treat RLS/policy verification as a separate test pass using `supabase-js`/curl with a **normal** account, attempting each forbidden action (escalate role, steal listing, set featured, read another user's conversation, upload non-image). This is the only meaningful security QA here given no automated suite.
- Enable and clear all **Supabase Database Advisors** (security + performance lints) before launch.
- Confirm no table that should be private has a `select using (true)` policy by accident.

**Warning signs:** Any policy reviewed only by clicking through the app; Advisors with open security findings.

**Phase to address:** **Security** (verification methodology; gates launch).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `USING` without `WITH CHECK` on UPDATE policies | Self-edit "just works" | Privilege escalation & ownership theft (Pitfalls 1–2) | **Never** for tables with privileged columns |
| Client-only validation (image type/size, redirect, featured flag) | Faster to ship, no SQL | Bypassed by any direct API call | Only as UX nicety *on top of* server enforcement |
| Fetch-once in-memory product cache, no invalidation | Snappy feed, simple code | Cross-user staleness, deleted listings linger (Pitfall 8) | OK pre-launch only if TTL/refetch added before go-live |
| Denormalized `seller_phone`/`seller_email` on public `products` | One query renders seller card | Bulk contact harvesting; PII in every public read (Pitfall 10) | Avoid; gate contact behind auth |
| No admin audit log | Less to build | No accountability trail for moderation/abuse | Never for a platform with admin powers + real users |
| Fire-and-forget storage cleanup | No blocking on delete | Orphaned files, unbounded storage cost (Pitfall 5) | Only with a compensating scheduled sweep |
| Demo accounts with documented passwords | Easy onboarding/demo | Live admin backdoor (Pitfall 3) | Never in production |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS | Writing `UPDATE` policies with only `USING` | Always pair with `WITH CHECK`; protect privileged columns via trigger or column grants |
| Supabase RLS | Assuming UI restrictions = security | Test authorization directly against PostgREST with a normal account |
| Supabase `security definer` | Mutable search_path / blanket EXECUTE grants | `set search_path = public`, `revoke from public/anon`, grant only the needed role; keep out of exposed schemas |
| Supabase Storage | Public bucket + path-prefix policy treated as "secure" | Enforce mime/size at bucket level; whitelist extensions in policy; sweep orphans |
| Supabase Realtime | Subscribe without paired `removeChannel` cleanup | One channel var per effect, removed in the same effect's return; remove all on logout |
| Supabase Auth | Documented demo passwords promoted to admin | Promote a real MFA account via SQL; never ship default creds |
| Supabase anon key | Treating it as a secret | It's public *by design* — security must come from RLS, not from hiding the key |
| React Router 7 `navigate()` | Passing unvalidated `redirect` param | Allowlist in-app paths only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded 200-item product cache kept forever | Memory growth, stale feed | LRU cap + TTL/refetch | Long sessions; many listings |
| Realtime channel leaks across navigations/logins | Climbing connection count, cross-user events | Strict per-effect teardown | Heavy navigation; account switching; deploy churn |
| N+1 nested fetch on Admin reports, no pagination | Admin reports tab slow | Paginate + lazy-load relations | Reports list grows |
| `views` RPC unthrottled | Write load + inflated metrics | Debounce + server rate limit; aggregate | Any bot loop |
| Messages/conversations grow unbounded | Slow message queries | Paginate; archive >6mo | Long-lived active platform |
| RLS predicates calling `auth.uid()` per-row uncached | Slow large scans | Wrap as `(select auth.uid())` so it's evaluated once | Large tables |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `profiles_update_self` lets user set `role`/`verified` | Full admin takeover, fake verified badge | `WITH CHECK` + trigger blocking privileged columns |
| `products_update_self` lets user rewrite `seller_id`/`featured`/`seller_verified` | Listing theft, free featured, fake trust badge | `WITH CHECK (auth.uid()=seller_id)` + column trigger |
| `products_insert_self` accepts client `featured`/`seller_verified`/`views` | Free paid placement, faked verification | `BEFORE INSERT` trigger forcing safe defaults + deriving seller snapshot |
| Demo admin `admin@cabofeira.cv / admin123` in prod | Trivial admin login | Delete/rotate; scrub from repo + git history |
| Storage accepts any file type/size server-side | Stored XSS (SVG/HTML), storage DoS | Bucket mime/size limits + extension whitelist |
| Public listings expose `seller_phone`/`seller_email` | Bulk PII harvesting, off-platform phishing | Gate contact behind auth / reveal-on-action |
| Unvalidated login `redirect` param | Open redirect / phishing | Allowlist in-app paths |
| Stale Realtime channel keyed to old user ID | Cross-account message leakage | Teardown on user change + logout |
| No FORCE RLS / definer bypass on new helpers | Silent RLS bypass | Audit new definer funcs; minimal grants; pinned search_path |
| No admin audit log | Unaccountable moderation, no abuse forensics | `admin_actions` table logging all admin mutations |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No buyer-safety/anti-scam guidance | Buyers fall for advance-payment scams; trust erodes | Inline "never pay in advance, meet in public" notices on listing/message |
| Free-text-only report reason | Reports unactionable; abuse hard to triage | Structured reason dropdown + dedupe |
| Stale feed (deleted/sold items shown) | Wasted contact attempts, distrust | TTL/refetch; detail page fetches fresh |
| i18n silent fallback to key string | pt-CV users see English or raw keys | Dev-mode missing-key check; verify both `en.json` + `pt-cv.json` |
| Contact reveal with no friction | Sellers spammed off-platform | Reveal phone only to authed users / behind messaging |
| No listing expiry/renewal | Stale "sold" listings clutter results | Expiry + renewal (Features candidate) |

## "Looks Done But Isn't" Checklist

- [ ] **RLS UPDATE policies:** present and self-edit works — but verify a normal account *cannot* set `role`, `verified`, `seller_id`, `featured`, `seller_verified` via a raw `supabase-js` update.
- [ ] **Listing insert:** form works — but verify a raw insert *cannot* set `featured=true`/`seller_verified=true`/inflated `views`.
- [ ] **Storage upload:** images upload — but verify a raw `storage.upload` of a `.svg`/`.html`/50MB file is **rejected** server-side.
- [ ] **Admin gating:** admin panel hidden from non-admins in UI — but verify admin-only tables (`reports` update, `app_settings` write) reject non-admin **API** calls.
- [ ] **Messaging privacy:** you see your chats — but verify a third party *cannot* `select` a conversation/messages they don't participate in.
- [ ] **Realtime:** messages arrive live — but verify channels are removed on unmount/logout and you stop receiving events for left conversations.
- [ ] **Demo accounts:** removed from prod — verify `admin123`/`user123` no longer authenticate.
- [ ] **Secrets:** `.env.local` git-ignored — verify no key/service-role/password is in git history.
- [ ] **Redirect:** login redirect works — verify `redirect=//evil.com` and `redirect=https:evil.com` are refused.
- [ ] **Advisors:** Supabase Security + Performance Advisors show **zero** open security findings.
- [ ] **i18n:** every new string exists in **both** `en.json` and `pt-cv.json` (no silent fallback).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Privilege escalation already exploited (rogue admin) | HIGH | Reset all `role`/`verified` for non-sanctioned accounts; rotate; add `WITH CHECK`+trigger; audit `admin_actions` once it exists |
| Demo admin used to tamper | HIGH | Delete account, audit recent admin actions, force password resets, then patch policies |
| Listings stolen via `seller_id` rewrite | MEDIUM | Restore `seller_id` from backup/logs; add `WITH CHECK`; notify affected sellers |
| Free "featured"/"verified" granted | MEDIUM | Reset flags to false for non-paid/non-verified; add insert trigger |
| Malicious file in public bucket (SVG XSS) | MEDIUM | Purge object, set bucket mime/size limits, serve via image-render endpoint, review who was served it |
| Realtime cross-user leak | MEDIUM | Patch teardown, force re-auth/session refresh; assess exposed message content |
| Stale-cache "ghost" listings | LOW | Add TTL/refetch; invalidate cache; ensure removed listings 404 on direct nav |
| Open redirect abused | LOW | Add allowlist; the bug is stateless so the fix fully closes it |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Thrust/Phase | Verification |
|---------|-------------------------|--------------|
| 1. UPDATE no `WITH CHECK` (profiles + products) | **Security** (RLS hardening) | Normal account fails to escalate role / steal listing via raw API |
| 2. INSERT mass-assignment (featured/verified) | **Security** (RLS hardening) | Raw insert with `featured=true` is forced to false |
| 3. Demo admin backdoor | **Security** (launch gate) | `admin123` no longer authenticates; not in git history |
| 4. `security definer` / search_path / grants | **Security** (function audit) | Advisors clean; every definer func pins search_path |
| 5. Storage type/size + orphans | **Security** + **Correctness** | Non-image/oversized upload rejected; sweep job runs |
| 6. Open redirect | **Security** (quick win) | `//evil.com` redirect refused |
| 7. Realtime channel leaks / cross-user | **Correctness** (+Security) | Channels removed 1:1; no events after leaving conversation |
| 8. Cross-user cache staleness | **Correctness** | Deleted/edited listing propagates within seconds; detail fetches fresh |
| 9. View-count RPC unthrottled | **Correctness/Security** | Repeated calls capped per session/window |
| 10. Trust & safety (reports/rate-limit/audit/contact) | **Features** + **Security** | Structured reports live; posting/msg rate-limited; `admin_actions` populated |
| 11. API-is-the-attack-surface QA method | **Security** (methodology) | Security verified via direct API calls, not just UI clicks |

## Sources

- `cabofeira/supabase/schema.sql`, `storage_product_images.sql`, `messages.sql`, `reports.sql`, `app_settings.sql`, `delete_account.sql` — read directly; HIGH confidence on the concrete RLS holes.
- `.planning/codebase/CONCERNS.md`, `INTEGRATIONS.md`, `PROJECT.md` — known bugs, fragile areas, milestone goals.
- [Supabase Docs — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) (USING vs WITH CHECK; UPDATE needs both).
- [Supabase Docs — Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security).
- [Supabase Docs — Securing your API](https://supabase.com/docs/guides/api/securing-your-api) and [Database Advisors](https://supabase.com/docs/guides/database/database-advisors).
- [Supabase RLS: Common Mistakes & CVE-2025-48757 Breakdown — vibeappscanner](https://vibeappscanner.com/supabase-row-level-security) (RLS misconfig / `select auth.uid()` trap).
- [Harden Your Supabase: Lessons from Real-World Pentests — Pentestly](https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide) (security definer, FORCE RLS, function grants, search_path).
- [Supabase RLS Best Practices — MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) (role-hierarchy escalation prevention via WITH CHECK + triggers).
- [How fraudsters misuse marketplaces — Sift](https://sift.com/blog/how-fraudsters-misuse-and-abuse-marketplaces/), [DataDome marketplaces/classifieds](https://datadome.co/solutions/online-marketplaces-classifieds-industry/), [Incognia marketplace fraud](https://www.incognia.com/industries/marketplace-apps) (fake listings, duplicate-image detection, account/contact abuse).

---
*Pitfalls research for: online classifieds marketplace (CaboFeira) on React 19 + Supabase*
*Researched: 2026-06-07*
