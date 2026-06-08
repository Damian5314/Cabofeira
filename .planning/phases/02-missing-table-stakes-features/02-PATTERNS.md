# Phase 2: Missing Table-Stakes Features - Pattern Map

**Mapped:** 2026-06-08
**Files analyzed:** 26 (new + modified)
**Analogs found:** 25 / 26 (1 has no in-repo analog: Edge Function)

> **How to use this map.** Every new/modified file below points at a real, current file in this
> repo to copy patterns from, with line anchors and the concrete excerpt. The planner should
> reference the analog file + lines in each PLAN.md action and apply the noted adaptation. SQL
> ships as new per-concern files in `cabofeira/supabase/` applied manually (no migration runner);
> all React work extends the existing Context architecture. Every new user-facing string MUST be
> added to BOTH `cabofeira/src/i18n/en.json` AND `pt-cv.json` (nested namespaces, English fallback).

---

## File Classification

### New SQL files (`cabofeira/supabase/`)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `blocked_users.sql` | migration (table + RLS + helper fn) | CRUD + access-control | `cabofeira/supabase/reports.sql` (table+RLS) + `admin_audit_log.sql` (SECURITY DEFINER fn) | exact |
| `messages_block_rls.sql` | migration (RLS rewrite + INSERT guard) | access-control | `cabofeira/supabase/messages.sql` L58-87 (existing convo/message policies) | exact |
| `reports_reason.sql` | migration (ALTER: CHECK + unique) | CRUD constraint | `cabofeira/supabase/reports.sql` (same table) + `notifications.sql` L11 (`text + CHECK`) | exact |
| `products_sold_visibility.sql` | migration (relax SELECT policy) | access-control | `cabofeira/supabase/schema.sql` L155 (`products_select_active_or_owner_or_admin`) | exact |
| `product_post_log.sql` | migration (log table + BEFORE/AFTER triggers) | event-driven + batch-count | `cabofeira/supabase/security_guards.sql` L84-107 (BEFORE INSERT guard) + `messages.sql` L32-49 (AFTER INSERT trigger) | role-match |
| `new_message_notification.sql` | migration (AFTER INSERT trigger → fan-out) | event-driven | `cabofeira/supabase/messages.sql` L32-49 (`bump_conversation_last_message`) + `notifications.sql` L54 (`create_notification`) | exact |

### New Edge Function

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `cabofeira/supabase/functions/verify-turnstile/index.ts` | service (Deno serverless) | request-response | **none in repo** | no analog (use RESEARCH.md §Edge Function) |

### New React files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `cabofeira/src/context/NotificationsContext.jsx` | provider/context | event-driven (realtime) | `cabofeira/src/context/MessagesContext.jsx` (realtime sub + mark-read) | exact |

### Modified React files

| Modified File | Role | Data Flow | Closest Analog (pattern source) | Match Quality |
|---------------|------|-----------|---------------------------------|---------------|
| `src/context/ProductsContext.jsx` | provider | CRUD | self (`updateProduct` L195, `refreshProducts` L82, `fetchProducts` L124, `toggleFavorite` L250 optimistic) | self |
| `src/context/MessagesContext.jsx` | provider | event-driven | self (subscription L69-92) | self |
| `src/context/AuthContext.jsx` | provider | request-response | self (`register` L128, `setUserRole` L215, `setUserVerified` L230) + `admin_audit_log.sql` L52 | self |
| `src/context/PricingContext.jsx` | provider | CRUD (debounced) | self (`persistPrices` L75, `setPrice` L106) | self |
| `src/components/Navbar.jsx` | component | event-driven (display) | self (unread badge L118/L130, user-menu dropdown L109-151) | self |
| `src/components/ProductCard.jsx` | component | display | self (featured badge L17-19) + ProductDetail verified badge L310-314 | self |
| `src/pages/ProductDetail.jsx` | page | display + CRUD | self (`share` L167, contact buttons L254-275, report modal L416-466, verified badge L310) | self |
| `src/pages/MyAds.jsx` | page | CRUD | Admin.jsx delete flow L432-445 (`askConfirm` + ConfirmDialog) | role-match |
| `src/pages/Profile.jsx` | page | CRUD | reports.sql RLS owner-scope (block list) + ProductDetail verified badge L310-314 | partial |
| `src/pages/Messages.jsx` | page | CRUD | Admin.jsx `askConfirm` L432-445 (block control via ConfirmDialog) | role-match |
| `src/pages/Admin.jsx` | page | CRUD + display | self (tabs L179-204, reports load L44-70, mutations L249/L275/L438) | self |
| `src/pages/Register.jsx` | page | request-response | self (form L77-163, submit L30-47) + RESEARCH widget snippet | self |
| `src/pages/PostAd.jsx` | page | request-response | self (`submit` L173-206) | self |
| `src/index.css` | config (styles) | — | self (`.badge-verified` L180-183, `.badge-featured` L175-178) | self |
| `src/components/Navbar.css` | config (styles) | — | self (`.unread-badge` L205, `.dropdown` L230, `.user-trigger` L148) | self |
| `src/i18n/en.json` + `pt-cv.json` | config (i18n) | — | self (nested namespaces, e.g. `common`/`nav` L2-30) | self |
| `cabofeira/src/App.jsx` | config (wiring) | — | self (provider nesting L31-75) | self |

