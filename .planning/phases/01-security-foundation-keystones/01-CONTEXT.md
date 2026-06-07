# Phase 1: Security Foundation + Keystones - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the three highest-severity pre-launch RLS holes and build the three keystone
data structures that every later phase composes onto. Backend/SQL-only phase — no
new UI.

**In scope:**
- **SEC-01** — `profiles` self-update cannot change `role` or `verified` (WITH CHECK + BEFORE UPDATE trigger; admin/RPC only)
- **SEC-02** — `products` self-update cannot reassign `seller_id` or flip `featured`/`seller_verified`/`views` (no listing theft)
- **SEC-03** — `products` insert forces `featured=false`, `seller_verified=false`, `views=0` for non-admins (no mass-assignment)
- **SEC-04** — Remove demo admin/user accounts from prod; scrub demo credentials from `schema.sql` and git history
- **FND-01** — `products.status` (active/sold/expired/hidden); only `active` listings appear in public browse/search
- **FND-02** — `notifications` table + RLS + realtime publication + reusable fan-out function (keystone)
- **FND-03** — append-only `admin_audit_log` table + `log_admin_action()` RPC (keystone)

**Out of scope (later phases):** mark-as-sold UI, message-notification trigger, audit-log
writes/dashboard, structured reports, storage MIME hardening, open-redirect fix, SECURITY
DEFINER audit, direct-API verification pass. Those consume these keystones but are Phase 2/4.

</domain>

<decisions>
## Implementation Decisions

