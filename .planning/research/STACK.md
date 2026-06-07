# Stack Research

**Domain:** Online classifieds marketplace (Cape Verde, "CaboFeira") — pre-launch feature-completion + security hardening
**Researched:** 2026-06-07
**Confidence:** HIGH (stack is fixed; recommendations verified against current Supabase docs and live npm versions)

> **Scope note (read first):** The core stack is FIXED and must not be replaced — React 19.1, React Router 7.6, `@supabase/supabase-js` 2.105, Create React App tooling, vanilla CSS, react-icons, React Context (no TypeScript, no Redux/Zustand). This document does **not** re-litigate those choices. It recommends the **smallest set of additive libraries** plus **Supabase-native features** (Edge Functions, pg_cron, triggers, RLS, full-text search) needed to add the missing marketplace features and harden the app. The governing principle pre-launch is **prefer Supabase-native capabilities over new npm dependencies** to avoid stack churn.

---

## Strategy: Supabase-native first, npm dependency second

For each missing capability, the decision rule is:

1. **Can Postgres / Supabase do it natively?** (triggers, RLS, pg_cron, full-text search, Storage transforms) → do that, zero new client deps.
2. **Does it need server-side compute or a 3rd-party API (email, push)?** → Supabase **Edge Function** (Deno, no client dep) + a thin provider SDK that runs *in the function*, not in the React bundle.
3. **Is it purely client-side UX (forms, toasts, compression, sanitization)?** → add a small, well-maintained npm library.

This keeps the React bundle lean and pushes security-sensitive logic server-side where the anon key can't be abused.

---

## Recommended Stack

### Supabase-native features (zero new npm dependencies — use these first)

| Capability | Native feature | Purpose | Why it fits this stack |
|------------|---------------|---------|------------------------|
| Full-text listing search | **Postgres FTS** — generated `tsvector` column + GIN index, queried via `.textSearch()` in supabase-js | Replace/augment the current `ilike` keyword search with ranked, language-aware search | Already in supabase-js; no Elasticsearch/Algolia needed at this scale. Add a `search_vector` generated column over title+description, GIN index, weight title higher. **HIGH** |
| Fuzzy / typo-tolerant search | **`pg_trgm`** extension + trigram index | Partial-word and misspelling tolerance on top of FTS | Single `CREATE EXTENSION`; complements FTS for short queries and city/island names. **HIGH** |
| Listing expiry / renewal | **`pg_cron`** scheduled SQL job | Auto-expire listings past N days; flag for renewal | Native scheduler in hosted Supabase; a daily job sets `status='expired'`. No external worker. **HIGH** |
| Saved-search alerts & email digests | **`pg_cron` → Edge Function** (via `pg_net` / `net.http_post`) | Periodically match new listings against saved searches and trigger emails | Cron runs SQL that calls an Edge Function to send mail. Standard Supabase pattern. **HIGH** |
| In-app notifications | **`notifications` table + Realtime subscription** + INSERT triggers | New message / report-resolved / listing-expiring / saved-search-hit feed with unread badge | Reuses the exact Realtime pattern already in `MessagesContext.jsx`. Triggers write rows; client subscribes. **HIGH** |
| Ratings / reviews & seller reputation | **`reviews` table + RLS + aggregate (view or trigger-maintained column)** | Buyer rates seller after contact; seller avg rating shown on profile | Pure schema + RLS; aggregate rating via a `SECURITY DEFINER` function or maintained column. No new deps. **HIGH** |
| Structured moderation & report reasons | **`report_reason` enum + `reports` workflow columns (status, resolved_by, resolution_note)** | Replace free-text reports with categorized, auditable moderation queue | Schema change only; admin UI already exists in `Admin.jsx`. **HIGH** |
| Admin audit logging | **`audit_log` table + triggers (or explicit inserts in `SECURITY DEFINER` admin RPCs)** | Record every admin action (role change, verify, ad removal, price change) | Closes a stated security gap; Postgres triggers capture who/what/when immutably. **HIGH** |
| Rate limiting (auth) | **Supabase Auth built-in rate limits + Attack Protection** (dashboard) | Throttle signup/login/password-reset abuse | Already available; just enable + tune in dashboard. **HIGH** |
| Rate limiting (writes: post-ad, report, message, review) | **Postgres-side throttle** — `SECURITY DEFINER` RPC that checks a per-user count in a time window before inserting | Stop spam listings / report-bombing / message floods | PostgREST/RLS does **not** rate-limit DB writes natively (verified — see Sources). Enforce in a wrapper function. No external service needed at launch scale. **MEDIUM** |
| Privilege-escalation fix | **Column-restricted RLS / `SECURITY DEFINER` RPC for role+verified** | Block users self-setting `role`/`verified` (stated hole, `schema.sql:126`) | Native RLS; split profile update so privileged columns are admin-RPC-only. **HIGH** |

