---
phase: 01-security-foundation-keystones
reviewed: 2026-06-07T21:08:02Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - cabofeira/src/context/ProductsContext.jsx
  - cabofeira/src/i18n/en.json
  - cabofeira/src/i18n/pt-cv.json
  - cabofeira/src/pages/Login.jsx
  - cabofeira/supabase/admin_audit_log.sql
  - cabofeira/supabase/notifications.sql
  - cabofeira/supabase/schema.sql
  - cabofeira/supabase/security_guards.sql
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-06-07T21:08:02Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This is the security-foundation phase, where Postgres RLS + SECURITY DEFINER
functions are the *entire* enforcement layer (no server-side API between the
React client and the DB). I reviewed RLS policy correctness, SECURITY DEFINER
hardening (`set search_path`), the mass-assignment guard triggers, audit-log
immutability, the notification fan-out function, and the JS changes (status
exposure, Login scrub, i18n parity).

Overall the guard triggers and audit-log immutability design are solid and the
SECURITY DEFINER functions are correctly hardened with `set search_path = public`.
The product-status RLS rewrite (`products_select_active_or_owner_or_admin`) is
correct. i18n parity is clean (404/404 keys, no missing entries either direction).

However there is **one BLOCKER**: `create_notification()` is granted to every
authenticated user and inserts an attacker-controlled `p_user_id` with **no
authorization check**, directly contradicting the file's own comment that "a
user can never forge a notification for another user." This is an
impersonation / spam / phishing vector that ships open. Several warnings concern
PII exposure through world-readable profiles and the client never constraining
listing `status`, relying entirely on RLS.

## Critical Issues

### CR-01: `create_notification()` lets any authenticated user forge notifications for any other user

**File:** `cabofeira/supabase/notifications.sql:50-75`
**Issue:**
The function is `SECURITY DEFINER`, granted to `authenticated`, and inserts
`p_user_id` (a caller-supplied argument) verbatim with **no gate** confirming the
caller is allowed to target that user. The header comment claims:

> NO insert policy: rows enter only via create_notification() (SECURITY
> DEFINER). A user can never forge a notification for another user.

That guarantee is false. Because the function bypasses the (deliberately absent)
INSERT RLS policy and never checks `auth.uid()`, any logged-in user can call:

```js
supabase.rpc("create_notification", {
  p_user_id: "<any-victim-uuid>",
  p_type: "system",
  p_title: "Your account is suspended — verify at evil.example",
  p_link: "https://evil.example",
});
```

and the victim's navbar bell (subscribed via realtime) will display it. This is
a phishing / spam / impersonation channel that defeats the owner-only model the
rest of the table is built around. In a no-server-API architecture this RPC *is*
the trust boundary, so the missing check is the whole vulnerability.

**Fix:** Add an authorization gate. Since the only legitimate Phase-2 caller is a
`new_message` trigger (which should itself be SECURITY DEFINER and call this with
a trusted target), restrict the *direct* RPC to admins only, OR require the
caller to be a participant in the relevant context. Minimal hardening:

```sql
create or replace function public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text  default null,
  p_data    jsonb default '{}',
  p_link    text  default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Only admins, or internal SECURITY DEFINER callers (trigger context),
  -- may target an arbitrary user. A plain authenticated client may only
  -- create notifications for itself.
  if p_user_id <> auth.uid() and not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  insert into public.notifications (user_id, type, title, body, data, link)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link)
  returning id into v_id;
  return v_id;
end;
$$;
```

If even self-targeted client creation is not a real use case, drop the
`authenticated` grant entirely and grant only to the internal role/trigger that
fans out messages. Either way the current `grant execute ... to authenticated`
with no in-function check must not ship.

## Warnings

### WR-01: World-readable `profiles` exposes every user's email and phone to anon

**File:** `cabofeira/supabase/schema.sql:131` (and join at `cabofeira/src/context/ProductsContext.jsx:16`)
**Issue:**
`create policy "profiles_select_all" on public.profiles for select using (true)`
makes the entire `profiles` row — including `email` and `phone` — readable by
**anonymous** clients. `PRODUCT_SELECT` then joins `seller(... phone, email ...)`
into every product card. For a pre-launch marketplace this means anyone can
scrape the full email+phone list of all registered users with a single
unauthenticated query (`select email, phone from profiles`). The CLAUDE.md note
justifies world-readable profiles for "seller cards," but seller cards do not
need every user's email, and the contact email/phone of non-sellers is leaked
regardless. This is a GDPR/PII concern and an enumeration aid.
**Fix:** Split sensitive columns out of the world-readable path. Options:
expose a `profiles_public` view (id, name, avatar, verified, member_since) with
`using (true)`, and restrict the base table SELECT to `auth.uid() = id or
public.is_admin()`. Update `PRODUCT_SELECT` to read seller contact info only
where the app actually needs it (e.g. on the product-detail page for
authenticated users), not on every card.

### WR-02: Client never filters listing `status`; non-active rows surface in Search for owners