### Listing Status (FND-01)
- **D-01:** Enforce "only active listings are public" at the **RLS layer** (defense-in-depth, not app-only). Rewrite the `products` SELECT policy to: `status = 'active' OR auth.uid() = seller_id OR public.is_admin()`. A direct supabase-js/curl call must not see non-active listings even if app code forgets to filter.
- **D-02:** Type as **`text + CHECK`**, not a Postgres ENUM — matches existing convention (`role`, `currency` use `text + CHECK`) and avoids `ALTER TYPE` when extending. Definition: `status text not null default 'active' check (status in ('active','sold','expired','hidden'))`.
- **D-03:** Backfill all existing rows to `status = 'active'` when the column is added.
- **D-04:** **Owner + admin** can see their own non-active (`sold`/`expired`/`hidden`) listings; public/anon see only `active`. (Required so the seller's "My Ads" view still shows sold items for Phase 2 mark-as-sold UX.)
- **D-05:** App-level query filtering is NOT required by this phase (RLS is the boundary), but app code that should only show active listings may add `.eq('status','active')` for clarity/perf in later phases — not mandated here.

### Notifications Keystone (FND-02)
- **D-06:** Build a single generic **`create_notification(user_id, type, title, body, data, link)`** SECURITY DEFINER function as the reusable fan-out. Each event gets a thin trigger that calls it. **No event triggers are wired in this phase** — Phase 2 wires the `new_message` trigger; v2 wires saved-search/price-drop. The keystone is the function + table, ready to plug into.
- **D-07:** `type` is **`text + CHECK` with a forward-looking seeded set**: `check (type in ('new_message','saved_search','price_drop','system'))`. Validates input now; extending is a one-line CHECK edit.
- **D-08:** Read/unread stored as **`read_at timestamptz null`** (unread = `read_at is null`). Navbar unread count = `count(*) where read_at is null`.
- **D-09:** Column shape: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references profiles(id) on delete cascade`, `type text not null check(...)`, `title text not null`, `body text`, `data jsonb not null default '{}'`, `link text`, `read_at timestamptz`, `created_at timestamptz not null default now()`.
- **D-10:** RLS: a user can **SELECT and UPDATE (mark read) only their own** notifications. Rows are **inserted only through `create_notification()`** (SECURITY DEFINER) — no direct user INSERT policy. Add the table to the **`supabase_realtime` publication** so the bell updates live.

### Audit Log Keystone (FND-03)
- **D-11:** Generic **`log_admin_action(action text, target_table text, target_id uuid, details jsonb)`** SECURITY DEFINER RPC — one signature for every admin mutation (delete ad, change role, verify, change prices). New admin actions need only a new `action` string + `details` payload, no schema change.
- **D-12:** Before/after context is **passed in by the caller** via `details jsonb` (e.g. `{"old_role":"user","new_role":"admin"}`). No auto-capture table triggers — Phase 2 decides per-action what's worth recording.
- **D-13:** Row shape: `id uuid pk default gen_random_uuid()`, `actor_id uuid not null default auth.uid() references profiles(id)`, `action text not null`, `target_table text`, `target_id uuid`, `details jsonb not null default '{}'`, `created_at timestamptz not null default now()`.
- **D-14:** **Append-only via RLS**: admin **SELECT only**; no UPDATE/DELETE policy exists (default-deny) and UPDATE/DELETE are revoked. Inserts happen only through `log_admin_action()`. (No redundant raise-on-update trigger — RLS denial suffices.)
- **D-15:** Read access (SELECT) restricted to admins via `using (public.is_admin())`.

### RLS Guard Mechanism (SEC-01, SEC-02, SEC-03 — mechanism prescribed by requirements)
- **D-16:** `profiles`: add **`WITH CHECK`** to the self-update policy AND a **`BEFORE UPDATE` trigger** that, for non-admin callers, forces `NEW.role = OLD.role` and `NEW.verified = OLD.verified`. Admin path (existing `profiles_update_admin` policy / RPC) remains able to change them.
- **D-17:** `products`: a **`BEFORE UPDATE` trigger** that, for non-admin callers, forces `NEW.seller_id = OLD.seller_id`, `NEW.featured = OLD.featured`, `NEW.seller_verified = OLD.seller_verified`, `NEW.views = OLD.views`. Pair with `WITH CHECK (auth.uid() = seller_id)` on the self-update policy to prevent reassignment.
- **D-18:** `products`: a **`BEFORE INSERT` trigger** (or column defaults + check) that forces `featured=false`, `seller_verified=false`, `views=0` for non-admin inserts.
- **D-19:** **Guard failure mode = silent reset to OLD/safe values**, not `RAISE EXCEPTION`. Rationale: doesn't break legitimate full-row updates from the app (which may send all columns), and doesn't leak that a privileged column was targeted. *(Planner/researcher: if research shows a hard error is materially safer for an explicit security gate, flag it — otherwise default to silent reset.)*
- **D-20:** `increment_product_views()` RPC already exists and legitimately bumps `views` via SECURITY DEFINER — the products UPDATE guard must not break it (the RPC runs as definer, bypassing the per-user reset). Verify this interaction.

### Claude's Discretion
- **SEC-04 method (demo accounts & git scrub):** Delete the two demo accounts (`admin@cabofeira.cv`, `user@cabofeira.cv`) in Supabase Auth manually; strip the demo-credential comment block from `schema.sql`. SEC-04 requires history scrubbing, so scrub git history with **`git filter-repo`** + a coordinated force-push. The leaked secrets are only demo passwords for accounts being deleted, so exposure is neutralized by deletion — history rewrite is belt-and-suspenders. **Method confirmed at execution** (filter-repo vs BFG, force-push coordination) since the user deferred this area. Check whether any demo-login convenience UI exists in the app before removing.
- File organization for new SQL (one combined Phase-1 file vs per-concern files in `cabofeira/supabase/`) — planner's call, following the existing per-concern convention (`reports.sql`, `messages.sql`, etc.). Applied manually in Supabase (no migration runner).
- Exact wording of any new realtime publication statements and grant/revoke specifics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` §"Phase 1: Security Foundation + Keystones" — goal, depends-on, 5 success criteria
- `.planning/REQUIREMENTS.md` — FND-01/02/03, SEC-01/02/03/04 definitions and the SEC-split rationale

### Current schema & security state (the code being modified)
- `cabofeira/supabase/schema.sql` — current `profiles`/`products`/`favorites` tables, RLS policies (the holes), `is_admin()`, `increment_product_views()`, `handle_new_user()`, and the demo-credential block to scrub (SEC-04)
- `cabofeira/supabase/reports.sql` — existing per-concern SQL file convention to mirror
- `cabofeira/supabase/messages.sql`, `cabofeira/supabase/messages_unread.sql` — realtime patterns precedent for FND-02
- `cabofeira/supabase/storage_product_images.sql` — storage bucket (relevant to SEC-05 in Phase 4, not here)

### Codebase conventions & known issues
- `.planning/codebase/CONVENTIONS.md` — naming/style rules new SQL + any app changes must follow
- `.planning/codebase/CONCERNS.md` §"Security Considerations" / "No Admin Audit Log" / "No Content Moderation for Reports" — independent confirmation of these holes
- `.planning/codebase/INTEGRATIONS.md` — Supabase integration surface

### App integration points (status filtering)
- `cabofeira/src/context/ProductsContext.jsx` — `PRODUCT_SELECT` and `fetchProducts()`; where status interacts with browse/search queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public.is_admin()` (SECURITY DEFINER, stable, pinned search_path) — reuse in all new RLS policies and as the admin-exemption check in guard triggers.
- `public.handle_new_user()` — established pattern for SECURITY DEFINER + `set search_path = public` trigger functions; mirror it for new functions.
- `increment_product_views()` — existing SECURITY DEFINER RPC that updates `products.views`; the products UPDATE guard must remain compatible (definer bypasses the per-user reset).

### Established Patterns
- `text + CHECK` for constrained string columns (`role in ('user','admin')`, `currency`) — drives D-02 (status) and D-07 (notification type).
- Per-concern SQL files in `cabofeira/supabase/` applied manually in the Supabase SQL editor — no automated migration runner (project constraint). New Phase-1 SQL ships as new file(s) here.
- RLS pattern: `drop policy if exists ...; create policy ...` idempotent blocks per table.

### Integration Points
- `ProductsContext.jsx` browse/search queries now sit behind the new RLS SELECT filter — confirm public queries still return active listings and owner/admin queries (My Ads, Admin) still see non-active rows after the policy rewrite.
- `notifications` realtime publication is the substrate the Phase 2 navbar bell subscribes to.

</code_context>

<specifics>
## Specific Ideas

- Notification `type` seeded set deliberately includes forward-looking values (`saved_search`, `price_drop`, `system`) so Phase 2 and v2 don't immediately ALTER the CHECK.
- `read_at` (not a boolean) chosen so unread = `read_at is null` and the read timestamp is retained.
- Audit `details jsonb` is the extension point — every future admin action serializes its own before/after there rather than adding columns.

</specifics>

<deferred>
## Deferred Ideas

- **Demo-login replacement / real test accounts** — if a demo-login convenience exists, decide its replacement during SEC-04 execution (out of scope to design now).
- **`increment_product_views()` rate-limiting** (CONCERNS.md scaling note) — abuse vector, but not a Phase 1 success criterion. Defer.
- **Auto-capture audit triggers** (full old/new row snapshots) — considered and rejected for launch (D-12); revisit only if manual `details` proves insufficient.
- **Saved-search / price-drop notification triggers** — v2; the keystone is built to receive them but they are not wired now.
- **Message-notification trigger (FEAT-08)** — Phase 2 wires `create_notification()` to the messages table.

</deferred>

---

*Phase: 01-security-foundation-keystones*
*Context gathered: 2026-06-07*
