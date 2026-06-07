# Phase 1: Security Foundation + Keystones - Research

**Researched:** 2026-06-07
**Domain:** PostgreSQL Row-Level Security (RLS), Supabase RLS/Realtime, SECURITY DEFINER functions, git-history secret scrubbing
**Confidence:** HIGH (Postgres/Supabase semantics verified against official docs; SQL snippets mirror existing project files)

## Summary

This is a backend/SQL-only phase. Every change ships as new `.sql` file(s) in `cabofeira/supabase/`, applied manually in the Supabase SQL editor (no migration runner). The work splits into two halves: (1) **harden three RLS holes** on `profiles` and `products` so a normal authenticated account calling supabase-js/curl directly cannot escalate `role`/`verified`, steal a listing via `seller_id` rewrite, or mass-assign `featured`/`seller_verified`/`views`; and (2) **build three keystone structures** — a `products.status` column gated at the RLS-SELECT layer, a `notifications` table + `create_notification()` fan-out + realtime publication, and an append-only `admin_audit_log` + `log_admin_action()` RPC.

The single most important verified fact driving the design: **`WITH CHECK` is enforced AFTER `BEFORE` row triggers fire** [CITED: postgresql.org/docs/current/sql-createpolicy.html]. This means a `BEFORE UPDATE` trigger that resets `NEW.role = OLD.role` for non-admins produces a row that then trivially passes `WITH CHECK` — the trigger and the policy reinforce each other rather than conflict. The second critical fact: **`auth.uid()` returns the calling user's id even inside SECURITY DEFINER functions** because it reads the request JWT claim, not the executing role [VERIFIED: Supabase docs + GitHub discussion]. This has a sharp consequence for D-20 (the `increment_product_views()` interaction) that the planner must handle explicitly — see Pitfall 1.

**Primary recommendation:** Implement the guard as a `BEFORE UPDATE`/`BEFORE INSERT` trigger that *silently resets* privileged columns to OLD/safe values for non-admins (D-19 confirmed correct), paired with `WITH CHECK` on the self-update policies as defense-in-depth. Exempt `increment_product_views()` from the products guard by checking *which columns actually changed* (column-level guard), not by trying to detect the caller. Ship all SQL idempotently (`add column if not exists`, `drop policy if exists`, `do $$ ... if not exists`). For SEC-04, delete the two Supabase Auth accounts first, then scrub files, then rewrite history with `git filter-repo` (install via pip) or BFG (Java is available locally).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Block role/verified self-escalation (SEC-01) | Database (RLS policy + trigger) | — | Must hold against direct API calls; app layer is bypassable |
| Block listing theft / mass-assign (SEC-02/03) | Database (RLS policy + trigger) | — | Same — boundary is the DB, not React |
| "Only active listings are public" (FND-01) | Database (RLS SELECT policy) | App (optional `.eq('status','active')`) | D-01 mandates RLS boundary; app filter is perf/clarity only |
| Notification fan-out (FND-02) | Database (SECURITY DEFINER fn) | App (Phase 2 navbar bell subscribes) | Insert authority centralized in fn; no direct user INSERT |
| Realtime delivery of own notifications | Database (publication + RLS) | App (Phase 2 subscribe) | RLS filters which rows each subscriber receives |
| Admin audit log (FND-03) | Database (append-only table + fn) | App (Phase 2 writes via RPC) | Append-only enforced by RLS + revoked grants |
| Demo account removal + secret scrub (SEC-04) | Ops (Supabase dashboard + git) | Repo (delete dead files) | Auth accounts live in Supabase Auth; secrets live in git history |

## Standard Stack

This phase introduces **no new runtime dependencies** — it is SQL + ops only. The only external *tool* is a git-history rewriter.

### Tooling
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| git-filter-repo | latest (pip) | Rewrite git history to purge demo credentials (SEC-04) | Officially recommended replacement for `git filter-branch` [CITED: docs.github.com removing-sensitive-data] |
| BFG Repo-Cleaner | 1.14.x | Alternative history rewriter (Java) | Simpler/faster for the "remove this string" case; Java 1.8 confirmed installed locally |

**Installation (git-filter-repo):**
```bash
pip install git-filter-repo
# verify: git filter-repo --version
```
> `git-filter-repo` is NOT currently installed (verified via `git filter-repo --version` → "not installed"). Java 1.8.0_333 IS installed, so BFG is a viable fallback with no extra install beyond downloading the jar.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| git-filter-repo | BFG Repo-Cleaner | BFG is simpler for a single-string purge but requires the jar; filter-repo is more precise and pip-installable |
| `text + CHECK` status | Postgres ENUM | ENUM requires `ALTER TYPE ... ADD VALUE` to extend and can't be done in a transaction pre-PG12; D-02 correctly rejects it to match existing `role`/`currency` convention |
| `read_at timestamptz` | `is_read boolean` | timestamptz retains *when* read; D-08 correctly chooses it |
| Silent-reset trigger | `RAISE EXCEPTION` guard | See D-19 analysis below — silent reset chosen, with one caveat |

## Package Legitimacy Audit

