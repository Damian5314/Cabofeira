# Phase 1: Security Foundation + Keystones - Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 8 (3 new SQL, 1 modified SQL, 4 modified JS/JSON for SEC-04)
**Analogs found:** 8 / 8

> Backend/SQL-only phase. Every analog is an existing file in `cabofeira/supabase/`. The
> codebase already contains exact precedents for every pattern this phase needs:
> SECURITY DEFINER functions (`handle_new_user`, `is_admin`, `increment_product_views`,
> `mark_conversation_read`, `bump_conversation_last_message`), idempotent RLS policy blocks,
> idempotent realtime publication blocks, `text + CHECK` columns, `add column if not exists`,
> and admin-gated SELECT policies. New SQL should be near-verbatim adaptations of these.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `cabofeira/supabase/notifications.sql` (NEW) | migration (table + RLS + fn + realtime) | event-driven / pub-sub | `cabofeira/supabase/reports.sql` (table+RLS+realtime) + `messages.sql` (publication) + `messages_unread.sql` (SECURITY DEFINER fn) | exact (composite) |
| `cabofeira/supabase/admin_audit_log.sql` (NEW) | migration (append-only table + fn) | event-driven / write-only | `cabofeira/supabase/reports.sql` (admin-gated table) + `messages_unread.sql` (`mark_conversation_read` SECURITY DEFINER + auth check) | exact (composite) |
| `cabofeira/supabase/security_guards.sql` (NEW) — OR folded into `schema.sql` | migration (trigger guards + policy rewrites) | request-response (RLS enforcement) | `schema.sql` `handle_new_user()` (SECURITY DEFINER trigger shape) + `messages.sql` `bump_conversation_last_message` (BEFORE/AFTER trigger wiring) + `schema.sql` existing policy blocks | role-match |
| `cabofeira/supabase/schema.sql` (MODIFY) | migration (status column, SELECT policy, WITH CHECK, scrub demo block) | CRUD / RLS | self (existing `products`/`profiles` policy blocks) + `messages_unread.sql` (`add column if not exists`) | exact (in-place) |
| `cabofeira/src/context/ProductsContext.jsx` (OPTIONAL touch) | service/context | CRUD (read query shape) | self (`PRODUCT_SELECT` lines 13-17) | exact (in-place) |
| `cabofeira/src/data/seedUsers.js` (DELETE) | data (dead code) | n/a | n/a (file removal) | n/a |
| `cabofeira/src/pages/Login.jsx` (MODIFY) | component (remove commented demo block lines 87-101) | n/a | n/a (block deletion) | n/a |
| `cabofeira/src/i18n/{en,pt-cv}.json` (MODIFY) | config/i18n (remove `auth.demoAccounts` :221, scrub "Demo" from `featuredHint` :191) | n/a | self (paired bilingual keys) | exact (in-place) |

## Pattern Assignments

### `cabofeira/supabase/notifications.sql` (NEW — table + RLS + SECURITY DEFINER fn + realtime)

**Primary analog:** `cabofeira/supabase/reports.sql` (whole-file structure: header → `create table if not exists` → indexes → `enable row level security` → idempotent `drop policy / create policy` block → idempotent realtime publication `do $$` block).
**Secondary analog:** `cabofeira/supabase/messages_unread.sql` lines 14-47 (SECURITY DEFINER fn + `grant execute ... to authenticated`).

**File-header comment pattern** — copy from `reports.sql` lines 1-4:
```sql
-- =====================================================================
-- CaboFeira – Notifications (run this in the Supabase SQL editor).
-- ... one-line purpose ...
-- =====================================================================
```

**Table + index pattern** (mirror `reports.sql` lines 6-20; exact column shape from RESEARCH.md D-09 / lines 320-333):
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
```
> Note: `text + CHECK` for `type` mirrors `reports.status` (reports.sql:12-13) and `products`/`profiles` `role`/`currency` (schema.sql:16,29). `references profiles(id) on delete cascade` mirrors `reports.reporter_id` (reports.sql:9).

**RLS owner-only block** (idempotent `drop ... create` from reports.sql:26-53; owner predicate `auth.uid() = user_id` from `favorites_*` in schema.sql:147-149):
```sql
alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own"
  on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- NO insert policy: rows enter only via create_notification() (SECURITY DEFINER).
```

**SECURITY DEFINER fan-out fn** (shape copied verbatim from `mark_conversation_read`, messages_unread.sql:14-47 — `language plpgsql / security definer / set search_path = public / $$ ... $$` + trailing `grant execute ... to authenticated`):
```sql
create or replace function public.create_notification(
  p_user_id uuid, p_type text, p_title text,
  p_body text default null, p_data jsonb default '{}', p_link text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, data, link)
  values (p_user_id, p_type, p_title, p_body, coalesce(p_data,'{}'::jsonb), p_link)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_notification(uuid,text,text,text,jsonb,text) from public, anon;
