---
phase: 02-missing-table-stakes-features
plan: 03
subsystem: marketplace-listings
tags: [feat-01, feat-04, sold-status, badges, i18n, rls-pairing]
requires:
  - "02-02: products_sold_visibility.sql SELECT relax (status IN active,sold public)"
provides:
  - "ProductsContext.updateProduct status passthrough (mark-as-sold round-trip)"
  - "Active-only feed (refreshProducts) + active-default search (fetchProducts) — closes the D-14 sold-leak window"
  - "fetchProducts status override (array/string) for the Plan 02-04 public-profile sold list"
  - "MyAds reversible mark-as-sold/mark-as-active control (ConfirmDialog, danger=false)"
  - "ProductCard sold + verified badges; .badge-sold CSS"
affects:
  - "Home/Search now exclude sold listings"
  - "Plan 02-04 will consume fetchProducts({status:[active,sold]}) for the public seller profile"
tech-stack:
  added: []
  patterns:
    - "Optimistic status flip via updateProduct cache mirror (no manual patch needed)"
    - "Badge stacking via .card-badges flex-column wrapper (sold over featured, 8px gap)"
key-files:
  created: []
  modified:
    - cabofeira/src/context/ProductsContext.jsx
    - cabofeira/src/pages/MyAds.jsx
    - cabofeira/src/components/ProductCard.jsx
    - cabofeira/src/components/ProductCard.css
    - cabofeira/src/index.css
    - cabofeira/src/i18n/en.json
    - cabofeira/src/i18n/pt-cv.json
decisions:
  - "Used existing product.verified key (not a new badge.verified) for the card verified pill, consistent with ProductDetail (Task 3 instruction for the key-differs case)"
  - "Added common.error bilingual key (Rule 2) — UI-SPEC referenced existing common.error but it did not exist; needed for the mark-sold failure toast"
  - "Chose the neutral-grey .badge-sold variant (#e5e7eb/#374151) over the red-tint option (UI-SPEC offered either)"
  - "Stacked sold+featured via a .card-badges flex wrapper because the existing .card-image-wrap .badge rule pins every badge to the same absolute slot"
metrics:
  duration_min: 13
  completed: 2026-06-15
  tasks: 3
  files: 7
---

# Phase 2 Plan 3: Mark-as-Sold + Sold/Verified Badges Summary

Sellers can mark a listing sold (and back to active) from My Ads via a reversible ConfirmDialog; sold ads leave Home/Search (the app now filters `status='active'`, closing the D-14 sold-leak window opened by the 02-02 SELECT relax) while showing a neutral Sold badge on cards, and verified sellers get a verified pill on product cards — all strings bilingual.

## What Was Built

### Task 1 — ProductsContext: status passthrough + active-only feed/search
- `updateProduct` now copies `status` into `dbPatch` so `updateProduct(id,{status:'sold'|'active'})` round-trips (the Phase-1 `guard_products_update` does not pin status, so owner updates are allowed).
- `refreshProducts` (the 200-item Home cache) gained `.eq("status","active")` — required now that RLS permits public `sold` (Pitfall 1 / D-14). This is the security-relevant pairing called out in the plan context.
- `fetchProducts` gained a `status` option defaulting to `"active"`: array → `.in("status", …)`, string → `.eq("status", …)`. Search stays active-only; Plan 02-04 can pass `status:["active","sold"]` for the public seller profile.
- Commit: `8bc31b7`

### Task 2 — MyAds mark-as-sold control
- Added a per-ad button between Edit and Delete, labelled `myAds.markSold` when active / `myAds.markActive` when sold.
- Opens a non-danger `ConfirmDialog` (`danger=false`, no `requireText`) with the sold/active title+body copy from UI-SPEC §Destructive confirmations.
- Confirm calls `updateProduct(id,{status: …})`; the context already mirrors the change into the products cache, so the row's label and inline Sold badge update without a manual optimistic patch. On error, surfaces `common.error` via `toast.error`.
- Added bilingual keys: `myAds.markSold/markActive/markSoldTitle/markSoldBody/markActiveTitle/markActiveBody` and `common.error` in both `en.json` and `pt-cv.json`.
- Commit: `9cca241`

### Task 3 — ProductCard sold + verified badges + .badge-sold CSS
- `index.css`: `.badge-sold` (`#e5e7eb`/`#374151`) — `.badge` geometry, NOT yellow (featured) or success-green.
- `ProductCard.css`: `.card-badges` flex-column wrapper so sold + featured stack 8px apart (sold on top) in the existing absolute slot.
- `ProductCard.jsx`: renders the Sold badge in the image slot and a verified pill (`product.verified`, natural badge scale) on the meta line. `product.status` and `product.seller.verified` already flow via `fromRow` — no query change.
- Added bilingual `badge.sold` (Sold / Vendido).
- Commit: `58198d0`

## Verification

- `npm run build` (CRA) compiles successfully after each task — `Compiled successfully.`
- `grep -c "status.*active" ProductsContext.jsx` → 3 (passthrough comment + refreshProducts + fetchProducts default).
- `.badge-sold` present in `index.css`; `badge-sold` + `t("badge.sold")` present in `ProductCard.jsx`.
- `badge.sold` and all six `myAds.*` keys + `common.error` exist in BOTH `en.json` and `pt-cv.json`; both JSON files parse.

## Threat Model Outcome

- **T-02-04 (Information Disclosure — sold leak):** MITIGATED. `refreshProducts` and `fetchProducts` default to `status='active'`, shipped in the same plan as the relax-dependent UI per the mitigation plan.
- **T-02-10 (Tampering — non-owner status flip):** ACCEPTED as planned. Status passthrough rides the already-guarded products UPDATE path (Phase-1 guard + RLS with-check `auth.uid()=seller_id`); no new write authority added.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added `common.error` i18n key**
- **Found during:** Task 2
- **Issue:** UI-SPEC §Error states says the mark-sold failure toast should "reuse existing `common.error`", but no `common.error` key existed in either dictionary. Without it the failure toast would render the literal string `common.error`.
- **Fix:** Added `common.error` ("Something went wrong. Please try again." / "Algo correu mal. Por favor tenta novamente.") to both `en.json` and `pt-cv.json`.
- **Files modified:** cabofeira/src/i18n/en.json, cabofeira/src/i18n/pt-cv.json
- **Commit:** 9cca241

### Decisions within plan latitude

- **Verified key:** Plan Task 3 said reuse `badge.verified` "if the existing key differs (e.g. product.verified), use the existing one." It does differ — the existing key is `product.verified` (used by ProductDetail), so the card uses `product.verified`. No `badge.verified` key was created.
- **Sold color:** UI-SPEC offered grey OR red-tint; chose grey (`#e5e7eb`/`#374151`).
- **Badge stacking:** Added a `.card-badges` flex wrapper because the existing `.card-image-wrap .badge` rule absolutely pins every badge to `top:10px;left:10px` (they would otherwise overlap).

## Known Stubs

None. All wired to live data (`product.status`, `product.seller.verified`, `updateProduct`).

## Follow-ups for Later Plans

- **Plan 02-04 (public seller profile):** call `fetchProducts({ sellerId, status: ["active","sold"] })` to show sold ads with the badge (D-13), and add `.badge-sold` to the ProductDetail `.detail-tags` row (UI-SPEC §1 notes the detail badge is Plan 02-04).

## Self-Check: PASSED

All 5 key files exist on disk; all 3 task commits (8bc31b7, 9cca241, 58198d0) present in git history.