> No package-manager packages are installed in this phase (no `npm install` / `pip install` into the app). The only tool is `git-filter-repo`, a developer-machine CLI, not an app dependency.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| git-filter-repo | PyPI | 7+ yrs | ~1M+/mo | github.com/newren/git-filter-repo | not run (dev tool, not app dep) | Approved — official GitHub-recommended tool |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck not run because this phase installs zero application dependencies. `git-filter-repo` is the GitHub-documented standard tool (docs.github.com), not a transitive supply-chain risk.*

## Architecture Patterns

### System Architecture Diagram

```
                         Direct API call (supabase-js / curl)
                         with a normal authenticated JWT
                                     │
                                     ▼
                    ┌────────────────────────────────────┐
                    │   Postgres RLS layer (the boundary) │
                    └────────────────────────────────────┘
                                     │
        ┌────────────────┬──────────┴───────────┬─────────────────┐
        ▼                ▼                       ▼                 ▼
   SELECT products   UPDATE profiles        UPDATE products   INSERT products
        │                │                       │                 │
   USING:            permissive policies     BEFORE UPDATE      BEFORE INSERT
   status='active'   OR'd: self OR admin     trigger:           trigger:
   OR uid=seller     │                       non-admin →        non-admin →
   OR is_admin()     BEFORE UPDATE trigger   reset seller_id,   force featured=f,
        │            non-admin → reset       featured,          seller_verified=f,
   anon sees only    role=OLD,verified=OLD   seller_verified,   views=0
   active rows       │                       views to OLD       │
                     WITH CHECK enforced     (col-level)        WITH CHECK
                     AFTER trigger →         │                  (auth.uid=seller)
                     reset row passes        WITH CHECK
                                             (auth.uid=seller)

   increment_product_views(p_id)  ──SECURITY DEFINER──►  UPDATE products SET views=views+1
        │                                                       │
        └── auth.uid() inside = CALLING user (non-admin) ──► trigger sees ONLY
            views changed → must NOT revert (see Pitfall 1)


   Admin action (Phase 2)         New event (Phase 2)
        │                              │
        ▼                              ▼
   log_admin_action(...)          create_notification(user_id,...)
   SECURITY DEFINER               SECURITY DEFINER
        │                              │
        ▼                              ▼
   INSERT admin_audit_log         INSERT notifications ──► supabase_realtime
   (append-only: SELECT-only       publication ──► subscriber receives ONLY
    RLS, UPDATE/DELETE revoked)    own rows (RLS-filtered realtime)
```

### Recommended File Structure
Follow the existing per-concern convention (`reports.sql`, `messages.sql`, `messages_unread.sql`). Planner's call (D-61), but a clean split is:
```
cabofeira/supabase/
├── schema.sql                       # EDIT: scrub demo block; add status col + guard triggers + SELECT policy + WITH CHECK
├── notifications.sql                # NEW: notifications table + create_notification() + RLS + realtime
├── admin_audit_log.sql              # NEW: admin_audit_log table + log_admin_action() + append-only RLS
└── (security_guards.sql)            # OPTIONAL: if guards split out of schema.sql
```
Note: D-03/D-16/D-17/D-18 modify the *existing* `profiles`/`products` tables, so those edits naturally belong in `schema.sql` (or a new `security_guards.sql` applied after it). Keep new tables (notifications, audit log) in their own files like reports/messages.

### Pattern 1: BEFORE-trigger silent-reset guard (the core mechanism)
**What:** A `BEFORE UPDATE` trigger that, for non-admin callers, forces privileged columns back to their OLD values. Because `WITH CHECK` runs *after* the trigger, the reset row passes the policy.
**When to use:** Both `profiles` (role/verified) and `products` (seller_id/featured/seller_verified/views).
**Example (profiles):**
```sql
-- Source pattern: postgresql.org/docs/current/sql-createpolicy.html (BEFORE-trigger-then-WITH-CHECK ordering)
create or replace function public.guard_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Admins (and RPC paths running as admin) may change anything.
  if public.is_admin() then
    return new;
  end if;
  -- Non-admin: silently pin privileged columns to their prior values.
  new.role     := old.role;
  new.verified := old.verified;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_update on public.profiles;
create trigger trg_guard_profiles_update
  before update on public.profiles
  for each row execute function public.guard_profiles_update();
```
> NOTE on `is_admin()` inside the trigger: `auth.uid()` (and therefore `is_admin()`) returns the **calling user's** identity even though the trigger function is SECURITY DEFINER [VERIFIED: Supabase docs — `auth.uid()` reads `request.jwt.claim.sub`]. So the admin check is correct: when an admin runs the UPDATE, `is_admin()` is true and the row passes through unchanged.

