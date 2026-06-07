# Architecture Research

**Domain:** Online classifieds marketplace (Cape Verde, "CaboFeira") — adding new features + security hardening onto React 19 Context + Supabase RLS
**Researched:** 2026-06-07
**Confidence:** HIGH

This is a *subsequent-milestone* architecture study, not a greenfield survey. The recommended architecture is **the existing one, extended** — no rewrite. Every new feature maps onto the established three-layer shape: a per-domain React Context provider (state + Supabase queries + custom hook) talking to RLS-enforced Postgres tables, with security-definer RPCs for any write that needs to bypass RLS under controlled conditions, realtime for live UI, and pg_cron for time-based work. The codebase already contains textbook examples of every pattern the new features need (see "Existing Patterns to Reuse").

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          React 19 SPA (Browser)                           │
│  Pages / Components                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐  │
│  │ Auth     │ │ Products │ │ Messages     │ │ NEW: Reviews │ │ NEW:   │  │
│  │ Context  │ │ Context  │ │ Context      │ │ Context      │ │ Notif. │  │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ └──────┬───────┘ └───┬────┘  │
│       │ NEW: SavedSearches Context, Moderation (admin) Context    │       │
│       └────────────┴──────────────┴────────────────┴─────────────┘       │
│                              │ @supabase/supabase-js (anon key + JWT)     │
└──────────────────────────────┼────────────────────────────────────────────┘
                               │
        ┌──────────────────────┼───────────────────────────┐
        ▼                      ▼                            ▼
┌────────────────┐   ┌──────────────────────┐   ┌────────────────────┐
│ Supabase Auth  │   │ Supabase Postgres    │   │ Supabase Storage   │
│ (auth.users)   │   │  RLS on every table  │   │ product-images     │
└────────────────┘   │  ┌────────────────┐  │   │ (path = uid/...)   │
                     │  │ SECURITY       │  │   └────────────────────┘
                     │  │ DEFINER RPCs   │  │
                     │  │ (controlled    │  │   ┌────────────────────┐
                     │  │  RLS bypass)   │  │   │ pg_cron (NEW)      │
                     │  └────────────────┘  │   │ expiry / digest    │
                     │  Triggers (rating    │   └─────────┬──────────┘
                     │  rollup, audit, notif│             │ (calls RPC or
                     │  fan-out)            │◄────────────┘  Edge Function)
                     │  Realtime publication│
                     └──────────┬───────────┘
                                │ postgres_changes (notifications, reviews)
                                ▼
                         Browser live UI
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Context provider (per domain)** | Owns state cache, Supabase queries, realtime subscription, custom hook | `src/context/XContext.jsx` exporting `<XProvider>` + `useX()` (existing convention) |
| **RLS policy** | First line of authz — who can `select/insert/update/delete` each row | `create policy` per command, predicate on `auth.uid()` / `public.is_admin()` |
| **SECURITY DEFINER RPC** | Controlled RLS bypass for writes that need elevated rights but must enforce their own check (e.g. "increment rating only via verified path") | `create function ... security definer set search_path = public`, internal `auth.uid()` check, `grant execute to authenticated` only |
| **Trigger** | Derived/denormalized data kept consistent server-side (rating rollups, audit rows, notification fan-out, `last_message_at`) | `after insert/update` row trigger calling a plpgsql function |
| **Realtime publication** | Push new rows to subscribed browsers (notifications, reviews, reports) | `alter publication supabase_realtime add table public.X` |
| **pg_cron job** | Time-based work with no user trigger (expire listings, send daily digest) | `cron.schedule(...)` calling a SECURITY DEFINER RPC (or Edge Function via `net.http_post`) |
| **Edge Function** | Only when work needs secrets / external HTTP (transactional email for alerts) — NOT for in-DB logic | Deno function with service-role key, invoked by cron or DB webhook |

## Recommended Project Structure

New code follows the existing convention exactly (verified against STRUCTURE.md "Where to Add New Code"). No new top-level folders.