**File:** `cabofeira/src/context/ProductsContext.jsx:110-160` (`fetchProducts`), `77-89` (`refreshProducts`)
**Issue:**
Neither `fetchProducts` (Search/Admin) nor `refreshProducts` (Home cache) ever
constrains `status`. Correctness for *anonymous* users is preserved by the RLS
policy `products_select_active_or_owner_or_admin`, but for an authenticated owner
the policy returns their own `sold`/`hidden`/`expired` listings too. As a result
a logged-in user's own non-active ads appear intermixed in Home and in general
Search results (and in popularity/price sorts), which is almost certainly not the
intended browse experience — "hidden" especially implies it should not show in
browse. The phase added the `status` column and threads it through `fromRow`, but
no read path uses it to filter.
**Fix:** Add an explicit `.eq("status", "active")` to the browse/search queries
(Home cache + Search), and only relax it for the My-Ads and Admin views that
intentionally want all statuses. Relying solely on RLS conflates "what the user
is *allowed* to see" with "what browse should *show*."

### WR-03: `updateProduct` / `toRow` cannot set `status`; lifecycle transitions are unreachable from the app

**File:** `cabofeira/src/context/ProductsContext.jsx:56-69` (`toRow`), `195-220` (`updateProduct`)
**Issue:**
The phase's stated keystone is the listing lifecycle (`active/sold/expired/hidden`),
and `fromRow` now reads `status`, but there is no write path: `toRow` omits
`status` (fine — insert guard forces `'active'`) and `updateProduct`'s allow-list
of patchable fields has no `status` branch. So a seller can never mark an ad
`sold` or `hidden` through this context. Either the lifecycle is dead on arrival,
or some other code path mutates status directly and bypasses this guarded helper.
**Fix:** Add a controlled `status` transition to `updateProduct` (validating the
target value against the allowed set) or a dedicated `setProductStatus(id, status)`
method, so the lifecycle the schema enforces is actually drivable from the UI.

### WR-04: `admin_audit_log.actor_id` trusts a column default that the documented sole writer overrides — drift risk

**File:** `cabofeira/supabase/admin_audit_log.sql:16`, `68-69`
**Issue:**
`actor_id uuid not null default auth.uid()` sets a `DEFAULT auth.uid()`, but the
documented "sole write path" `log_admin_action()` always passes `auth.uid()`
explicitly, so the default is never exercised through the intended path. The risk
is the reverse: the column default makes a *direct* insert (e.g. by a future
migration, a superuser maintenance script, or a mis-scoped grant) look
attribution-correct while actually recording `auth.uid()` of whatever session ran
it — undermining the "tamper-evident, attributable" guarantee. For an
append-only audit log, attribution should be pinned by the trusted function, not
inferred from a defaultable column.
**Fix:** Drop the `default auth.uid()` so the column has no client-spoofable
default, and keep `actor_id` populated exclusively from inside
`log_admin_action()` (which already passes `auth.uid()`). This makes the function
the unambiguous single source of attribution.

### WR-05: `notifications` realtime publication adds the table without setting `replica identity`; relies on RLS-filtered INSERTs only

**File:** `cabofeira/supabase/notifications.sql:77-92`
**Issue:**
The comment asserts the bell "only needs INSERT events, so full-row replica
identity is unnecessary." That is true *today*, but `notifications_update_own`
allows owners to mark-read via UPDATE, and any future code (or Phase-2 work) that
subscribes to UPDATE/DELETE on this table will silently receive incomplete old-row
data (default replica identity = primary key only), which combined with
RLS-filtered realtime can drop events the client expects. This is a latent
correctness trap rather than a present bug.
**Fix:** Either document the constraint as a hard contract ("subscribe to INSERT
only") at the subscription site, or set `alter table public.notifications replica
identity full;` so UPDATE/DELETE realtime payloads are complete if/when consumed.

## Info

### IN-01: `increment_product_views` is implicitly `EXECUTE`-able by `PUBLIC`

**File:** `cabofeira/supabase/schema.sql:110-117`
**Issue:** Unlike `log_admin_action` and `create_notification`, this function has
no explicit `revoke/grant`, so it inherits the default `PUBLIC` execute. That is
intended (anon users increment views), but the inconsistency with the explicitly
gated functions makes the grant posture harder to audit at a glance.
**Fix:** Add an explicit `grant execute on function public.increment_product_views(uuid)
to anon, authenticated;` (and a leading `revoke ... from public;` if you want to
be precise) so every SECURITY DEFINER function in the codebase states its grant
intent explicitly.

### IN-02: Commented-out demo-credential block correctly removed from Login.jsx

**File:** `cabofeira/src/pages/Login.jsx:84-86` (removed region)
**Issue:** The phase scrubbed the commented-out `admin@cabofeira.cv / admin123`
and `user@cabofeira.cv / user123` auto-fill block (SEC-04). This is the right
change — those literals should not live in source even commented. Noted as a
positive confirmation; no action needed. Verify no other file still references
those literals (none found in the reviewed scope).
**Fix:** None — confirmation only.

### IN-03: `refreshProducts` swallows the error path silently

**File:** `cabofeira/src/context/ProductsContext.jsx:82-88`
**Issue:** `if (!error && data) setProducts(...)` discards `error` with no log,
matching the codebase's documented "async errors swallowed" anti-pattern. Not
introduced by this phase, but the newly added `status` column means a schema/RLS
misconfiguration here would fail silently (empty product list) with no diagnostic.
**Fix:** Add the project-standard `// eslint-disable-next-line no-console` +
`console.error("[products] refresh failed:", error)` in the error branch to match
the conventions in CLAUDE.md.

---

_Reviewed: 2026-06-07T21:08:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