### Pattern 2: Column-level guard for products (so `increment_product_views` survives)
**What:** Same shape, but the products guard must NOT revert a legitimate `views` bump done by `increment_product_views()`. Because that RPC is SECURITY DEFINER but *called by a normal user*, `auth.uid()` inside the trigger is still the non-admin caller — a naive `new.views := old.views` WOULD revert the bump (this is the D-20 trap).
**Recommended resolution — guard each column independently and treat the views path specially:**
```sql
create or replace function public.guard_products_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  -- Non-admin: pin ownership + privilege flags to OLD (prevents theft + mass-assign).
  new.seller_id       := old.seller_id;
  new.featured        := old.featured;
  new.seller_verified := old.seller_verified;
  -- views: allow ONLY a monotonic +1 increment (what increment_product_views does);
  -- any other rewrite is pinned back. This lets the definer RPC through while
  -- blocking a user from setting views to an arbitrary value.
  if new.views <> old.views and new.views <> old.views + 1 then
    new.views := old.views;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_products_update on public.products;
create trigger trg_guard_products_update
  before update on public.products
  for each row execute function public.guard_products_update();
```
**Alternative (simpler, recommended if the planner prefers hard separation):** Pin `new.views := old.views` *unconditionally* in the trigger, and change `increment_product_views()` so it sets a session flag the trigger checks, OR — cleaner — have the trigger skip the views pin when `current_setting('app.allow_view_bump', true) = '1'` and set that GUC inside the RPC. The "+1 monotonic" check above avoids the GUC plumbing and is the lowest-risk option; flag for planner to choose. **The planner MUST add a verification step that calls `increment_product_views()` as a normal user and confirms `views` actually increments after the guard is installed (success criterion 2 + D-20).**

### Pattern 3: Generic SECURITY DEFINER fan-out function
**What:** One reusable insert path; mirror `handle_new_user()`/`mark_conversation_read()` hardening.
**Example (create_notification):**
```sql
-- Mirrors handle_new_user() / mark_conversation_read() hardening conventions.
create or replace function public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text default null,
  p_data    jsonb default '{}',
  p_link    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, data, link)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link)
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_notification(uuid,text,text,text,jsonb,text) from public, anon;
grant  execute on function public.create_notification(uuid,text,text,text,jsonb,text) to authenticated;
```
> No direct user INSERT policy on `notifications` (D-10). The only insert path is this function. In Phase 2, the `new_message` trigger calls it (trigger functions run with their own privileges; SECURITY DEFINER lets it insert for *any* recipient, which is correct for fan-out).

### Pattern 4: Realtime publication, idempotent (copy from messages.sql)
**Example:**
```sql
-- Source: cabofeira/supabase/messages.sql (existing project pattern)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
```
> RLS-filtered realtime: a subscriber receives change events **only for rows they can SELECT under RLS** [CITED: supabase.com/docs/guides/realtime/postgres-changes]. With the owner-only SELECT policy (`auth.uid() = user_id`), the Phase 2 bell automatically receives only the user's own notifications. No extra work needed. (For DELETE/UPDATE old-record payloads you'd set `replica identity full`, but the bell only needs INSERT events, so default replica identity is fine — do NOT add `replica identity full` unless a later phase needs old-row data.)

### Anti-Patterns to Avoid
- **`RAISE EXCEPTION` on every privileged-column touch:** breaks legitimate full-row updates from the app (PostAd/updateProduct may send `featured` in the patch even when unchanged) and leaks which column was targeted. D-19's silent reset is correct. (Caveat below.)
- **Trying to detect the caller via `session_user`/`current_user` in the trigger:** these return the Postgres role (`authenticated`/`postgres`), not the app user. Use `is_admin()`/`auth.uid()` which read the JWT. [VERIFIED]
- **Pinning `new.views := old.views` unconditionally without exempting the RPC:** silently breaks the view counter (D-20 trap). See Pattern 2.
- **Adding a direct INSERT policy on `notifications`/`admin_audit_log`:** defeats the fan-out/append-only design. Insert only via the SECURITY DEFINER functions.
- **Dropping/recreating the whole `supabase_realtime` publication:** never `create publication`; only `alter publication ... add table` guarded by `pg_publication_tables`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-user authorization on rows | App-layer `if (user.id === ...)` checks | Postgres RLS policies | App checks are bypassed by direct supabase-js/curl — the whole point of SEC-01/02/03 |
| Detecting "is this caller an admin" in SQL | Custom JWT parsing | existing `public.is_admin()` | Already SECURITY DEFINER, stable, pinned search_path |
| Realtime row-filtering for the bell | Client-side filtering of all notifications | RLS-filtered postgres_changes | Subscriber only ever receives its own rows; no leakage [CITED] |
| Append-only enforcement | Raise-on-update trigger | SELECT-only RLS + revoked UPDATE/DELETE grants | D-14: RLS denial + grant revocation suffices; no redundant trigger |
| Git secret removal | Manual rebase / `filter-branch` | `git-filter-repo` or BFG | filter-branch is deprecated and error-prone [CITED: GitHub docs] |

**Key insight:** In this app the *security boundary is Postgres*, not React. The React `setUserRole`/`setUserVerified` (AuthContext.jsx:215-241) and `updateProduct` (ProductsContext.jsx:194) run as the logged-in user against the table directly — there is no server-side API in between. RLS + triggers are therefore the only enforcement that survives a direct API call.

## Runtime State Inventory