grant  execute on function public.create_notification(uuid,text,text,text,jsonb,text) to authenticated;
```

**Idempotent realtime publication** (copy verbatim from `messages.sql` lines 92-111 / `reports.sql` lines 58-68 — `do $$ ... if not exists (select 1 from pg_publication_tables ...) then alter publication supabase_realtime add table ...`):
```sql
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
```

---

### `cabofeira/supabase/admin_audit_log.sql` (NEW — append-only table + SECURITY DEFINER RPC)

**Primary analog:** `cabofeira/supabase/reports.sql` (admin-gated table via `using (public.is_admin())`, reports.sql:42-53).
**Secondary analog:** `cabofeira/supabase/messages_unread.sql` lines 14-47 — `mark_conversation_read` shows the SECURITY DEFINER fn + in-function authorization check (`raise exception 'Not a participant ...'`, line 42) to mirror for the non-admin guard.

**Table + index** (mirror reports.sql:6-20; exact shape RESEARCH.md D-13 / lines 350-359):
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
```

**Append-only RLS** (admin SELECT predicate from reports.sql:42-44; the *absence* of insert/update/delete policies + explicit revoke is the append-only mechanism, D-14):
```sql
alter table public.admin_audit_log enable row level security;
drop policy if exists "audit_select_admin" on public.admin_audit_log;
create policy "audit_select_admin"
  on public.admin_audit_log for select using (public.is_admin());
-- NO insert/update/delete policies → append-only + immutable by default-deny.
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;
```

