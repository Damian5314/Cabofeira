---
phase: 02-missing-table-stakes-features
plan: 02
status: complete-with-deferral
completed: 2026-06-15
requirements: [FEAT-01, FEAT-02, FEAT-03, FEAT-05, FEAT-08, ABUSE-01]
deferred_requirements: [ABUSE-02]
---

# Plan 02-02 Summary — Human Apply/Provision Gate

## Outcome: COMPLETE WITH DEFERRAL

The human operator applied all six Phase-2 SQL files to the live Supabase DB. The
Cloudflare-dependent CAPTCHA provisioning (Turnstile keys, Auth CAPTCHA toggle, Edge
Function deploy) and the two-account notification sanity test were **explicitly skipped
by the operator** (steps 4–7 of the checkpoint) because Cloudflare Turnstile cannot be
set up at this time.

## What is now LIVE (operator-confirmed "I did the sql")

All six SQL files applied in dependency order:
1. `blocked_users.sql` — table + RLS + `is_blocked_pair()` helper
2. `messages_block_rls.sql` — block-aware conversations/messages SELECT + messages INSERT (server-side block boundary)
3. `new_message_notification.sql` — AFTER-INSERT trigger → `create_notification()` (powers the bell)
4. `reports_reason.sql` — backfill + reason CHECK enum + `(reporter_id, product_id)` unique (dedup)
5. `products_sold_visibility.sql` — SELECT relaxed to active+sold (pairs with Plan 02-03 app filter)
6. `product_post_log.sql` — append-only rate-limit log + BEFORE-INSERT guard (≥10/hr) + AFTER-INSERT writer

→ Backend support is live for: mark-as-sold/sold-visibility (FEAT-01), structured reports + dedup
(FEAT-02/03), block-user enforcement (FEAT-05), new-message notifications (FEAT-08), and the
server-side post rate limit (ABUSE-01).

## What is DEFERRED (ABUSE-02 — Turnstile CAPTCHA)

Operator skipped checkpoint steps 4–7:
- Cloudflare Turnstile widget / Site Key + Secret Key — NOT provisioned
- Supabase Auth native CAPTCHA toggle — NOT enabled
- `verify-turnstile` Edge Function deploy + `supabase secrets set` — NOT done
- Two-account `create_notification` sanity test — NOT run (the trigger SQL is applied; only the
  live smoke test was skipped)

Consequences for downstream execution:
- **`@marsidev/react-turnstile` was NOT installed** (Plan 02-02 Task 1 install gated behind this
  checkpoint) — it is unused without a Site Key.
- **Plan 02-07 will ship only its ABUSE-01 half** (friendly surfacing of the DB rate-limit error).
  The ABUSE-02 CAPTCHA wiring on signup (`AuthContext`/`Register`) and posting (`PostAd` +
  `verify-turnstile` invoke) is DEFERRED so the app does not break on a missing Turnstile Site Key.
- The authored artifacts (`functions/verify-turnstile/index.ts`, the 6 SQL files) remain committed
  and ready — wiring CAPTCHA later is a small follow-up: provision Turnstile, deploy the Edge
  Function, enable the Auth toggle, `npm install @marsidev/react-turnstile@1.5.2`, then wire the
  widget into Register + PostAd.

## Artifacts changed
- `cabofeira/.env.example` — documented `REACT_APP_TURNSTILE_SITE_KEY` placeholder (empty) with a
  note that it is deferred and that the secret key is server-only (never `REACT_APP_`).

## Follow-up required to close ABUSE-02
A dedicated follow-up (e.g. a Phase 2.1 or an item folded into Phase 4) must: provision Cloudflare
Turnstile, deploy `verify-turnstile` + set `CLOUDFLARE_SECRET_KEY`, enable Supabase Auth CAPTCHA,
install `@marsidev/react-turnstile@1.5.2`, and wire the widget into signup + posting with
server-side token verification before insert.

## Self-Check: PASSED (with documented deferral)
SQL applied per operator; CAPTCHA infra deferred by explicit operator decision. No code was wired
against un-provisioned Turnstile infrastructure.