---

## Pattern Assignments

### `cabofeira/supabase/blocked_users.sql` (table + RLS + helper, access-control)

**Analog:** `cabofeira/supabase/reports.sql` (table shape, RLS idempotent block, realtime guard) + `admin_audit_log.sql` (SECURITY DEFINER fn pattern).

**Table + idempotent RLS pattern** (reports.sql L6-53):
```sql
create table if not exists public.reports ( ... reporter_id uuid not null references public.profiles(id) on delete cascade, ... );
alter table public.reports enable row level security;
drop policy if exists "reports_insert_authed" on public.reports;   -- idempotent drop-then-create
create policy "reports_insert_authed" on public.reports for insert with check (reporter_id = auth.uid());
create policy "reports_select_own" on public.reports for select using (reporter_id = auth.uid());
```

**SECURITY DEFINER helper fn pattern** (admin_audit_log.sql L52-65, notifications.sql L62-66):
```sql
create or replace function public.log_admin_action(...)
returns uuid language plpgsql
security definer
set search_path = public          -- SEC-07 hardening — required on EVERY new fn
as $$ ... $$;
```

**Adaptation:** Create `blocked_users (blocker_id, blocked_id, created_at, primary key (blocker_id,blocked_id), check (blocker_id <> blocked_id))` both FK→`profiles(id) on delete cascade`. Three owner-scoped policies (`blocked_select_own`/`blocked_insert_own`/`blocked_delete_own`) all keyed on `auth.uid() = blocker_id` (mirror reports.sql owner policies). Add `is_blocked_pair(a,b) returns boolean language sql stable security definer set search_path = public` (mirror the `is_admin()`/`log_admin_action` definer convention). Use the exact RESEARCH.md §"blocked_users table + helper" SQL. NO realtime publication needed (block list is not live-subscribed). **Ordering:** this file applies FIRST (messages_block_rls + new_message_notification depend on `is_blocked_pair`).

---

### `cabofeira/supabase/messages_block_rls.sql` (RLS rewrite + INSERT guard, access-control)

**Analog:** `cabofeira/supabase/messages.sql` L58-87 — the existing conversation/message policies this file rewrites.

**Existing policies to rewrite** (messages.sql L60-87):
```sql
create policy "conversations_select_participant" on public.conversations for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "messages_insert_participant" on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (select 1 from public.conversations c
                 where c.id = messages.conversation_id
                   and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())));
```