**SECURITY DEFINER RPC with in-fn admin check** (fn skeleton from `mark_conversation_read` messages_unread.sql:14-47; the `if not public.is_admin() then raise exception` guard mirrors that fn's participant check at line 42):
```sql
create or replace function public.log_admin_action(
  p_action text, p_target_table text default null,
  p_target_id uuid default null, p_details jsonb default '{}'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'Not authorized'; end if;
  insert into public.admin_audit_log (actor_id, action, target_table, target_id, details)
  values (auth.uid(), p_action, p_target_table, p_target_id, coalesce(p_details,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.log_admin_action(text,text,uuid,jsonb) from public, anon;
grant  execute on function public.log_admin_action(text,text,uuid,jsonb) to authenticated;
```
> No realtime publication block needed here (audit log is admin-read, not live-pushed).

---

### `cabofeira/supabase/security_guards.sql` (NEW, or fold into schema.sql) — BEFORE-trigger guards (SEC-01/02/03)

**Primary analog (function shape):** `schema.sql` `handle_new_user()` lines 63-85 — the canonical SECURITY DEFINER trigger function: `returns trigger / language plpgsql / security definer / set search_path = public / as $$ begin ... return new; end; $$` followed by `drop trigger if exists ...; create trigger ... before/after ... for each row execute function ...`.
**Secondary analog (trigger wiring):** `messages.sql` `bump_conversation_last_message` + `trg_bump_conversation` (messages.sql:32-49) — exact `drop trigger if exists / create trigger ... before|after ... on public.<table> for each row execute function ...` idiom.
**Admin-exemption helper:** reuse `public.is_admin()` (schema.sql:91-101) directly inside each guard — do NOT reimplement.

**Guard function + trigger pattern** (structure lifted from handle_new_user; logic from RESEARCH.md Pattern 1/2 lines 129-185):
```sql
create or replace function public.guard_profiles_update()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if public.is_admin() then return new; end if;   -- is_admin() reads JWT, correct in trigger
  new.role := old.role;
  new.verified := old.verified;
  return new;
end;
$$;
drop trigger if exists trg_guard_profiles_update on public.profiles;
create trigger trg_guard_profiles_update
  before update on public.profiles
  for each row execute function public.guard_profiles_update();
```
> Same shape for `guard_products_update()` (pin `seller_id`/`featured`/`seller_verified`; views via the `+1 monotonic` check — RESEARCH.md Pattern 2 lines 158-186, Pitfall 1) and `guard_products_insert()` (force `featured=false/seller_verified=false/views=0`, optionally `status='active'` — RESEARCH.md lines 427-449, Open Question 2). The trigger function follows `handle_new_user` exactly; the trigger wiring follows `trg_bump_conversation`.

> **D-20 / Pitfall 1:** `increment_product_views()` (schema.sql:104-111) runs SECURITY DEFINER but `auth.uid()` inside the fired guard is still the non-admin caller. The products UPDATE guard must allow `new.views = old.views + 1` so the counter survives. Planner MUST encode the verification probe (RESEARCH.md line 533).

---

### `cabofeira/supabase/schema.sql` (MODIFY — status column, SELECT policy, WITH CHECK, scrub demo block)

**Analog:** self — every edit reuses an idiom already in this file.

**Add status column** (`add column if not exists` idiom copied from messages_unread.sql:7-9; `text + CHECK` from existing `role`/`currency` schema.sql:16,29; `default 'active'` auto-backfills per D-03):
```sql
alter table public.products
  add column if not exists status text not null default 'active'
  check (status in ('active','sold','expired','hidden'));
```

**Rewrite products SELECT policy** (replace `using (true)` at schema.sql:136 — idempotent `drop policy if exists / create policy` block already in this file at lines 130-141; admin predicate `public.is_admin()` from schema.sql:140):
```sql
drop policy if exists "products_select_all" on public.products;
create policy "products_select_active_or_owner_or_admin"
  on public.products for select
  using (status = 'active' or auth.uid() = seller_id or public.is_admin());
```

**Add WITH CHECK to self-update policies** (extend existing schema.sql:126 `profiles_update_self` and schema.sql:138 `products_update_self` — both currently USING-only):
```sql
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "products_update_self" on public.products;
create policy "products_update_self" on public.products for update
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
```

**SEC-04 scrub:** delete the demo-credentials comment block at **schema.sql lines 151-169** (contains `admin123`/`user123`).

---

### `cabofeira/src/context/ProductsContext.jsx` (OPTIONAL — expose `status` in PRODUCT_SELECT)

**Analog:** self — `PRODUCT_SELECT` at lines 13-17 and `fromRow` at lines 31-53.
RESEARCH.md Open Question 3 recommends adding `status` to the select list (one word) so Phase 2 renders the Sold badge without a refactor. Not mandated by D-05. If added, mirror by also surfacing it in `fromRow` (lines 31-53). No new UI strings → bilingual rule N/A.

---

### SEC-04 credential scrub (files + git history)

| File | Action | Confirmed location |
|------|--------|--------------------|
| `cabofeira/src/data/seedUsers.js` | DELETE whole file | Dead code — grep confirms only self-references (no importer) |
| `cabofeira/src/pages/Login.jsx` | Delete commented demo block | lines 87-101 (`admin123`/`user123` literals) |
| `cabofeira/src/i18n/en.json` | Remove `auth.demoAccounts`; scrub "(Demo only — no payment.)" from `featuredHint` | `demoAccounts` line 221; `featuredHint` line 191 |
| `cabofeira/src/i18n/pt-cv.json` | Remove `auth.demoAccounts`; scrub "(Demo — sem pagamento.)" from `featuredHint` | `demoAccounts` line 221; `featuredHint` line 191 |
| `cabofeira/supabase/schema.sql` | Delete demo block | lines 151-169 |
| Supabase Auth (ops) | Delete `admin@cabofeira.cv`, `user@cabofeira.cv` | dashboard — Authentication → Users (confirm a real admin exists first; cascade deletes profile) |
| git history (ops) | Scrub `admin123`/`user123` | `git-filter-repo` (pip) or BFG (Java 1.8 present); force-push + re-clone |

> Bilingual rule governs *deletions* here: remove `auth.demoAccounts` from BOTH `en.json` and `pt-cv.json` (line 221 in each); scrub the "Demo" parenthetical from `featuredHint` in BOTH (line 191 in each). Order of ops: delete Auth accounts → delete files → scrub history → force-push (RESEARCH.md lines 452-470).

## Shared Patterns

### SECURITY DEFINER function hardening
**Source:** `schema.sql` `handle_new_user()` (lines 63-85), `is_admin()` (91-101); `messages_unread.sql` `mark_conversation_read()` (14-47).
**Apply to:** `create_notification()`, `log_admin_action()`, `guard_profiles_update()`, `guard_products_update()`, `guard_products_insert()`.
**Invariant:** every new function gets `language plpgsql` (or `sql`) + `security definer` + `set search_path = public`. Pre-empts SEC-07.

### Admin gate
**Source:** `public.is_admin()` (schema.sql:91-101) — reuse, never reimplement.
**Apply to:** audit SELECT policy, `log_admin_action()` body, all guard-trigger admin-exemption branches.
> `auth.uid()` (and thus `is_admin()`) returns the *calling* user's id even inside SECURITY DEFINER — correct for guard triggers (RESEARCH.md line 152).

### Owner-scoped RLS predicate
**Source:** `favorites_*` policies (schema.sql:147-149) and `reports_select_own` (reports.sql:38-40) — `auth.uid() = user_id`.
**Apply to:** notifications SELECT/UPDATE policies; products SELECT owner branch.

### Idempotent realtime publication
**Source:** `messages.sql` lines 92-111; `reports.sql` lines 58-68.
**Apply to:** `notifications.sql` only. Never `create publication`; only guarded `alter publication ... add table`.

### Idempotency idioms (manual re-run safe)
**Source:** across all supabase/*.sql — `create table if not exists`, `add column if not exists` (messages_unread.sql:7-9), `drop policy if exists; create policy`, `drop trigger if exists; create trigger`, `create or replace function`, `do $$ ... if not exists (pg_publication_tables) ...`.
**Apply to:** every new/modified SQL file (no migration runner — RESEARCH.md Pitfall 6).

## No Analog Found

None. Every file maps to an existing codebase precedent.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | All patterns have direct analogs in `cabofeira/supabase/`. |

## Metadata

**Analog search scope:** `cabofeira/supabase/` (schema.sql, reports.sql, messages.sql, messages_unread.sql, storage_product_images.sql); `cabofeira/src/context/ProductsContext.jsx`; `cabofeira/src/data/seedUsers.js`; `cabofeira/src/pages/Login.jsx`; `cabofeira/src/i18n/{en,pt-cv}.json`.
**Files scanned:** 11
**Pattern extraction date:** 2026-06-07
