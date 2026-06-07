# CaboFeira

## What This Is

CaboFeira is a Cape Verde–focused online marketplace (classifieds) web app where people post, browse, and message about listings — vehicles, real estate, electronics, fashion, jobs, services, and more. It's a React 19 single-page app backed entirely by Supabase (Postgres, Auth, Storage, Realtime), with English and Cape Verdean Portuguese (pt-CV) localization. This milestone is a **pre-launch hardening-and-completion pass**: add the marketplace features users expect, make sure every feature actually works, and close all security holes before real users arrive.

## Core Value

A trustworthy marketplace where a buyer can find a listing and safely contact the seller — and a seller can post a listing that real buyers will see. If everything else fails, **browse → find → message must work, and no user can be harmed by a security hole.**

## Requirements

### Validated

<!-- Inferred from existing code via .planning/codebase/ map. These already exist in the app; "validated" here means "built", not yet "QA-confirmed working" — confirming they work is part of the Correctness goal below. -->

- ✓ Email/password auth: sign up, login, logout, password reset, session persistence — existing (`src/context/AuthContext.jsx`)
- ✓ User profiles (name, phone, bio, avatar, member-since, verified flag) — existing (`profiles` table, `src/pages/Profile.jsx`)
- ✓ Post an ad: 3-step form with category/subcategory, details, up to 6 images (5MB each) to Supabase Storage — existing (`src/pages/PostAd.jsx`)
- ✓ Edit / delete own ads — existing (`PostAd.jsx`, `src/pages/MyAds.jsx`)
- ✓ Browse listings: home feed (200 most recent cached), category pages, product detail with view counter — existing (`Home.jsx`, `Categories.jsx`, `ProductDetail.jsx`)
- ✓ Search & filter: keyword, category/subcategory, island/city, price range, sort, server-side pagination — existing (`src/pages/Search.jsx`, `ProductsContext.fetchProducts`)
- ✓ Favorites (save/unsave listings) — existing (`favorites` table, `src/pages/Favorites.jsx`)
- ✓ Buyer↔seller private messaging with realtime delivery and unread badges — existing (`conversations`/`messages` tables, `MessagesContext.jsx`, `Messages.jsx`)
- ✓ Report a listing — existing (`reports` table, `ProductDetail.jsx`)
- ✓ Admin panel: manage users (role/verify), manage ads, review reports, set posting prices — existing (`src/pages/Admin.jsx`)
- ✓ Admin-controlled posting prices per category + featured surcharge, synced live — existing (`app_settings` table, `PricingContext.jsx`)
- ✓ Internationalization: English + Cape Verdean Portuguese with locale detection — existing (`src/i18n/`)

### Active

<!-- This milestone's three thrusts. Specifics for the Features thrust are decided after competitor research; the Correctness and Security thrusts are scoped from the codebase map. -->

**Feature completeness (sequenced first — informed by competitor research):**
- [ ] Add missing marketplace features users expect (set determined by research; candidates: ratings/reviews & seller reputation, saved searches / alerts, structured report reasons, in-app notifications, listing expiry/renewal, share links, richer seller profiles)

**Correctness — every feature works (manual QA + fix):**
- [ ] Exercise every existing feature end-to-end, find bugs, and fix them (auth flows, posting/editing, image upload edge cases, search/filter combinations, messaging + realtime, favorites, reports, admin actions, i18n coverage)
- [ ] Fix known issues surfaced in the codebase map (e.g. product cache staleness across users, swallowed async/storage-cleanup errors, unread-badge race, null-safety gaps, stale password-recovery flag)

**Security — no errors or backdoors (before launch):**
- [ ] Close privilege-escalation hole: `profiles` self-update RLS lets a user set their own `role`/`verified` (`supabase/schema.sql:126`) — restrict mutable columns
- [ ] Audit & harden all RLS policies, `security definer` functions, and storage policies
- [ ] Remove/secure demo-account backdoors (hardcoded `admin123`/`user123` in `schema.sql` comments; ensure no demo admin exists in prod)
- [ ] Validate redirect params (open-redirect in `Login.jsx:15`), tighten image upload validation, add admin audit logging, confirm secrets never committed (`.env.local`)

### Out of Scope

- Automated test suite (Jest/Playwright/E2E) — user chose manual QA + fix for this milestone; revisit post-launch — *deferred, not rejected*
- Native mobile apps — web-first; mobile is a future milestone
- Payment processing / online transactions — listings reference posting prices but the app is contact-the-seller classifieds, not checkout — *out of scope for v1*
- Message encryption — noted in concerns; defer unless research/compliance forces it
- Large architectural rewrites (e.g. splitting the 600-line Admin/PostAd components) beyond what correctness/security fixes require — *defer to keep this pass focused*

## Context

- **Existing brownfield app** fully mapped in `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS). Read these before planning.
- **Stack:** React 19.1, React Router 7.6, `@supabase/supabase-js` 2.105, Create React App tooling, vanilla CSS, react-icons. No TypeScript, no state library — feature domains live in React Context providers.
- **Backend:** Supabase only — Postgres + Auth + Storage (`product-images` public bucket) + Realtime. Schema/RLS live in `cabofeira/supabase/*.sql` and must be applied via the Supabase SQL editor (not auto-migrated).
- **Repo layout:** the actual app is in the `cabofeira/` subdirectory of the repo root; planning lives at repo-root `.planning/`.
- **Near-zero test coverage today** — `tests/unit` and `tests/e2e` exist but are essentially empty.
- **Pre-launch:** no real users yet, so refactors and schema changes are low-risk and security must be airtight before go-live.

## Constraints

- **Tech stack**: Stay on React 19 + Supabase + CRA — No rewrite; extend the existing Context-based architecture and conventions (see `.planning/codebase/CONVENTIONS.md`).
- **Backend changes**: SQL schema/RLS edits ship as new files in `cabofeira/supabase/` and are applied manually in Supabase — No automated migration runner exists.
- **Testing approach**: Manual QA + fix, not an automated suite — User decision for this milestone.
- **Localization**: Every new user-facing string must exist in both `en.json` and `pt-cv.json` — App is bilingual by design.
- **Security bar**: No backdoors, no privilege escalation, no leaked secrets before launch — Explicit project goal.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Sequence: Features → Correctness (QA) → Security hardening | User priority; pre-launch so hardening can be the final gate before go-live | — Pending |
| Manual QA + fix instead of automated test suite | User wants working features now without test-suite investment; revisit post-launch | — Pending |
| Feature set chosen after competitor research, together | User wants research to surface gaps before committing scope | — Pending |
| Treat existing built features as "Validated/built" but still QA them | Built ≠ verified-working; correctness thrust must confirm each | — Pending |
| No payments/checkout in v1 | App is contact-the-seller classifieds, not transactional commerce | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after initialization*