### Supporting npm libraries (add only these)

| Library | Version | Purpose | When to use / why it fits |
|---------|---------|---------|----------------------------|
| **react-hook-form** | **7.77.0** | Form state + validation for PostAd, reviews, profile, saved-search forms | Uncontrolled-input model = minimal re-renders, tiny (~9kB), no Context churn. The existing multi-step PostAd form is exactly its sweet spot. **HIGH** |
| **zod** | **4.4.3** | Shared validation schemas (client form rules + reused inside Edge Functions) | One schema validates in the browser *and* in Deno Edge Functions — closes the "client-only validation" security gap. Pairs with react-hook-form via `@hookform/resolvers`. **HIGH** |
| **browser-image-compression** | **2.0.2** | Client-side resize/compress images before Storage upload | **Avoids paying for Supabase Storage Image Transformations (Pro-plan-only, $5 per 1000 origin images — verified).** Compresses 5MB phone photos to ~200–500kB in-browser, cutting Storage cost and Cape Verde mobile bandwidth. Worker-based, no UI freeze. **HIGH** |
| **isomorphic-dompurify** | **2.x** (DOMPurify 3.4.x) | Sanitize any user-rendered HTML / rich text (listing descriptions, messages) | XSS hardening for the security thrust. `isomorphic` build works in both browser and Edge Function. Only needed if any field is rendered as HTML; if everything is plain-text-escaped by React, this is optional. **MEDIUM** |
| **react-hot-toast** | **2.6.0** | Lightweight toast notifications for actions (saved, error, alert created) | ~5kB, zero-config, fits in-app notification UX without a heavy UI kit. Optional if you build toasts in vanilla CSS. **LOW/optional** |
| **@hookform/resolvers** | latest (peer of react-hook-form) | Bridge zod schemas into react-hook-form | Only if combining the two above. Trivial dep. **HIGH (if using rhf+zod)** |

### Server-side (Edge Function) dependencies — live in Deno functions, NOT the React bundle

| Library | Version | Purpose | Why here, not client |
|---------|---------|---------|----------------------|
| **resend** (Resend SDK) | **4.4.0** | Send transactional + digest email (welcome, saved-search alerts, report updates, password flows beyond auth defaults) | Supabase **officially lists Resend** as recommended; permanent free tier (better for low-volume CV launch than SendGrid, whose free tier was retired May 2025). Called from an Edge Function so the API key never touches the client. **HIGH** |
| **react-email** / **@react-email/components** | **6.5.0 / 1.0.12** | Author email templates as JSX, render to HTML inside the function | Optional but ergonomic; lets the team write emails in familiar JSX. Skip if plain HTML strings suffice. **LOW/optional** |

> Configure Resend **also** as the custom SMTP provider in Supabase Auth settings so auth emails (confirmation, password reset) and transactional emails share one deliverability-reputable sender.

### Development tools (no stack change)

| Tool | Purpose | Notes |
|------|---------|-------|
| **Supabase CLI** | Manage Edge Functions, local function dev, secrets | Needed to deploy Edge Functions and store the Resend key as a function secret. Does not alter the CRA app. |
| **Supabase Vault** | Store cron/Edge-Function auth tokens & API keys server-side | Recommended pattern for pg_cron → Edge Function auth (verified). |
| ESLint `react-app` (existing) | Keep current config | No new lint/test tooling — matches "manual QA" milestone decision. |