**Adaptation:** Re-issue all three policies with `drop policy if exists ...; create policy ...` (idempotent — same convention as messages.sql L58-68), appending `and not public.is_blocked_pair(buyer_id, seller_id)` to the `using`/`with check`. The INSERT `with check` failing is what makes a blocked send "silently not deliver" (D-08) — the client swallows the RLS error (NO "you are blocked" copy — UI-SPEC §Error states). Use RESEARCH.md §"Block-aware messaging RLS". **This is the HIGH-severity server-side enforcement boundary (D-09 #2) — a client-only block is a blocking finding.** Applies AFTER `blocked_users.sql`.

---

### `cabofeira/supabase/reports_reason.sql` (ALTER: CHECK + unique, CRUD constraint)

**Analog:** `cabofeira/supabase/reports.sql` (target table) + `notifications.sql` L11 (`text + CHECK` enum convention).

**`text + CHECK` enum pattern** (notifications.sql L11):
```sql
type text not null check (type in ('new_message','saved_search','price_drop','system')),
```

**Adaptation:** `alter table public.reports add constraint reports_reason_check check (reason in ('scam','spam','prohibited','already_sold','duplicate','other'))` and `add constraint reports_reporter_product_uniq unique (reporter_id, product_id)`. **Pitfall 4 (RESEARCH):** existing free-text `reason` rows will violate the CHECK — prepend `update public.reports set reason = 'other' where reason not in (...)` (backfill) OR add constraint `NOT VALID` then `VALIDATE`. Planner adds a pre-apply `select count(*) ... where reason not in (...)` step. Applies BEFORE the report-modal value change + admin reason filter.

---

### `cabofeira/supabase/products_sold_visibility.sql` (relax SELECT policy, access-control)

**Analog:** `cabofeira/supabase/schema.sql` L153-155 (the exact policy being relaxed).

**Policy to relax** (schema.sql L155):
```sql
create policy "products_select_active_or_owner_or_admin" on public.products for select
  using (status = 'active' or auth.uid() = seller_id or public.is_admin());
```

**Adaptation:** `drop policy if exists "products_select_active_or_owner_or_admin" on public.products;` then recreate with `status in ('active','sold')` (keep `expired`/`hidden` owner/admin-only — D-14, threat: do NOT widen to all statuses). **MUST be applied paired with the `ProductsContext` `.eq('status','active')` feed/search edits (Pitfall 1)** — otherwise Home/Search leak sold ads. The guard triggers (`security_guards.sql`) are UNCHANGED: `guard_products_insert` L99 pins `status='active'` for non-admins (sold is reachable only via UPDATE — correct), `guard_products_update` does NOT pin status (mark-as-sold works).

---

### `cabofeira/supabase/product_post_log.sql` (rate limit: log + triggers, event-driven)

**Analog:** `cabofeira/supabase/security_guards.sql` L84-107 (BEFORE INSERT guard on products) + `messages.sql` L32-49 (AFTER INSERT trigger pattern).

**BEFORE INSERT guard pattern** (security_guards.sql L84-107):
```sql
create or replace function public.guard_products_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;   -- admin-exempt branch, auth.uid() reads JWT even in definer
  ...
  return new;
end; $$;
drop trigger if exists trg_guard_products_insert on public.products;
create trigger trg_guard_products_insert before insert on public.products
  for each row execute function public.guard_products_insert();
```

**AFTER INSERT trigger pattern** (messages.sql L46-49):
```sql
drop trigger if exists trg_bump_conversation on public.messages;
create trigger trg_bump_conversation after insert on public.messages
  for each row execute function public.bump_conversation_last_message();
```

**Adaptation:** Append-only `product_post_log (id, user_id, created_at)` with NO cascading FK to products (Pitfall 2 — must survive hard `removeProduct` DELETE). RLS enabled, NO client policies (rows enter only via the AFTER-INSERT definer trigger). `enforce_post_rate_limit()` BEFORE INSERT counts `user_id = new.seller_id and created_at > now() - interval '1 hour'`; if `>= 10` → `raise exception 'RATE_LIMIT' using errcode='P0001', detail='ad_post_rate_limit'`. **Divergence flag (RESEARCH):** unlike the Phase-1 guards' SILENT RESET (D-19), the rate-limit guard RAISES — that is correct and intended (D-06: block + friendly localized message). `log_product_post()` AFTER INSERT writes the log row. Admin-exempt via `if public.is_admin() then return new;`. Use RESEARCH.md §"Rate limit, hard-delete-proof". **This is the bypass-resistant backstop for ABUSE-01 — DB-enforced, not client.**

---

### `cabofeira/supabase/new_message_notification.sql` (fan-out trigger, event-driven)

**Analog:** `cabofeira/supabase/messages.sql` L32-49 (`bump_conversation_last_message` AFTER INSERT on messages) + `notifications.sql` L54-86 (`create_notification` — the sole insert path).

**The fan-out fn it calls** (notifications.sql L54, L76):
```sql
create or replace function public.create_notification(p_user_id uuid, p_type text, p_title text, ...) ...
  if p_user_id <> auth.uid() and not public.is_admin() then raise exception 'Not authorized'; end if;  -- cross-user gate
```

**Adaptation:** `notify_new_message()` AFTER INSERT on `messages`, `security definer set search_path = public` (Pitfall 3 — definer context satisfies the cross-user gate; MUST be tested with two real accounts, Assumption A2). Resolve the recipient from `conversations` (the non-sender participant), short-circuit `if public.is_blocked_pair(new.sender_id, v_recipient) then return new; end if` (D-08/D-10 — no bell for blocked pairs), then `perform public.create_notification(v_recipient, 'new_message', v_sender_name, left(new.body,140), jsonb_build_object('conversation_id', new.conversation_id, 'sender_id', new.sender_id), '/messages')`. Use RESEARCH.md §"Pattern 3". Applies AFTER `blocked_users.sql` (needs `is_blocked_pair`).

---

### `cabofeira/src/context/NotificationsContext.jsx` (NEW provider, realtime event-driven)

**Analog:** `cabofeira/src/context/MessagesContext.jsx` — the closest realtime-subscription provider (exact match: same `useAuth()`, `refresh` callback, channel keyed on user, cleanup, optimistic mark-read).

**Provider + hook skeleton** (MessagesContext.jsx L1-14, L126-130):
```jsx
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
const MessagesContext = createContext(null);
export function MessagesProvider({ children }) { const { user } = useAuth(); ... }
export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error("useMessages must be used within MessagesProvider");
  return ctx;
}
```

**Realtime subscription + cleanup pattern** (MessagesContext.jsx L69-92) — copy verbatim, change table/filter:
```jsx
useEffect(() => {
  if (!user) return;
  const channel = supabase
    .channel(`unread-${user.id}`)                                   // → `notif-${user.id}`
    .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },   // → table: "notifications", filter: `user_id=eq.${user.id}`
        () => refresh())                                            // → (payload) => setNotifications(prev => [payload.new, ...prev])
    .subscribe();
  return () => { supabase.removeChannel(channel); };                // Pitfall 6 — MUST tear down, keyed on user
}, [user, refresh]);
```

**Optimistic mark-read pattern** (MessagesContext.jsx L94-113):
```jsx
const markRead = useCallback(async (conversationId) => {
  setUnreadByConv((prev) => { ... });                               // optimistic local clear
  const { error } = await supabase.rpc("mark_conversation_read", { ... });
  if (error) { console.error("[messages-unread] mark_read:", error); }
}, []);
```

**Adaptation:** `refresh()` does `select * from notifications order by created_at desc limit 20` (RLS owner-scoped already — notifications.sql L32). `markAllRead()` sets `read_at = now()` for shown unread on dropdown open (D-17), optimistic + `supabase.from("notifications").update({read_at}).in("id", unreadIds)` (RLS `notifications_update_own` permits). Expose `{ notifications, unreadCount, markAllRead, markReadForConversation, refresh }`. For D-19 consistency, also mark a `new_message` notification read when its conversation opens — call `markReadForConversation(convId)` from `MessagesContext.markRead` or the Messages page (Claude's discretion; flag if it conflicts with D-17). Use the `[notifications] ...` console prefix convention. **Wire into App.jsx alongside `MessagesProvider`** (see App.jsx pattern below).

---

### `cabofeira/src/context/ProductsContext.jsx` (MODIFY — feed filter + mark-as-sold)

**Analog:** self.

**Mark-as-sold already works through the existing update path** — but `updateProduct` (L195-220) does NOT currently copy `status` into `dbPatch`. Add:
```jsx
if ("status" in patch) dbPatch.status = patch.status;   // ADD to updateProduct L195-209 — enables {status:'sold'} / {status:'active'}
```

**Feed/search status filter** (Pitfall 1 — REQUIRED, paired with `products_sold_visibility.sql`):
```jsx
// refreshProducts L82-86 — add .eq("status","active")
.from("products").select(PRODUCT_SELECT).eq("status", "active").order("created_at", { ascending: false }).range(0, 199);
// fetchProducts L124-126 — add a status option (default 'active'); seller PUBLIC profile passes status:['active','sold']
```

**Block browse-filter** (D-09 #3, Pitfall 5 — app-level, best-effort UX, NOT a security boundary): fetch the viewer's block list once into context (or AuthContext) and filter `products`/`fetchProducts` results client-side at render. Do NOT push per-viewer block subqueries into RLS. Optimistic-update pattern to mirror = `toggleFavorite` (L250-265).

---

### `cabofeira/src/context/AuthContext.jsx` (MODIFY — signup CAPTCHA + audit writes)

**Analog:** self.

**signUp call to extend** (AuthContext.jsx L138-142):
```jsx
const { data, error } = await supabase.auth.signUp({
  email, password,
  options: { data: { name, phone: phone || "" } },   // ADD: captchaToken
});
```

**Adaptation (CAPTCHA):** thread a `captchaToken` arg through `register(form)` into `options: { data: {...}, captchaToken }` (RESEARCH §"Turnstile widget on Register"). Keep the `{ ok, error }` return convention (L143/L146).

**Audit-write pattern** for `setUserRole` (L215-228) and `setUserVerified` (L230-240) — after the successful `profiles` update, before `return { ok:true }`:
```jsx
await supabase.rpc("log_admin_action", {
  p_action: "change_role", p_target_table: "profiles", p_target_id: userId,
  p_details: { old_role: prevRole, new_role: role },   // serialize before/after — D-12
});
```
**Adaptation (ADMIN-01, D-26):** capture the previous value before the update (read from `users` state or the returned row), wire `change_role` into `setUserRole` and `verify_user` (`{old, new}`) into `setUserVerified`. Both are already `isAdmin`-gated (L216/L231), and `log_admin_action` has its own in-fn admin gate.

---

### `cabofeira/src/context/PricingContext.jsx` (MODIFY — audit writes on price change)

**Analog:** self — the debounced persist (`persistPrices` L75-87, `setPrice` L106-112).

**Adaptation (D-26):** wire `log_admin_action("change_price", "app_settings", null, {category, old, new})` on the PERSISTED write (inside `persistPrices`/`persistFeatured` L78-80 / L92-94, after the successful upsert — NOT on every keystroke, since `setPrice` fires debounced). Use the `await supabase.rpc("log_admin_action", {...})` shape above.

---

### `cabofeira/src/components/Navbar.jsx` (MODIFY — notification bell)

**Analog:** self — the existing unread-message badge + user-menu dropdown (L108-151).

**Unread badge pattern to mirror** (Navbar.jsx L118, L130):
```jsx
{unreadTotal > 0 && <span className="unread-dot" aria-hidden="true" />}        // dot on avatar
{unreadTotal > 0 && <span className="unread-badge">{unreadTotal}</span>}       // count pill — REUSE for bell
```

**Dropdown shell pattern** (Navbar.jsx L109-151): `user-menu` wrapper with `ref`, `user-trigger` button (`aria-haspopup`, `aria-expanded`), conditional `.dropdown` with links.

**Adaptation (FEAT-08):** add a bell button (white glyph `FiBell`, UI-SPEC §3) LEFT of the user menu, with a `.unread-badge` count (reuse the EXACT class — red `#e11d48`, D-19 color consistency). Clicking opens a `.dropdown` (widen to ~320px) listing `notifications` from `useNotifications()`; each item links to `/messages` (new_message) or the listing; opening calls `markAllRead()` (D-17). Empty state "No notifications yet". `aria-label="Notifications ({count} unread)"`, Escape + outside-click close (mirror the user-menu `menuRef` behavior). Bell is ADDITIVE — the existing Messages `.unread-badge` (L130) stays (D-19).

---

### `cabofeira/src/components/ProductCard.jsx` (MODIFY — sold + verified badges)

**Analog:** self (featured badge L17-19) + ProductDetail verified badge (L310-314).

**Badge insertion pattern** (ProductCard.jsx L17-19):
```jsx
{product.featured && (
  <span className="badge badge-featured">{t("product.featuredBadge")}</span>
)}
```

**Verified badge pattern** (ProductDetail.jsx L310-314):
```jsx
{product.seller.verified && (
  <span className="badge badge-verified" title={t("product.verified")}>{t("product.verified")}</span>
)}
```

**Adaptation:** Add `{product.status === "sold" && <span className="badge badge-sold">{t("badge.sold")}</span>}` in the `.card-image-wrap` badge slot (same absolute slot as featured; if both, stack 8px, sold wins priority — UI-SPEC §1). Add the verified pill near the seller/meta line (reuse exact `.badge-verified`, no enlarge — UI-SPEC §2). `product.status` + `product.seller.verified` already flow via `fromRow` (ProductsContext L45/L52) — no query change.

---

### `cabofeira/src/pages/ProductDetail.jsx` (MODIFY — WhatsApp, share, structured report, sold badge)

**Analog:** self.

**`share()` to extend** (L167-179):
```jsx
const share = async () => {
  const url = window.location.href;
  if (navigator.share) { try { await navigator.share({ title: product.title, url }); } catch {} }
  else { navigator.clipboard.writeText(url); toast.success(t("product.linkCopied")); }
};
```
**Adaptation (FEAT-07):** keep native `navigator.share`; add explicit fallback row — "Share on WhatsApp" (`https://wa.me/?text=<title + URL>`) and "Copy link" (`FiLink` → clipboard → `t("product.linkCopied")` toast). Lay out as `.btn-outline` row.

**Contact-button group to extend** (L254-275): the `product.seller.phone &&` gate (L254) is the exact precedent for the WhatsApp button.
**Adaptation (FEAT-06):** add a WhatsApp button in `.action-row` (compact `8px 6px` padding), `#25D366` bg + `FaWhatsapp` + `t("product.contactWhatsapp")`, rendered ONLY when `product.seller.phone` (D-23), linking `https://wa.me/<phone>?text=<encodeURIComponent(title + url)>` with `target="_blank" rel="noopener noreferrer"`.

**Report `<select>` + insert to restructure** (L416-450):
```jsx
<select className="report-select" value={reportReason} onChange={...}>
  <option>{t("product.report.reason1")}</option>   // ← currently stores the LABEL
</select>
const { error } = await supabase.from("reports").insert({ product_id, reporter_id: user.id, reason: reportReason, details });
```
**Adaptation (FEAT-02/03):** switch to a radio-group (or `<option value="scam">…`) so the STORED value is the enum key (`scam`/`spam`/`prohibited`/`already_sold`/`duplicate`/`other`), with bilingual labels (UI-SPEC §6 key table → `report.reason.*`). Change the insert from `.insert(...)` to `.upsert({...}, { onConflict: "reporter_id,product_id", ignoreDuplicates: true })` so a duplicate is SILENTLY deduped (D-21 — never a hard error; show calm "already reported" state, never the report-error box).

**Sold badge:** add `{product.status === "sold" && <span className="badge badge-sold">{t("badge.sold")}</span>}` to the `.detail-tags` row (L230-240).

---

### `cabofeira/src/pages/MyAds.jsx` (MODIFY — mark-as-sold control)

**Analog:** `cabofeira/src/pages/Admin.jsx` L432-445 — the `askConfirm` + `ConfirmDialog` delete flow this mirrors.

**Confirm-dialog action pattern** (Admin.jsx L432-445):
```jsx
onClick={() => askConfirm({
  title: "Delete this ad?", message: `...`, confirmLabel: "🗑 Delete ad", danger: true,
  action: async () => { await removeProduct(p.id); ... },
})}
```

**Adaptation (FEAT-01):** add a per-ad button next to edit/delete, toggling label `t("myAds.markSold")` / `t("myAds.markActive")` based on `status`. On click open `ConfirmDialog` with `danger=false` (reversible — UI-SPEC §"Destructive confirmations" note), confirm copy `myAds.markSoldTitle`/`Body`. `action` calls `updateProduct(id, { status: status === "sold" ? "active" : "sold" })`. Optimistic UI mirror = `toggleFavorite` (ProductsContext L250). Note: `updateProduct` must be patched to pass `status` (see ProductsContext above).

---

### `cabofeira/src/pages/Messages.jsx` + `cabofeira/src/pages/Profile.jsx` (MODIFY — block/unblock)

**Analog:** Admin.jsx `askConfirm`+`ConfirmDialog` (L432-445) for the block control; `reports.sql` owner-scoped RLS for the block-list query shape.

**Adaptation (FEAT-05, D-09 #4):**
- **Block control** in the message thread (Messages.jsx) and seller Profile: `.btn-outline`/text button (`FiSlash`, `t("profile.blockUser")`) → `ConfirmDialog` with `danger=true`, confirm "Block" (`profile.blockTitle`/`Body`). Action: `supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: targetId })` (RLS `blocked_insert_own`). After block, the conversation disappears (RLS-driven; `MessagesContext.refresh` re-runs).
- **Unblock list** in Profile/settings: query `supabase.from("blocked_users").select(...).eq("blocker_id", user.id)`; each row = avatar + name + `.btn-outline` "Unblock" (`FiUserCheck`, non-danger ConfirmDialog) → `.delete().match({ blocker_id, blocked_id })`. Empty state `profile.noBlockedTitle`/`Body`.
- **Silent (D-08):** never surface "you are blocked"; the blocked send's RLS error is swallowed client-side (UI-SPEC §Error states — intentionally no copy).

---

### `cabofeira/src/pages/Admin.jsx` (MODIFY — audit tab, reports reason filter, audit-write on delete)

**Analog:** self.

**Tab-bar pattern to extend** (Admin.jsx L179-204):
```jsx
<div className="admin-tabs">
  <button className={tab === "reports" ? "is-active" : ""} onClick={() => setTab("reports")}>🚩 Reports (...)</button>
</div>
```

**Realtime + load pattern to mirror for the audit tab** (Admin.jsx L44-70):
```jsx
const loadReports = useCallback(async () => {
  const { data, error } = await supabase.from("reports").select(`...`).order("created_at", { ascending: false });
  if (!error) setReports(data || []);
}, []);
```

**Delete-ad audit write** (RESEARCH §Audit-log wiring; the delete lives at Admin.jsx L438-443): wrap `removeProduct(p.id)` so that — only when `isAdmin` — it ALSO calls `log_admin_action("delete_ad", "products", p.id, {title})`. **Caveat (RESEARCH):** `removeProduct` is shared by sellers; only call `log_admin_action` from the admin path (non-admin sellers would hit the admin-gated RPC and error).

**Adaptation (ADMIN-02, FEAT-02):**
- New `audit` tab (reuse `.admin-tabs button`/`.is-active`). Read-only `.admin-table` (Action · Target · Actor · Timestamp via `timeAgo`). Load via a `loadAudit` callback mirroring `loadReports` (L44-54) querying `admin_audit_log` (RLS admin-only SELECT already exists — no new SQL). Filter `<select>` by action + Prev/Next pagination (`range`) mirroring `loadAds` (L89-106).
- Reports tab gains a reason `<select>` filter (six `report.reason.*` + "All reasons"); filter client-side over loaded `reports` or pass to the query.

---

### `cabofeira/src/pages/Register.jsx` (MODIFY — signup CAPTCHA widget)

**Analog:** self (form L77-163, submit L30-47) + RESEARCH §"Turnstile widget on Register".

**Form submit to extend** (Register.jsx L30-47): `handleSubmit` calls `register(form)` and reads `result.ok` / `result.needsConfirmation`.

**Adaptation (ABUSE-02 signup):**
```jsx
import { Turnstile } from "@marsidev/react-turnstile";
const [captchaToken, setCaptchaToken] = useState("");
const turnstileRef = useRef(null);
// inside the form (after the terms checkbox, before submit btn L160):
<Turnstile siteKey={process.env.REACT_APP_TURNSTILE_SITE_KEY} onSuccess={setCaptchaToken} ref={turnstileRef} />
// pass token into register; on failure show t("captcha.failed"); reset widget after submit (single-use token)
```
Thread `captchaToken` into `register({ ...form, captchaToken })` → AuthContext `signUp` (see AuthContext above). On a `{ ok:false }` CAPTCHA failure surface `t("captcha.failed")` via the existing `.auth-error` block (L59). Env var follows CRA `REACT_APP_*` convention (Assumption A6).

---

### `cabofeira/src/pages/PostAd.jsx` (MODIFY — posting CAPTCHA + rate-limit surfacing)

**Analog:** self (`submit` L173-206).

**Submit + error pattern to extend** (PostAd.jsx L173-206):
```jsx
const submit = async () => {
  ...
  try { const created = await addProduct(payload); ... }
  catch (err) { setErrors({ submit: err.message || t("postAd.errors.submitFailed") }); setSubmitting(false); }
};
```

**Adaptation (ABUSE-02 posting + ABUSE-01 surfacing):**
- Render `<Turnstile .../>` in the final step (mirror Register). Before `addProduct`, call `const { data } = await supabase.functions.invoke("verify-turnstile", { body: { token } })` and only proceed when `data.success`; else show `t("captcha.failed")`.
- In the `catch` (L202-205), map the rate-limit coded error: if `err.message`/details indicate `ad_post_rate_limit` (the `P0001 RATE_LIMIT` raised by `enforce_post_rate_limit()`), show `t("postAd.rateLimit", { minutes })` + a toast (D-06) instead of the generic `submitFailed`.

---

## Shared Patterns

### SECURITY DEFINER function convention (ALL new SQL functions)
**Source:** `cabofeira/supabase/admin_audit_log.sql` L52-65, `notifications.sql` L62-66, `security_guards.sql` L26-31.
**Apply to:** `is_blocked_pair`, `enforce_post_rate_limit`, `log_product_post`, `notify_new_message`.
```sql
create or replace function public.fn_name(...)
returns ... language plpgsql
security definer
set search_path = public          -- SEC-07: required on every definer fn
as $$ begin ... end; $$;
```
Note: `auth.uid()` inside a definer fn reads the JWT (the CALLER), so `if public.is_admin() then return new; end if` correctly reflects the caller (security_guards.sql L11-13). This is how admins are exempted from the rate limit and how `notify_new_message` clears the cross-user gate.

### Idempotent RLS + realtime publication (ALL new/altered SQL)
**Source:** `cabofeira/supabase/reports.sql` L28-53 (drop-then-create policies), L58-68 (realtime guard).
**Apply to:** `blocked_users.sql`, `messages_block_rls.sql`, `product_post_log.sql`.
```sql
drop policy if exists "name" on public.tbl;
create policy "name" on public.tbl for <op> using (...) with check (...);
-- realtime (only if the table is live-subscribed):
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tbl')
  then alter publication supabase_realtime add table public.tbl; end if;
end $$;
```
Every file opens with the `-- run this in the Supabase SQL editor` banner (applied manually, no migration runner).

### Audit-write wiring (ADMIN-01)
**Source:** `cabofeira/supabase/admin_audit_log.sql` L52 (`log_admin_action` signature).
**Apply to:** AuthContext `setUserRole`/`setUserVerified`, PricingContext `persistPrices`/`persistFeatured`, Admin.jsx delete-ad.
```jsx
await supabase.rpc("log_admin_action", {
  p_action: "<verb>", p_target_table: "<table>", p_target_id: <uuid|null>,
  p_details: { old: ..., new: ... },          // serialize before/after — D-12
});
```
Only call from admin-gated paths (the RPC has an in-fn `is_admin()` gate; non-admins error). Capture the previous value BEFORE the mutation.

### Optimistic-UI + async DB sync
**Source:** `ProductsContext.jsx` `toggleFavorite` L250-265; `MessagesContext.jsx` `markRead` L94-113.
**Apply to:** mark-as-sold (MyAds), mark-read (NotificationsContext `markAllRead`), block/unblock. Update local state immediately, then fire the async Supabase mutation; log (not throw) on error with the `[module] op: msg` console prefix.

### Bilingual i18n key addition
**Source:** `cabofeira/src/i18n/en.json` (nested namespaces, e.g. `common`/`nav` L2-30); I18n fallback (`getNested(DICTS[locale], key) ?? getNested(DICTS.en, key) ?? key`).
**Apply to:** EVERY new string. Add the same nested key to BOTH `en.json` AND `pt-cv.json`. New namespaces this phase (from UI-SPEC §Copywriting): `badge.sold`, `myAds.markSold`/`markActive`/`markSoldTitle`/`markSoldBody`/`markActiveTitle`/`markActiveBody`, `product.contactWhatsapp`/`shareWhatsapp`/`copyLink`, `profile.blockUser`/`unblock`/`blockTitle`/`blockBody`/`unblockTitle`/`unblockBody`/`noBlockedTitle`/`noBlockedBody`, `notifications.title`/`emptyTitle`/`emptyBody`, `report.reason.{scam,spam,prohibited,alreadySold,duplicate,other}`/`report.alreadyReported`/`report.submit`, `postAd.rateLimit`, `captcha.failed`, `admin.audit.{action,target,actor,time}`/`auditEmpty`/`auditFilterEmpty`/`reportsAllReasons`/`reportsFilterEmpty`.

### Provider nesting (App.jsx)
**Source:** `cabofeira/src/App.jsx` L31-75.
```jsx
<AuthProvider><ProductsProvider><PricingProvider><MessagesProvider>
  {/* add <NotificationsProvider> here — INSIDE AuthProvider so useAuth() is available */}
</MessagesProvider></PricingProvider></ProductsProvider></AuthProvider>
```
**Apply to:** `NotificationsProvider` — nest alongside `MessagesProvider` (inside `AuthProvider`).

### Badge CSS convention
**Source:** `cabofeira/src/index.css` `.badge` L165, `.badge-verified` L180-183, `.badge-featured` L175-178.
```css
.badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:0.72rem; font-weight:600; color:var(--cf-text); }
.badge-verified { background:#dbeafe; color:var(--cf-blue); }   /* REUSE unchanged for card+profile */
```
**Apply to:** new `.badge-sold` — identical geometry to `.badge` (`2px 8px`, `999px`, `0.72rem`, `600`); muted/neutral or red-tint fill, NOT yellow (reserved) and NOT success-green (UI-SPEC §Color). `.badge-verified` reused UNCHANGED.

### Bell unread count CSS
**Source:** `cabofeira/src/components/Navbar.css` `.unread-badge` L205 (`#e11d48`), `.unread-dot` L180, `.dropdown` L230-267 (+ mobile L400-421).
**Apply to:** the bell count — REUSE `.unread-badge` (red `#e11d48`, white) so it reads as one system with the Messages badge (D-19). Dropdown reuses `.dropdown` (widen for notification rows); mobile follows the existing static-in-drawer treatment.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cabofeira/supabase/functions/verify-turnstile/index.ts` | service (Deno Edge Function) | request-response | No Edge Functions exist in this repo yet; the entire backend is RLS/RPC. Use the exact RESEARCH.md §"Edge Function: verify-turnstile" Deno snippet. Secret `CLOUDFLARE_SECRET_KEY` via `supabase secrets set` (NEVER `REACT_APP_*` — would leak to the bundle, Assumption A6). Deployment is via Supabase CLI/dashboard, not the SQL editor. Flag: Edge Function availability UNVERIFIED (Open Q1) — planner adds a `checkpoint:human-verify`. |

---

## Metadata

**Analog search scope:** `cabofeira/supabase/*.sql` (reports, notifications, admin_audit_log, messages, schema, security_guards), `cabofeira/src/context/*.jsx` (Products, Messages, Auth, Pricing), `cabofeira/src/pages/*.jsx` (ProductDetail, Admin, Register, PostAd, MyAds), `cabofeira/src/components/*` (Navbar, ProductCard, ConfirmDialog), `cabofeira/src/index.css`, `cabofeira/src/components/Navbar.css`, `cabofeira/src/i18n/en.json`, `cabofeira/src/App.jsx`.
**Files scanned:** ~20 source files read for excerpts.
**Pattern extraction date:** 2026-06-08