> This is a security/refactor phase touching stored data (status backfill) and removing live Auth accounts — inventory required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `products` rows have NO `status` column yet | **Data migration:** `add column if not exists status ... default 'active'` — the `default 'active'` backfills existing rows automatically on add (D-03 satisfied by the default). No separate UPDATE needed for a NOT NULL column added WITH a default. |
| Stored data | Existing `profiles.role`/`verified` already correct; no data change, only guard | Code/SQL: add trigger + WITH CHECK only |
| Live service config | **Two demo Auth accounts** in Supabase Auth: `admin@cabofeira.cv`, `user@cabofeira.cv` — live in Supabase Auth (dashboard), NOT in git | **Manual ops:** delete both via Authentication → Users in the Supabase dashboard. Deleting `auth.users` cascades to `public.profiles` (FK `on delete cascade`) and to their `products`/`favorites`/`conversations`. **Planner: warn that deleting the demo *admin* removes a profile row; confirm a real admin account exists first.** |
| OS-registered state | None — no Task Scheduler / cron / pm2 involved | None — verified (project has no scheduler) |
| Secrets/env vars | Demo passwords (`admin123`/`user123`) appear in: `cabofeira/src/data/seedUsers.js` (lines 8,19 — **dead code**, exported but never imported, verified via grep), the commented-out demo block in `cabofeira/src/pages/Login.jsx` (lines 87-101), the demo block in `schema.sql` (lines 151-169), and the i18n key `auth.demoAccounts` (en.json/pt-cv.json:221). `.env.local` is git-ignored (not in scope here; SEC-10 in Phase 4). | **Code edit:** delete `seedUsers.js`, the commented Login.jsx demo block, the `schema.sql` demo block, and the now-unused `auth.demoAccounts` + `featuredHint` "Demo" strings (bilingual). **History scrub:** the credential strings are in git history (commits `7bf50ac`, `3c67242`, `6849513`, `bfac3e5` — verified via `git log -S admin123`). |
| Build artifacts | None — no compiled artifacts carry the names | None |