---

## Installation

```bash
# Client (React bundle) — the only additions to the SPA
npm install react-hook-form@7.77.0 zod@4.4.3 @hookform/resolvers \
            browser-image-compression@2.0.2

# Optional client polish
npm install react-hot-toast@2.6.0 isomorphic-dompurify@2

# Edge Function deps (declared in the function, e.g. via npm: / esm.sh in Deno) — NOT installed into the CRA app
# resend@4.4.0  +  optionally @react-email/components@1.0.12 / react-email@6.5.0
```

```sql
-- Supabase-native enablement (run in SQL editor, ship as new files in cabofeira/supabase/)
create extension if not exists pg_trgm;
create extension if not exists pg_cron;
create extension if not exists pg_net;   -- for cron -> Edge Function HTTP calls
-- + generated tsvector column, GIN indexes, notifications/reviews/audit_log tables,
--   cron jobs, throttle RPCs, and the role/verified RLS fix.
```

---

## Alternatives Considered

| Recommended | Alternative | When the alternative would win |
|-------------|-------------|--------------------------------|
| Postgres FTS + pg_trgm | Algolia / Elasticsearch / Typesense | Only at 100k+ listings or needing instant-as-you-type federated search. Massive overkill + new infra for a CV launch. Stay native. |
| browser-image-compression (client) | Supabase Storage Image Transformations | Use Supabase transforms **only after** moving to Pro plan and if you need on-the-fly variants (thumbnails). It is billed per origin image; client compression is free and reduces storage too. They can coexist later. |
| Resend (Edge Function) | SendGrid / Postmark / Amazon SES | SES if email volume becomes very high (cheapest at scale); Postmark for ultra-strict deliverability. SendGrid lost its free tier (2025) — avoid for a budget pre-launch. |
| Postgres-side write throttling | Upstash Ratelimit / Cloudflare WAF | Add Upstash/Cloudflare **post-launch** if you see real abuse traffic. At zero users, an external rate-limit service is premature. Defense-in-depth later, not now. |
| react-hook-form + zod | Formik / plain useState | Formik is heavier and less maintained; plain useState is fine for trivial forms but the 3-step PostAd + new review/saved-search forms justify rhf. |
| In-app `notifications` table + Realtime | Web Push / FCM / OneSignal | Browser/native push is a future-milestone concern (PROJECT.md defers native mobile). In-app + email covers v1. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Any new state library** (Redux, Zustand, Jotai, React Query) | Explicitly out of scope; the app's domain-Context pattern is the convention. React Query is tempting but is a real architectural shift mid-hardening. | Existing React Context providers + Realtime |
| **TypeScript migration** | Out of scope; would balloon the milestone. zod gives you runtime validation without a TS migration. | zod for runtime safety where it matters |
| **Algolia / Elasticsearch / external search infra** | New service, new cost, new failure mode for a search that Postgres handles fine at this scale. | Postgres FTS + pg_trgm |
| **Supabase Storage Image Transformations as the *primary* image pipeline** | Pro-plan-only and billed per origin image (verified) — surprise cost for a budget launch. | browser-image-compression client-side; adopt transforms later for thumbnails on Pro |
| **SendGrid** | Permanent free tier retired May 2025; heavier setup. | Resend (Supabase-recommended, free tier) |
| **Client-side-only validation / trusting the anon key** | The anon key is public; client checks are bypassable — root cause of the privilege-escalation hole. | RLS + `SECURITY DEFINER` RPCs + zod re-validation inside Edge Functions |
| **A CSS/UI framework (Tailwind, MUI, Chakra)** | Vanilla CSS is the convention; introducing a framework pre-launch is churn with no feature payoff. | Keep vanilla CSS; optionally react-hot-toast for one specific UX gap |
| **moment.js** (if any date lib is needed) | Deprecated, large. | Native `Intl` / `date-fns@4.4.0` if a helper is genuinely needed (likely not) |
| **Realtime Broadcast/Presence for notifications** | Postgres-changes subscription is already the proven pattern in the codebase; Broadcast adds a parallel mechanism. | Reuse the existing `postgres_changes` subscription pattern |