```
cabofeira/
├── src/
│   ├── context/
│   │   ├── ReviewsContext.jsx       # NEW: ratings/reviews + seller reputation reads
│   │   ├── SavedSearchesContext.jsx # NEW: saved searches CRUD + alert prefs
│   │   ├── NotificationsContext.jsx # NEW: unread notif feed + realtime subscription
│   │   └── (Auth/Products/Messages/Pricing unchanged)
│   ├── pages/
│   │   ├── Notifications.jsx         # NEW: notification center route
│   │   ├── SavedSearches.jsx         # NEW: manage saved searches/alerts
│   │   └── Admin.jsx                 # EXTEND: moderation queue + audit-log tabs
│   ├── components/
│   │   ├── ReviewForm.jsx / StarRating.jsx / ReviewList.jsx   # NEW
│   │   └── NotificationBell.jsx      # NEW (lives in Navbar)
│   └── i18n/ en.json + pt-cv.json    # EXTEND: every new string in BOTH
└── supabase/
    ├── reviews.sql                   # NEW: reviews table + rollup trigger + RLS
    ├── saved_searches.sql            # NEW: saved_searches table + RLS
    ├── notifications.sql             # NEW: notifications table + RLS + realtime + fan-out triggers
    ├── moderation.sql                # NEW: extend reports + report_reasons enum/check
    ├── listing_expiry.sql            # NEW: products.expires_at + renew RPC + pg_cron job
    ├── audit_log.sql                 # NEW: admin_audit_log table + log helper RPC
    └── security_hardening.sql        # NEW: fix profiles role-escalation, column-grants, FORCE RLS audit
```

### Structure Rationale

- **One `.sql` file per feature, idempotent:** Matches the existing manual-migration reality (no runner). Each file uses `create table if not exists` / `drop policy if exists ... create policy` so it can be re-run safely in the SQL editor — exactly how the current files (`reports.sql`, `messages.sql`) are written. Build order is the file order above.
- **One Context per feature domain:** Keeps the established "feature domain = provider + hook" boundary. Admin-only domains (moderation, audit) extend `Admin.jsx` rather than spawning a global provider, since they aren't needed app-wide.
- **Security fixes isolated in `security_hardening.sql`:** The hardening thrust is a distinct gate (per PROJECT.md sequencing). Keeping it in one file makes the security review auditable as a unit.

## Architectural Patterns

### Pattern 1: Per-domain Context + RLS-backed table (the spine)

**What:** Each feature = a Postgres table with RLS + a React Context that wraps Supabase queries and exposes a `useX()` hook. The client *only ever uses the anon key + the user's JWT*; RLS is the authorization boundary, never client-side checks.
**When to use:** Every new feature (reviews, saved searches, notifications).
**Trade-offs:** + Consistent, testable, no backend tier to deploy. − Complex authz lives in SQL predicates, which are easy to get subtly wrong (mitigated by Pattern 4).

**Example (Reviews context query — same shape as existing `fetchProducts`):**
```javascript
// ReviewsContext.jsx
const { data, error } = await supabase
  .from('reviews')
  .select('id, rating, comment, created_at, author:profiles!author_id(name, avatar)')
  .eq('seller_id', sellerId)
  .order('created_at', { ascending: false });
// RLS guarantees only public-readable reviews come back; no client filter needed.
```

### Pattern 2: SECURITY DEFINER RPC for controlled writes (the airtight-auth pattern)