**Demo credentials are LOW actual risk** (they're passwords for accounts being deleted; once deleted, the strings authenticate nothing), but SEC-04 explicitly requires history scrubbing, so do it as belt-and-suspenders per the Claude's Discretion note.

## Common Pitfalls

### Pitfall 1: `increment_product_views()` silently breaks after the products guard (D-20)
**What goes wrong:** You add the products `BEFORE UPDATE` guard pinning `new.views := old.views` for non-admins. View counts stop incrementing for all normal users.
**Why it happens:** `increment_product_views()` is SECURITY DEFINER, but `auth.uid()` inside the trigger it fires still resolves to the **calling (non-admin) user** [VERIFIED]. The trigger can't tell the legit RPC apart from a malicious direct UPDATE by checking the caller — both look identical.
**How to avoid:** Guard the `views` column by *value pattern* not by caller — allow only `new.views = old.views + 1` (the exact thing the RPC does), pin any other rewrite (Pattern 2). Alternatively set a session GUC inside the RPC that the trigger checks.
**Warning signs:** After applying guards, `views` never increases on product detail pages.
**Verification (planner must include):** As a normal authenticated user, `select increment_product_views('<id>')` then re-read the row and assert `views` went up by 1; separately, `update products set views = 9999 where id = '<own id>'` and assert it was pinned back.

### Pitfall 2: Forgetting `WITH CHECK` makes the self-update policy reusable for the wrong rows
**What goes wrong:** `products_update_self` currently has only `using (auth.uid() = seller_id)` (schema.sql:138). With USING only, **the same expression is reused as the WITH CHECK** [CITED: "If only a USING clause is specified, then that clause will be used for both USING and WITH CHECK"]. So a user CAN already set `seller_id` to *their own* id but the policy alone does NOT stop them rewriting *other* columns. The trigger is what stops privilege columns; `WITH CHECK (auth.uid() = seller_id)` additionally blocks reassigning `seller_id` to someone else (since the post-trigger row must still satisfy it). Add it explicitly for clarity and defense-in-depth (D-17).
**How to avoid:** Add `with check (auth.uid() = seller_id)` to `products_update_self` and `with check (auth.uid() = id)` to `profiles_update_self`. Belt-and-suspenders with the trigger.

### Pitfall 3: Multiple permissive policies OR together — the admin policy can't be "ANDed" as a restriction
**What goes wrong:** Expecting that adding `products_update_admin` somehow restricts non-admins. It doesn't — **permissive policies combine with OR** [CITED]. `(self) OR (admin)`. A non-admin still passes via the self policy; the *trigger* is what constrains them. Don't rely on policy combination alone for the guard.
**How to avoid:** Keep the trigger as the enforcement; policies just decide *who may attempt* an update. If you ever need a hard AND-constraint, that requires a `RESTRICTIVE` policy [CITED].

### Pitfall 4: Products SELECT policy rewrite breaking My-Ads / Admin / browse
**What goes wrong:** Rewriting `products_select_all` from `using (true)` to `status='active' OR auth.uid()=seller_id OR public.is_admin()` (D-01) could hide rows the app expects.
**Analysis (verified against ProductsContext.jsx):**
- `refreshProducts()` (Home/cache) — anon/users: returns only `active` ✓ (desired).
- `fetchProducts({ sellerId })` (My Ads) — the owner querying their own `sellerId` matches `auth.uid()=seller_id`, so sold/expired/hidden rows ARE returned ✓ (D-04).
- `fetchProducts()` (Admin) — admin matches `is_admin()`, sees everything ✓.
- `fetchProduct(id)` (detail by id) — non-active rows of *other* sellers return null for anon → product detail of a sold item is hidden from public. **Confirm this is desired** (Phase 2 sold-badge UX may want the seller to still see it — they will, via the owner branch).
- `PRODUCT_SELECT` (ProductsContext.jsx:13-17) does **not** currently select `status`. Adding the column doesn't break the select. **The planner may optionally add `status` to `PRODUCT_SELECT`** so Phase 2 can render the Sold badge without a second query — D-05 says app filtering isn't mandated this phase, but exposing the column is cheap and forward-looking.
**How to avoid:** Don't add `.eq('status','active')` to app queries in this phase (RLS already enforces it for anon). Verify My-Ads/Admin still see non-active rows after the policy change (success criterion 3).

### Pitfall 5: D-19 silent-reset hides a genuine attack signal
**What goes wrong:** Silent reset means a malicious direct `update profiles set role='admin'` *succeeds* (returns the row) but with `role` unchanged. The attacker gets a 200, not an error. This is intentional (doesn't leak the column, doesn't break legit full-row updates) and is the **recommended default**.
**Caveat / recommendation:** For the audit posture, the SECURITY DEFINER guard could optionally call `log_admin_action()`-style logging when it detects a non-admin attempting a privileged change (e.g. `new.role <> old.role`). This is **out of scope for Phase 1** (audit-log *writes* are Phase 2) but worth a one-line note in the plan as a Phase 2 hook. **Net recommendation: keep silent reset (D-19 stands); do NOT switch to RAISE EXCEPTION** — the full-row-update breakage risk is real (app `updateProduct` sends `featured` in the patch) and outweighs the marginal benefit of a hard error.

### Pitfall 6: Re-runnability when re-applying SQL manually
**What goes wrong:** Project re-runs SQL by hand; a second run errors on "column already exists" / "policy already exists" / "trigger already exists".
**How to avoid (idempotency checklist):**
- Tables: `create table if not exists`
- Columns: `alter table ... add column if not exists` (matches messages_unread.sql)
- Policies: `drop policy if exists ...; create policy ...` (matches schema.sql convention)
- Triggers: `drop trigger if exists ...; create trigger ...` (matches messages.sql)
- Functions: `create or replace function ...`
- Realtime: `do $$ ... if not exists (select 1 from pg_publication_tables ...) then alter publication ...` (matches messages.sql)
- Grants: `revoke`/`grant` are idempotent; safe to repeat.
> Adding a `NOT NULL` column WITH a `default` backfills existing rows in one statement — safe and re-runnable with `if not exists`.

## Code Examples

### notifications table (FND-02, exact shape from D-09)
```sql
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null check (type in ('new_message','saved_search','price_drop','system')),
  title       text not null,
  body        text,
  data        jsonb not null default '{}',
  link        text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select using (auth.uid() = user_id);
-- Mark-read only; WITH CHECK keeps the row owned by the same user.
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- NO insert policy: rows enter only via create_notification() (SECURITY DEFINER).
```
> Optional hardening for the mark-read path: a user *could* via direct API set `type`/`title`/`body` on their own row (the update policy allows owner updates). If that matters, add a `BEFORE UPDATE` guard pinning everything except `read_at`. **Recommend flagging as a minor Phase 1 nice-to-have**, since the bell only ever writes `read_at`.

### admin_audit_log (FND-03, exact shape from D-13/D-14/D-15)
```sql
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null default auth.uid() references public.profiles(id),
  action       text not null,
  target_table text,
  target_id    uuid,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
drop policy if exists "audit_select_admin" on public.admin_audit_log;
create policy "audit_select_admin"
  on public.admin_audit_log for select using (public.is_admin());
-- NO insert/update/delete policies → append-only + immutable by default-deny.
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

create or replace function public.log_admin_action(
  p_action       text,
  p_target_table text default null,
  p_target_id    uuid default null,
  p_details      jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  -- Only admins may write the audit log.
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_target_table, p_target_id, coalesce(p_details,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.log_admin_action(text,text,uuid,jsonb) from public, anon;
grant  execute on function public.log_admin_action(text,text,uuid,jsonb) to authenticated;
```
> Note: `default auth.uid()` on `actor_id` is belt-and-suspenders; the function also sets it explicitly. Because the table is SELECT-only via RLS with INSERT/UPDATE/DELETE revoked, the SECURITY DEFINER function (running as its owner) is the only write path — exactly D-14. **For Phase 1 this RPC's *correct* behavior is verified by: a non-admin calling it gets "Not authorized"; an admin's row appears and cannot be updated/deleted.**

### profiles SELECT/UPDATE policy changes (SEC-01)
```sql
-- Keep world-readable SELECT (Admin panel + seller cards need it).
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);   -- added; trigger pins role/verified
-- profiles_update_admin (using public.is_admin()) stays as-is.
```

### products SELECT policy rewrite (FND-01 / D-01)
```sql
alter table public.products
  add column if not exists status text not null default 'active'
  check (status in ('active','sold','expired','hidden'));

drop policy if exists "products_select_all" on public.products;
create policy "products_select_active_or_owner_or_admin"
  on public.products for select
  using (status = 'active' or auth.uid() = seller_id or public.is_admin());

drop policy if exists "products_update_self" on public.products;
create policy "products_update_self"
  on public.products for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);   -- blocks seller_id reassignment to others
```

### products INSERT guard (SEC-03 / D-18)
```sql
create or replace function public.guard_products_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.featured        := false;
  new.seller_verified := false;
  new.views           := 0;
  -- status defaults to 'active'; do not let a non-admin insert a hidden/sold listing? 
  -- (Optional: pin new.status := 'active' for non-admin inserts.)
  return new;
end;
$$;
drop trigger if exists trg_guard_products_insert on public.products;
create trigger trg_guard_products_insert
  before insert on public.products
  for each row execute function public.guard_products_insert();
```
> The existing `products_insert_self` policy keeps `with check (auth.uid() = seller_id)`. The trigger forces the safe defaults; the policy ensures the inserter owns the row.

### SEC-04 git-history scrub (Claude's Discretion — method confirmed at execution)
**Order of operations (do NOT reorder):**
1. **Delete demo Auth accounts** in Supabase dashboard (Authentication → Users): `admin@cabofeira.cv`, `user@cabofeira.cv`. (Neutralizes the credentials immediately — the passwords now authenticate nothing.) [CITED: GitHub docs — "revoke/rotate the secret FIRST"]
2. **Confirm a real admin exists** before deleting the demo admin (cascade deletes its profile).
3. **Delete dead files / blocks in working tree:** `cabofeira/src/data/seedUsers.js` (dead code), commented demo block in `Login.jsx` (87-101), demo block in `schema.sql` (151-169), unused i18n `auth.demoAccounts` + "Demo" wording in `featuredHint` (en.json + pt-cv.json). Commit normally.
4. **Scrub history** (choose one):
   ```bash
   # Option A — git-filter-repo (install first: pip install git-filter-repo)
   # Create a replacements file mapping each secret string to ***REMOVED***
   git filter-repo --replace-text replacements.txt
   # replacements.txt lines:  admin123==>***REMOVED***  and  user123==>***REMOVED***
   ```
   ```bash
   # Option B — BFG (Java 1.8 already installed; download bfg.jar)
   java -jar bfg.jar --replace-text replacements.txt .git
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   ```
5. **Force-push + coordinate:** `git push --force` on `main`. Then **every collaborator must re-clone** (or hard-reset to the rewritten ref); they must NOT merge old branches back (would reintroduce the tainted history) [CITED: GitHub docs]. With a solo/small repo this is low-friction.
> `git-filter-repo` is NOT installed (verified); pip-install it, or use BFG since Java IS present (verified `java -version` → 1.8.0_333).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `git filter-branch` for history rewrite | `git-filter-repo` (or BFG) | filter-branch deprecated by Git project | filter-branch is slow + footgun-prone; GitHub docs now recommend filter-repo [CITED] |
| `is_read boolean` for notifications | `read_at timestamptz` | — | Retains read timestamp; unread = `read_at is null` (D-08) |
| ENUM types for constrained strings | `text + CHECK` | — | Avoids `ALTER TYPE` migrations; matches project `role`/`currency` (D-02) |

**Deprecated/outdated:**
- `git filter-branch`: superseded; do not use for SEC-04.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `seedUsers.js` is dead code (exported, never imported) | Runtime State Inventory | LOW — verified via grep (only self-references). If something imports it dynamically, deleting breaks a build; grep covers static imports. |
| A2 | Deleting demo Auth users cascades to their profiles/products via existing FKs | Runtime State Inventory | LOW — FKs are `on delete cascade` (schema.sql). If a demo account owns real-looking listings, they vanish; confirm before deleting. |
| A3 | The bell (Phase 2) only needs INSERT realtime events, so default replica identity is fine | Pattern 4 | LOW — if Phase 2 wants live "mark all read" cross-device sync via realtime UPDATE, may need `replica identity full`; defer. |
| A4 | "+1 monotonic" views guard is acceptable vs a GUC-flag exemption | Pattern 2 | MEDIUM — a determined attacker could call the legit RPC repeatedly (that's the existing un-rate-limited abuse vector, already deferred in CONCERNS.md), but cannot set arbitrary values. Planner picks the variant. |
| A5 | No scheduler/cron/OS state references the demo names | Runtime State Inventory | LOW — project has no scheduler component. |

**If this table is empty:** it is not — five assumptions are flagged for planner/discuss confirmation, all LOW except A4 (MEDIUM, design choice).

## Open Questions (RESOLVED)

1. **views guard variant (Pattern 2): "+1 monotonic" vs session-GUC exemption?**
   - RESOLVED — "+1 monotonic" chosen; encoded in 01-01 Task 1.
   - What we know: both keep `increment_product_views()` working; both block arbitrary `views` rewrites.
   - What's unclear: team preference for the extra GUC plumbing vs the simpler value check.
   - Recommendation: ship the "+1 monotonic" check (no RPC change needed); note the GUC option in the plan.
2. **Should non-admin product inserts be pinned to `status='active'`?**
   - RESOLVED — status:='active' pin added in 01-01 Task 1.
   - What we know: D-18 lists featured/seller_verified/views; status isn't named.
   - What's unclear: whether a seller posting directly via API could create a pre-`hidden` listing.
   - Recommendation: pin `new.status := 'active'` for non-admin inserts in the insert guard (cheap, closes a gap). Flag for planner.
3. **Expose `status` in `PRODUCT_SELECT` now?**
   - RESOLVED — status exposed in ProductsContext, 01-01 Task 3.
   - Recommendation: yes — one-line addition in ProductsContext.jsx; lets Phase 2 render Sold badge without a refactor. Not mandated by D-05 but low-cost and forward-looking. Counts as an app touch (bilingual strings rule N/A — no new UI strings).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase project / SQL editor | All SQL changes | ✓ (existing project) | — | none needed |
| git-filter-repo | SEC-04 history scrub | ✗ | — | BFG (Java present) or `pip install git-filter-repo` |
| Java (for BFG) | SEC-04 fallback | ✓ | 1.8.0_333 | — |
| git | SEC-04 | ✓ | (repo active) | — |
| Supabase dashboard access | Delete demo Auth accounts | assumed ✓ (user owns project) | — | none — required, no fallback |

**Missing dependencies with no fallback:** none (Supabase dashboard access is required for SEC-04 account deletion and is assumed available to the project owner).
**Missing dependencies with fallback:** `git-filter-repo` (use BFG or pip-install).

## Validation Architecture

> The project uses **manual QA, no automated suite** (CLAUDE.md constraint; SEC-09's direct-API verification pass is Phase 4). This phase's correctness is verified by **direct supabase-js/curl probes**, which the planner should encode as explicit, runnable verification steps — not unit tests. This is the right "sampling" for an RLS phase: UI testing cannot prove a direct API call is blocked.

### Verification probes the planner MUST include (one per success criterion)
| Success Criterion | Probe (as a normal authenticated user via supabase-js/curl) | Expected |
|-------------------|------------------------------------------------------------|----------|
| SEC-01 | `update profiles set role='admin' where id = <self>` | row returns, `role` still `'user'` (silent reset) |
| SEC-01 | `update profiles set verified=true where id = <self>` | `verified` still `false` |
| SEC-02 | `update products set seller_id=<other> where id=<own>` | `seller_id` unchanged |
| SEC-02 | `update products set featured=true / seller_verified=true / views=9999` | all pinned to OLD |
| SEC-03 | `insert into products (...featured=true, seller_verified=true, views=50...)` | stored as false/false/0 |
| D-20 | `rpc('increment_product_views', {p_id})` then re-read | `views` incremented by 1 |
| FND-01 | anon `select * from products` | only `status='active'` rows |
| FND-01 | owner `fetchProducts({sellerId:self})` | sees own sold/hidden rows |
| FND-02 | `rpc('create_notification', {...})` then owner `select` | row visible to owner only; other user sees nothing |
| FND-03 | non-admin `rpc('log_admin_action',...)` | error "Not authorized"; admin call succeeds; `update`/`delete` on audit table denied |
| SEC-04 | attempt login `admin@cabofeira.cv/admin123` | auth fails (account deleted); `git log -S admin123` empty after scrub |

### Wave 0 Gaps
- [ ] None — no test framework to scaffold (manual QA milestone). The "tests" are the probe table above, runnable from a scratch node script using the anon-key supabase-js client signed in as a throwaway normal user.

## Security Domain

> `security_enforcement` not disabled in config — section included. This IS a security phase, so ASVS mapping is directly load-bearing.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Security boundary = Postgres RLS (not app); documented in Architectural Responsibility Map |
| V2 Authentication | partial | SEC-04 removes default/demo credentials (ASVS V2.1.x — no default accounts) |
| V3 Session Management | no | No session changes this phase |
| V4 Access Control | **yes (core)** | RLS policies + BEFORE-trigger guards enforce least privilege; deny-by-default on audit log; function-level grants (revoke from anon/public) |
| V5 Input Validation | yes | `text + CHECK` constraints on `status`/`type`; `details`/`data` as jsonb |
| V6 Cryptography | no | No crypto; passwords handled by Supabase Auth (don't hand-roll) |
| V7 Error Handling/Logging | yes | Audit-log keystone (FND-03) is the logging substrate; silent-reset deliberately avoids info leak (D-19) |
| V14 Configuration | yes | SECURITY DEFINER hardening (pinned search_path, minimal grants) pre-empts SEC-07 |

### Known Threat Patterns for Supabase RLS + direct-API
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via direct `update profiles set role` | Elevation of Privilege | BEFORE UPDATE trigger pins role/verified for non-admins (SEC-01) |
| Listing theft via `seller_id` rewrite | Tampering | Trigger pins seller_id + `WITH CHECK (auth.uid()=seller_id)` (SEC-02) |
| Mass-assignment on insert (featured/verified/views) | Tampering | BEFORE INSERT trigger forces safe defaults (SEC-03) |
| Reading non-active/other listings via direct select | Information Disclosure | SELECT policy `status='active' OR owner OR admin` (FND-01) |
| Default credentials | Spoofing | Delete demo accounts + scrub history (SEC-04) |
| search_path hijack on SECURITY DEFINER fn | Elevation of Privilege | `set search_path = public` on every new fn (mirrors existing) |
| Tampering with audit trail | Repudiation | Append-only: SELECT-only RLS + revoked UPDATE/DELETE + fn-only insert (FND-03) |
| Realtime leakage of others' notifications | Information Disclosure | RLS-filtered postgres_changes; owner-only SELECT policy (FND-02) |

## Project Constraints (from CLAUDE.md)

- **No rewrite:** stay on React 19 + Supabase + CRA; extend existing Context architecture/conventions. (This phase adds no React rewrite — at most exposes `status` in `PRODUCT_SELECT`.)
- **Backend changes ship as new files in `cabofeira/supabase/`, applied manually** — no migration runner. → All SQL must be idempotent/re-runnable.
- **Testing = manual QA + fix**, no automated suite. → Verification is the direct-API probe table, not Jest.
- **Localization:** every new user-facing string in both `en.json` and `pt-cv.json`. → This phase removes the demo i18n strings; it adds no new UI strings (backend-only), so the rule mostly governs *deletions* (remove from both files).
- **Security bar:** no backdoors, no privilege escalation, no leaked secrets before launch. → This phase IS that bar for the three RLS holes + demo credentials.
- **Follow `.planning/codebase/CONVENTIONS.md`:** SECURITY DEFINER functions mirror `handle_new_user()`; per-concern SQL files; `drop ... if exists; create ...` idempotency.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | `products.status` (active/sold/expired/hidden); only active in public browse/search | `text + CHECK` column with `default 'active'` (auto-backfills); SELECT policy rewrite; verified against ProductsContext queries (Pitfall 4) |
| FND-02 | `notifications` table + RLS + realtime publication + reusable fan-out fn | Table shape (D-09 code example); `create_notification()` SECURITY DEFINER; owner-only RLS; idempotent realtime publication (Pattern 4); RLS-filtered realtime confirmed [CITED] |
| FND-03 | Append-only `admin_audit_log` + `log_admin_action()` RPC | Table + fn code example; append-only via SELECT-only RLS + revoked grants + fn-only insert (D-14) |
| SEC-01 | profiles self-update can't change role/verified | BEFORE UPDATE guard (Pattern 1) + `WITH CHECK`; `is_admin()` works in trigger because `auth.uid()` reads JWT [VERIFIED] |
| SEC-02 | products self-update can't change seller_id/featured/seller_verified/views | BEFORE UPDATE guard (Pattern 2) + `WITH CHECK (auth.uid()=seller_id)` |
| SEC-03 | products insert forces featured=false/seller_verified=false/views=0 for non-admins | BEFORE INSERT guard (code example) |
| SEC-04 | Remove demo accounts; scrub credentials from schema.sql + git history | Ordered ops (delete Auth → delete files → filter-repo/BFG → force-push); credential locations + git commits identified |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- [CITED] postgresql.org/docs/current/sql-createpolicy.html — USING vs WITH CHECK on UPDATE; "if only USING specified it's used for both"; permissive OR / restrictive AND; **WITH CHECK enforced AFTER BEFORE triggers**
- [CITED] supabase.com/docs/guides/realtime/postgres-changes — RLS-filtered realtime (subscriber receives only authorized rows); `alter publication supabase_realtime add table ...`; replica identity full caveat
- [CITED] docs.github.com — Removing sensitive data from a repository (filter-repo/BFG; revoke secret first; force-push + re-clone coordination)
- Existing project SQL: `cabofeira/supabase/schema.sql`, `messages.sql`, `messages_unread.sql`, `reports.sql`, `storage_product_images.sql` — verified conventions (SECURITY DEFINER + pinned search_path, idempotent policy/trigger/publication patterns)
- Existing app: `cabofeira/src/context/ProductsContext.jsx`, `AuthContext.jsx`, `pages/Login.jsx`, `data/seedUsers.js` — verified query/usage impact

### Secondary (MEDIUM confidence)
- [VERIFIED] Supabase RLS docs + GitHub discussion #824 — `auth.uid()` returns calling user's id inside SECURITY DEFINER (reads `request.jwt.claim.sub`), cross-confirmed by multiple sources
- WebSearch (verified against PG docs) — trigger functions still fire under SECURITY DEFINER RPC; `session_user`/`current_user` resolve to the Postgres role not the app user (hence use `auth.uid()`/`is_admin()`)

### Tertiary (LOW confidence)
- None relied upon — all load-bearing claims verified against official docs or the codebase.

## Metadata

**Confidence breakdown:**
- RLS/WITH CHECK/trigger semantics: HIGH — Postgres official docs, exact quotes
- Supabase realtime + RLS: HIGH — Supabase official docs
- `auth.uid()` in SECURITY DEFINER: HIGH — multiple corroborating sources + mechanism (JWT GUC)
- increment_product_views interaction (D-20): HIGH — derived from verified auth.uid() behavior; mitigation is sound, planner picks variant
- SEC-04 tooling/order: HIGH — GitHub official docs; local tool availability verified
- App-query impact (Pitfall 4): HIGH — read directly from ProductsContext.jsx

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable Postgres/Supabase semantics; ~30 days)
