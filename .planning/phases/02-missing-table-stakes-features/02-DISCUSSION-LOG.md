# Phase 2: Missing Table-Stakes Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 2-missing-table-stakes-features
**Areas discussed:** Anti-spam (CAPTCHA + rate limits), Block user behavior, Mark-as-sold UX, Notifications bell, Remaining features (defaults accepted)

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Anti-spam (CAPTCHA + limits) | Provider + server-side rate-limit policy | ✓ |
| Block user behavior | What blocking hides/prevents; symmetry | ✓ |
| Mark-as-sold UX | Control placement, reversibility, sold visibility | ✓ |
| Notifications bell | Events fed, presentation, mark-read | ✓ |

**User's choice:** All four areas selected.

---

## Anti-spam — CAPTCHA provider

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Turnstile | Free, privacy-friendly, native Supabase Auth support | ✓ |
| hCaptcha | Native Supabase Auth support; image challenges | |
| reCAPTCHA v3 | Invisible; NOT native to Supabase Auth (custom verify everywhere) | |

**User's choice:** Cloudflare Turnstile
**Notes:** Native Supabase Auth integration on signup was the deciding factor.

## Anti-spam — Rate limit

| Option | Description | Selected |
|--------|-------------|----------|
| 5 ads / 24h | Generous daily cap | |
| 3 ads / 24h | Tighter daily cap | |
| 10 ads / hour | Looser daily volume, short window; tolerates bulk sellers | ✓ |

**User's choice:** 10 ads / hour
**Notes:** Chosen to accommodate legit dealership-style bulk posting while still stopping rapid bot bursts.

## Anti-spam — CAPTCHA scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both signup + post | Native on signup; server-side token verify on post | ✓ |
| Signup only for now | Cheaper; relies on rate limit for posting; partial ABUSE-02 | |

**User's choice:** Both signup + post

## Anti-spam — Limit logic

| Option | Description | Selected |
|--------|-------------|----------|
| Count all inserts in window, friendly block | Deletion can't reset counter; clear "try again" message | ✓ |
| Count active listings only | Simpler; delete-and-repost can evade | |

**User's choice:** Count all inserts in window, friendly block

---

## Block user — Effects (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Hide existing conversations/messages | Baseline FEAT-05 | ✓ |
| Block new messages from B | Server-side enforced, not cosmetic | ✓ |
| Hide B's listings from A's browse | Stronger "never see this person" semantics | ✓ |
| Block control on profile + thread + unblock list | Where A initiates/manages blocks | ✓ |

**User's choice:** All four effects.
**Notes:** Full-strength block. Hiding listings from browse adds per-viewer filtering surface (RLS-vs-app-level deferred to planner).

## Block user — Symmetry / visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Mutual invisibility, silent to B | Standard pattern; avoids retaliation | ✓ |
| One-way: only A stops seeing B | Simpler; B keeps messaging into a void | |

**User's choice:** Mutual invisibility, silent to B

---

## Mark-as-sold — Control & reversibility

| Option | Description | Selected |
|--------|-------------|----------|
| My Ads, reversible | Control on My Ads list; sold↔active toggle via ConfirmDialog | ✓ |
| My Ads + Product detail (owner view), reversible | Also on detail page; more surfaces | |
| My Ads, one-way (sold final) | Re-post to relist; less flexible | |

**User's choice:** My Ads, reversible

## Mark-as-sold — Public visibility of sold

| Option | Description | Selected |
|--------|-------------|----------|
| Stay visible with a 'Sold' badge | Track-record signal; gone from feed/search; sets up reviews | ✓ |
| Disappear entirely from public view | Cleaner; loses seller track-record signal | |

**User's choice:** Stay visible with a 'Sold' badge
**Notes:** Requires relaxing Phase 1's products SELECT policy to expose `status='sold'` publicly while keeping expired/hidden owner-only (CONTEXT D-14).

---

## Notifications bell — Events

| Option | Description | Selected |
|--------|-------------|----------|
| New message only | Smallest correct FEAT-08 slice | |
| New message + system | Also generic system notices via same plumbing | ✓ |
| New message + report outcome | Closes moderation loop; more admin wiring | |

**User's choice:** New message + system

## Notifications bell — UX / mark-read

| Option | Description | Selected |
|--------|-------------|----------|
| Navbar dropdown, mark-read on open | Bell + count; dropdown list; opening clears unread | ✓ |
| Dropdown, mark-read per item on click | Count lingers until each item clicked | |
| Dedicated /notifications page | Mailbox-style page; mark-read on visit | |

**User's choice:** Navbar dropdown, mark-read on open

---

## Claude's Discretion

- Turnstile server-side post-verification mechanism (Edge Function vs RPC + `pg_net`).
- Block-listing browse filtering: RLS vs app-level filter.
- New SQL file organization in `cabofeira/supabase/`.
- Keeping new_message notification consistent with the existing unread-message badge.
- Whether to also place mark-as-sold on the owner's product-detail view.
- **Remaining features accepted with defaults** (report reasons set + silent dedup + admin reason filter; WhatsApp button + extended share; verified badge on cards + profile; audit-log writes for the 4 admin mutations + read-only admin viewer tab).

## Deferred Ideas

- Report-outcome notifications (bell) — deferred; wired for new_message + system only.
- Mark-as-sold on product-detail owner view — optional polish.
- Saved-search / price-drop notifications — v2.
- Listing expiry+renewal, ratings/reviews, moderation queue, transactional emails, phone masking, richer profiles — v1.x/v2.