**What:** A write that must bypass RLS (because the caller shouldn't have direct UPDATE rights) is wrapped in a `security definer` function that (a) sets `search_path = public`, (b) re-derives identity from `auth.uid()` internally, (c) raises on non-participants, and (d) is granted `execute` **only to `authenticated`**, never `anon`/`public`.
**When to use:** "Mark notification read", "renew my listing", "leave a review only if I had a conversation with this seller", "write an audit row".
**Trade-offs:** + The function is the single chokepoint for the operation — easy to review, no policy sprawl. − Must be written carefully; the function's body *is* the security boundary.

**Example — the codebase already does this correctly (`mark_conversation_read`, `delete_my_account`). New ones follow the same template:**
```sql
create or replace function public.renew_listing(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- identity re-derived from JWT, NOT passed in by client
  if not exists (select 1 from public.products
                 where id = p_product_id and seller_id = auth.uid()) then
    raise exception 'Not your listing';
  end if;
  update public.products
     set expires_at = now() + interval '30 days', status = 'active'
   where id = p_product_id;
end;
$$;
revoke all on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;
```

### Pattern 3: Trigger-driven derived data (reputation rollups, notification fan-out)

**What:** Keep aggregates and side-effects in the database via `after insert/update` triggers, so the client can't forge them and every write path is covered. Seller rating average is a column on `profiles` updated by a trigger on `reviews`; a new message / new-matching-listing inserts a row into `notifications` via a trigger.
**When to use:** Any value derived from another table that must stay consistent regardless of which client wrote it (mirrors the existing `bump_conversation_last_message` trigger).
**Trade-offs:** + Single source of truth, no race between clients, cheap reads. − Trigger logic is invisible to frontend devs; document it. Recompute-on-write must be O(small) or use incremental math.

**Example:**
```sql
-- After a review insert/update/delete, recompute the seller's rollup.
create or replace function public.refresh_seller_rating()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles p set
    rating_avg = sub.avg, rating_count = sub.cnt
  from (select round(avg(rating)::numeric, 2) avg, count(*) cnt
        from public.reviews where seller_id = coalesce(new.seller_id, old.seller_id)) sub
  where p.id = coalesce(new.seller_id, old.seller_id);
  return null;
end; $$;
```

### Pattern 4: Defense-in-depth authz checklist (apply to every new table)

**What:** A repeatable 6-point check, derived from current Supabase security guidance, applied to each new SQL file:
1. `enable row level security` on the table (and consider `force row level security` for tables only ever touched via RPC).
2. A policy for **each** of select/insert/update/delete — never leave a command unpoliced (default-deny only protects if RLS is enabled).
3. `with check` on insert **and** update so users can't move a row to someone else's `user_id`.
4. Restrict **mutable columns**: RLS is row-level, not column-level. Privilege-relevant columns (`role`, `verified`, `rating_avg`, `status`) must be protected by `revoke update (col)` grants or by routing writes through a definer RPC — see the critical fix below.
5. SECURITY DEFINER functions: `set search_path = public`, `revoke from public/anon`, `grant execute to authenticated`, and re-derive identity from `auth.uid()` inside.
6. Wrap `auth.uid()` in policies as `(select auth.uid())` for performance at scale (Supabase-recommended; evaluates once per query, not per row).
**When to use:** Mandatory for every table in this milestone.
**Trade-offs:** Pure upside; it's a discipline, not a cost.

## Data Flow

### Request Flow (new-feature write, e.g. leaving a review)

```
[User submits ReviewForm]
   ↓
[ReviewsContext.addReview()]  →  supabase.rpc('add_review', {...})   (anon key + JWT)
   ↓                                  ↓
[optimistic local insert]      [SECURITY DEFINER RPC]
   ↓                                  ↓  checks: caller had a conversation w/ seller,
[StarRating re-renders]              ↓          hasn't already reviewed → insert row
                                      ↓
                              [trigger refresh_seller_rating] → profiles.rating_avg updated
                                      ↓
                              [realtime] → seller's NotificationsContext gets "new review" row
```

### State Management (unchanged shape, new providers)

```
[Supabase table + realtime]
        ↓ (subscribe in provider useEffect)
[XContext state] ←→ [useX() hook] → [Pages/Components]
        ↑ (mutations)        ↓ (RPC / table write via supabase-js)
[RLS + DEFINER RPC enforce authz before anything lands]
```

### Key Data Flows

1. **Notifications (fan-out + feed):** A domain event (new message, listing matched a saved search, review received, moderation decision) fires a trigger that inserts into `notifications(user_id, type, payload, read_at)`. `notifications` is in the realtime publication; `NotificationsContext` subscribes to `postgres_changes` filtered to `user_id = me` and updates the bell badge live — identical mechanism to the existing Messages realtime, so no new infrastructure.
2. **Saved-search alerts:** `SavedSearchesContext` writes the user's query (category/island/price/keyword) to `saved_searches`. Alerting runs server-side: on `products` insert, a trigger (or a pg_cron batch job for scale) matches the new listing against stored searches and inserts a `notifications` row per match. Email delivery (if desired) is an **Edge Function** invoked by cron, because it needs an email-provider secret — the only justified Edge Function in this milestone.
3. **Listing expiry/renewal:** `products` gains `status` + `expires_at`. A daily **pg_cron** job calls a SECURITY DEFINER RPC that flips overdue `active` rows to `expired` (and can insert an "about to expire" notification). The seller's `renew_listing` RPC (Pattern 2) resets the clock. Browse/search queries add `where status = 'active'` (or expired rows are hidden by an RLS `select` predicate so no client can forget the filter).
4. **Moderation:** Extends existing `reports`. Add a `report_reasons` check/enum for structured reasons, plus moderation actions (hide listing, warn user) recorded through definer RPCs that also write an audit row (flow 5). Admin queue reads via existing `is_admin()` policies; realtime already enabled on `reports`.
5. **Admin audit log:** Every privileged action (role change, listing removal, report resolution, user verification) is written to `admin_audit_log(actor_id, action, target_type, target_id, before, after, created_at)` from inside the definer RPC that performs the action — so the log can't be bypassed by hitting the table directly. `admin_audit_log` is select-only for admins, insert only via definer RPC, **no** update/delete policy (append-only).

## Build Order & Dependencies

Order the roadmap phases to respect these hard dependencies (the security fix is sequenced last per PROJECT.md, but the *role-escalation* sub-fix is a prerequisite for anything that adds privilege-relevant columns):

```
0. security_hardening.sql (role/verified escalation fix)   ← do FIRST in the hardening thrust,
   ── but the column-protection PATTERN must be applied as each new table lands
1. notifications.sql        (table + realtime + generic fan-out helper)
        ↑ depended on by →  reviews, saved_searches, moderation, expiry  (all emit notifications)
2. reviews.sql             (needs: notifications; adds profiles.rating_* cols + trigger)
3. saved_searches.sql      (needs: notifications; match-on-insert trigger or cron)
4. listing_expiry.sql      (needs: products.status/expires_at; cron + renew RPC; emits notifications)
5. moderation.sql          (extends reports; needs audit_log RPC)
6. audit_log.sql           (needs: nothing; but every admin RPC in 4–5 should call it →
        practically: create audit_log BEFORE wiring moderation RPCs)
7. security_hardening.sql (remainder: FORCE RLS audit, storage policy review, demo-account removal,
        column-grant sweep across ALL new tables, open-redirect/upload validation client-side)
```

**Dependency notes for the roadmap:**
- **`notifications` is the keystone** — build it first among features; reviews/saved-search/expiry/moderation all fan out into it.
- **`audit_log` before moderation RPCs** — moderation actions must be auditable from day one; create the audit table and `log_admin_action()` helper before writing the moderation definer functions.
- **Role-escalation fix is independent and urgent** — it doesn't block features but is the single highest-severity hole; land it early even though the broader hardening pass is sequenced last.
- **pg_cron must be enabled** in the Supabase project (Dashboard → Database → Extensions) before `listing_expiry.sql` and the saved-search digest job will work — flag as a one-time setup step.

## Existing Patterns to Reuse (no invention needed)

| New need | Already in codebase | Reuse |
|----------|--------------------|-------|
| Controlled RLS-bypass write | `mark_conversation_read`, `delete_my_account` | Copy the definer + `auth.uid()` re-check + grant template |
| Admin-only authz without recursion | `public.is_admin()` (SQL, security definer, stable) | Reuse directly in every admin policy |
| Derived-value maintenance | `bump_conversation_last_message` trigger | Same pattern for `refresh_seller_rating`, notification fan-out |
| Live UI updates | Messages/Pricing realtime subscriptions | Same `supabase.channel().on('postgres_changes')` for notifications/reviews |
| Idempotent manual migration | `reports.sql`, `messages.sql` structure | Same `if not exists` / `drop ... create policy` style per new file |
| Realtime opt-in | `alter publication supabase_realtime add table` blocks | Copy the `pg_publication_tables` guard block |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Everything as designed. Triggers + per-insert saved-search matching are fine. pg_cron daily expiry trivial. |
| 1k–100k users | Saved-search match-on-every-insert can get heavy → move matching to a **batched pg_cron job** (every 15 min) instead of an insert trigger. Add the `(select auth.uid())` policy optimization and indexes on `notifications(user_id, read_at)`, `reviews(seller_id)`, `products(status, expires_at)`. |
| 100k+ users | Notification feed grows unbounded → add a retention cron (delete read notifications > 90 days). Consider an Edge Function queue for email fan-out rather than synchronous cron. Realtime channel count is the likely first real ceiling. |

### Scaling Priorities

1. **First bottleneck — saved-search matching:** Per-product-insert trigger that scans all saved searches. Fix by batching via cron and indexing the saved-search predicates. Design `saved_searches` columns (category, island, price bounds) as discrete columns now so they're indexable later.
2. **Second bottleneck — notifications table growth + realtime fan-out:** Add `(user_id, read_at)` index from the start; add retention cleanup when volume warrants.

## Anti-Patterns

### Anti-Pattern 1: Trusting the client for authorization (the existing role-escalation bug)

**What people do:** Let the client write privilege-relevant columns through a broad row policy. The current `profiles_update_self` policy (`schema.sql:126`) allows `update using (auth.uid() = id)` with **no column restriction**, so any user can `update profiles set role='admin', verified=true where id = me`. This is the project's top security hole.
**Why it's wrong:** RLS is row-level, not column-level — a row-ownership policy says nothing about *which columns* may change. Same trap applies to every new privilege column (`rating_avg`, listing `status`, report `status`).
**Do this instead:** Strip privilege columns out of the self-update path. Either (a) `revoke update (role, verified) on public.profiles from authenticated;` and grant those updates only to a definer RPC / admin policy, or (b) route all role/verify changes through an admin-only SECURITY DEFINER RPC that writes an audit row. Apply this column-protection rule to every new table (Pattern 4, point 4).

### Anti-Pattern 2: SECURITY DEFINER without `search_path`, grant-scoping, or an internal identity check

**What people do:** Mark a function `security definer` to "make it work with RLS" and pass `user_id` as a parameter, leaving it executable by `public`.
**Why it's wrong:** Without `set search_path`, an attacker can shadow a referenced object; executable-by-`public` exposes it at the REST edge to anon; trusting a passed-in `user_id` lets any caller act as anyone. A definer function *is* a deliberate RLS bypass — its body is the only thing protecting the data.
**Do this instead:** Always `set search_path = public`, derive identity from `auth.uid()` inside (never trust parameters for identity), `revoke ... from public, anon` and `grant execute ... to authenticated`. The existing `mark_conversation_read` is the correct template — copy it.

### Anti-Pattern 3: Reaching for an Edge Function or a new service for in-database logic

**What people do:** Build a Node/Edge backend tier for ratings rollups, expiry, or notification fan-out.
**Why it's wrong:** It breaks the "Supabase-only, Context-driven" architecture the project mandates (no rewrite), adds a deploy target, and splits the security model across two places. All of this logic belongs in triggers, RPCs, and pg_cron.
**Do this instead:** Keep logic in Postgres (triggers/RPCs/cron). Reserve Edge Functions for the *single* thing they're uniquely needed for: outbound HTTP with a secret (transactional email for saved-search alerts). Everything else stays in the database.

### Anti-Pattern 4: Computing state from timestamps instead of explicit status (carrying over a known bug)

**What people do:** Infer "unread" from `last_read_at` comparisons (the existing MessagesContext anti-pattern noted in the codebase map) and would repeat it for notifications/expiry.
**Why it's wrong:** Clock skew and edits make threshold math wrong.
**Do this instead:** Notifications carry an explicit nullable `read_at`; listings carry an explicit `status`. Read/expired state is a column, set by an RPC or cron, not derived on the client.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres | Anon key + user JWT via `supabase-js`; RLS is the boundary | Never use service-role key in the SPA. |
| Supabase Realtime | `postgres_changes` subscription in each provider | Add new tables to `supabase_realtime` publication; filter to `user_id` to avoid leaking. |
| Supabase Storage | Path = `<uid>/...`, RLS on `storage.objects` (already correct) | Image-upload validation must also be tightened client-side (hardening thrust). |
| pg_cron | `cron.schedule()` → SECURITY DEFINER RPC | Must enable extension first; jobs visible in `cron.job_run_details`. |
| Email provider (optional) | Edge Function invoked by cron, service-role + provider secret | Only justified Edge Function; defer if email alerts are cut from MVP. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Context ↔ Postgres | `supabase-js` query / `.rpc()` | Mutations that touch privilege columns go through RPC, not direct table write. |
| Trigger ↔ table | In-DB, synchronous | Keep trigger bodies O(small); heavy matching → cron. |
| cron ↔ RPC/Edge Function | `cron.schedule` calls SQL or `net.http_post` | Expiry = pure SQL RPC; email = Edge Function. |
| Admin UI ↔ moderation/audit | Admin-only RLS + definer RPCs that auto-write audit rows | Audit log is append-only (no update/delete policy). |

## Sources

- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS fundamentals, `(select auth.uid())` performance pattern (HIGH)
- [Securing your API | Supabase Docs](https://supabase.com/docs/guides/api/securing-your-api) — definer functions, exposed-schema risk, grant scoping (HIGH)
- [RLS Performance and Best Practices | Supabase Docs](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — wrap-auth-uid, per-command policies (HIGH)
- [Supabase RLS Best Practices for Multi-Tenant Apps (makerkit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — `has_more_elevated_role`, privilege-escalation prevention (MEDIUM)
- [Supabase RLS SECURITY DEFINER: Preventing Infinite Recursion (dev.to)](https://dev.to/kanta13jp1/supabase-rls-security-definer-preventing-infinite-recursion-in-admin-policies-4go2) — recursion break via definer helper, matches existing `is_admin()` (MEDIUM)
- [Harden Your Supabase: Lessons from Real-World Pentests (pentestly.io)](https://www.pentestly.io/blog/supabase-security-best-practices-2025-guide) — FORCE RLS, definer-as-silent-bypass warning (MEDIUM)
- [pg_cron / Supabase Cron | Supabase Docs](https://supabase.com/docs/guides/cron) — scheduling expiry/digest jobs, `cron.job_run_details` (HIGH)
- [Scheduling Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/schedule-functions) — cron → Edge Function for email fan-out (HIGH)
- Existing codebase (HIGH, authoritative for "what already works"): `supabase/schema.sql` (is_admin, role-escalation hole), `messages.sql` (trigger + participant RLS), `messages_unread.sql` & `delete_account.sql` (definer RPC templates), `reports.sql`/`app_settings.sql` (realtime opt-in pattern), `storage_product_images.sql` (path-scoped storage RLS)

---
*Architecture research for: classifieds marketplace feature/security extension on React Context + Supabase RLS*
*Researched: 2026-06-07*