---

## Stack Patterns by Variant

**If staying on the Supabase Free plan at launch:**
- Use **browser-image-compression** as the *only* image pipeline (Storage transforms are Pro-only).
- pg_cron, pg_net, Edge Functions, FTS are all available on Free — lean on them.
- Email via Resend free tier is sufficient for low volume.

**If/when upgrading to Supabase Pro:**
- Optionally layer Storage Image Transformations for server-generated thumbnails/variants (keep client compression for upload size).
- Higher Edge Function and Realtime limits ease saved-search digest fan-out.

**If abuse/spam appears post-launch:**
- Add **Cloudflare** in front of the SPA (WAF + bot rules) and/or **@upstash/ratelimit@2.0.8** inside Edge Functions. Treat as defense-in-depth, not a launch blocker.

---

## Version Compatibility

| Package @ version | Compatible with | Notes |
|-------------------|-----------------|-------|
| react-hook-form @ 7.77.0 | React 19.1 | RHF 7.x fully supports React 19. |
| zod @ 4.4.3 | @hookform/resolvers latest | Use the zod resolver; resolvers tracks zod v4. |
| browser-image-compression @ 2.0.2 | Browser + Web Workers | Works in CRA/webpack; runs off main thread. |
| resend @ 4.4.0 | Deno (Edge Function via `npm:resend`) | Run in the function, not the CRA bundle. |
| @supabase/supabase-js @ 2.105 | `.textSearch()`, `.channel()` Realtime, Storage | FTS and Realtime patterns used here are all in 2.x — no client upgrade required. |
| pg_cron / pg_net / pg_trgm | Hosted Supabase Postgres | Enabled via `create extension`; available on Free plan. |

---

## Sources

- https://supabase.com/docs/guides/database/full-text-search — FTS via tsvector/GIN, `.textSearch()` — **HIGH**
- https://supabase.com/blog/postgres-full-text-search-vs-the-rest — FTS vs external engines at scale — **HIGH**
- https://supabase.com/blog/supabase-cron — pg_cron native scheduling — **HIGH**
- https://supabase.com/docs/guides/functions/schedule-functions — cron → Edge Function via pg_net, Vault for tokens — **HIGH**
- https://supabase.com/blog/processing-large-jobs-with-edge-functions — Edge Functions + Cron + Queues pattern — **HIGH**
- https://supabase.com/docs/guides/storage/serving/image-transformations — transforms exist, Pro-plan + billed per origin image — **HIGH**
- https://supabase.com/docs/guides/platform/manage-your-usage/storage-image-transformations — $5 / 1000 origin images pricing — **HIGH**
- https://resend.com/docs/send-with-supabase-edge-functions + https://resend.com/supabase — Supabase-recommended email provider, Edge Function integration — **HIGH**
- https://dreamlit.ai/blog/best-sendgrid-alternatives — SendGrid free tier retired May 27 2025 — **MEDIUM**
- https://supabase.com/docs/guides/auth/rate-limits — built-in auth rate limits / token bucket — **HIGH**
- https://github.com/orgs/supabase/discussions/19493 + /34707 — no native DB-write rate limiting; throttle in-function/DB or via Cloudflare/Upstash — **MEDIUM**
- https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide — RLS hardening, Attack Protection, CVE-2025-48757 (RLS-off exposure) — **MEDIUM**
- npm live versions (verified 2026-06-07): react-hook-form 7.77.0, zod 4.4.3, browser-image-compression 2.0.2, resend 4.4.0, react-email 6.5.0, @react-email/components 1.0.12, react-hot-toast 2.6.0, isomorphic-dompurify 2.x (DOMPurify 3.4.8), @upstash/ratelimit 2.0.8 — **HIGH**

---
*Stack research for: online classifieds marketplace on a fixed React 19 + Supabase + CRA stack*
*Researched: 2026-06-07*
