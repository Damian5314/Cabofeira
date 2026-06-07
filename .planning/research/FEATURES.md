# Feature Research

**Domain:** Online classifieds marketplace (contact-the-seller, no checkout) — Cape Verde / Lusophone niche ("CaboFeira")
**Researched:** 2026-06-07
**Confidence:** MEDIUM-HIGH (HIGH on table-stakes patterns from major classifieds; MEDIUM on Cape Verde-specific behavior, which is inferred from regional/national-statistics sources rather than direct competitor data)

## How To Read This

This is a brownfield completion pass. Every table below marks each feature as **HAS** (already built in CaboFeira) or **MISSING**. Only MISSING features carry a complexity (S/M/L) and dependency note, since HAS features just need QA, not building.

**Complexity key (for THIS stack — React 19 + Supabase, Context providers, manual SQL migrations, bilingual strings required):**
- **S** = 1 table or column + 1 context method + small UI; < a day
- **M** = new table(s) + RLS + new context or context extension + multiple UI surfaces + i18n
- **L** = cross-cutting: new subsystem, background jobs/Edge Functions, or touches auth/moderation deeply

## Feature Landscape

### Table Stakes (Users Expect These — absence loses trust)

These are non-negotiable for a classifieds launch. Users don't reward them, but penalize their absence.

| Feature | Status | Why Expected | Complexity | Notes / Dependencies |
|---------|--------|--------------|------------|----------------------|
| Browse / category / detail | HAS | Core of any classifieds | — | QA only |
| Search + filter + pagination | HAS | Discovery is the product | — | QA only |
| Post / edit / delete own ads with images | HAS | Sellers must self-serve | — | QA only |
| Email/password auth + profiles | HAS | Account ownership | — | QA only |
| Buyer↔seller messaging | HAS | "Contact the seller" is the transaction here | — | QA only |
| Favorites / save listing | HAS | Shortlisting is universal | — | QA only |
| Report a listing | HAS (free-text) | Abuse reporting baseline | — | See "structured report reasons" below — current free-text is weak |
| Admin: users / ads / reports / pricing | HAS | Operator control | — | QA only |
| EN / pt-CV i18n | HAS | Bilingual market | — | QA only |
| **Structured report reasons (dropdown + categories)** | MISSING | Users expect "why are you reporting" choices (scam/spam/prohibited/sold/duplicate); free-text is amateur and unactionable | **S** | Add `reason` enum column to `reports`; update report modal; admin filter by reason. Dep: existing `reports` table. Flagged in CONCERNS.md. |
| **Block a user** | MISSING | Every messaging marketplace lets you stop harassment; its absence is a trust red flag | **M** | New `blocked_users` table + RLS; filter conversations/messages; hide blocker's ads optional. Dep: messaging, auth. |
| **Mark listing as Sold / Active status** | MISSING | Buyers waste time on sold items; sellers want to "close" without deleting (and keep reviews/history). Universal on OLX/Marktplaats/FB | **S** | Add `status` enum (`active`/`sold`/`expired`/`hidden`) to products; filter feed to active; "Mark as sold" on MyAds. Dep: products schema. Foundation for expiry + reviews. |
| **In-app notifications (new message, ad approved, report outcome)** | MISSING | Users expect to know when something happens; email-only or nothing feels broken | **M** | New `notifications` table + realtime subscription (pattern exists in MessagesContext/PricingContext); bell UI in Navbar. Dep: realtime infra (exists). |
| **Listing expiry + renewal** | MISSING | Stale listings erode trust and search quality; OLX/Jiji/Craigslist all expire ads (typically 30–60 days) and let owners renew | **M** | `expires_at` column + scheduled Supabase Edge Function/cron to set `status=expired`; "Renew" button. Dep: status field above + a scheduled job (new infra). |
| **Phone number masking / verified contact + safe-meetup guidance** | MISSING | Sellers expose raw phone in profile today; users expect protection and basic safety messaging | **M** | Optionally hide phone behind "reveal" or keep in-app messaging primary; add safety tips banner on detail/message. Dep: profile schema, messaging. Trust-critical. |
| **Email/transactional notifications (already have welcome mail)** | PARTIAL | New-message and report-outcome emails are expected; only welcome mail exists today | **M** | Supabase Edge Function + email provider; templates bilingual. Dep: email infra (partially exists per git log "Welcome mail"). |

### Trust, Safety & Moderation (its own table-stakes cluster — the Core Value is "trustworthy")

PROJECT.md Core Value is *"a buyer can find a listing and safely contact the seller… no user can be harmed."* For a classifieds app this cluster IS table stakes, not a differentiator.

| Feature | Status | Why It Matters | Complexity | Notes / Dependencies |
|---------|--------|----------------|------------|----------------------|
| Report listing | HAS (weak) | Baseline abuse channel | — | Upgrade to structured reasons (S, above) |
| Admin review reports + delete ad | HAS | Operator moderation | — | QA only |
| Verified-user flag | HAS (manual) | Trust signal | — | Surfaced as a badge? Confirm it renders to buyers |
| **Listing moderation queue / pre-publish review (optional/risk-based)** | MISSING | Lets operator hold first-time or flagged ads before they're public; standard in OLX-class platforms | **M** | `status=pending` + admin approve; can be config-gated (auto-approve trusted users). Dep: status field. Avoid blocking ALL ads (kills supply in a small market) — gate to new accounts or flagged categories. |
| **Anti-spam: per-user post rate limits** | MISSING | Stops bulk spam/scam flooding — the #1 classifieds abuse vector | **S–M** | Count recent ads per user in a window; enforce in `addProduct` + RLS/DB check. Dep: products. |
| **Duplicate-report dedup + reporter tracking** | MISSING | Prevents one product getting 50 reports = noise; track abusive reporters | **S** | Unique-ish constraint on (reporter, product); count per product in admin. Dep: reports. Flagged in CONCERNS.md. |
| **Block user (listed above as table stakes too)** | MISSING | Harassment control | M | See above |
| **Admin audit log** | MISSING | Accountability for delete/promote/price actions; needed before launch per CONCERNS.md | **M** | `admin_actions` table written by admin mutations; simple admin view. Dep: admin panel. Flagged in CONCERNS.md + PROJECT security thrust. |
| **Verified-seller badge surfaced to buyers** | PARTIAL | A `verified` flag exists but value is only realized if buyers SEE it on cards/detail | **S** | Render badge on product card, detail, seller profile. Dep: existing flag. High trust ROI for low cost. |
| **Prohibited-items policy + reasons in report** | MISSING | Operators need to remove illegal/regulated goods cleanly | **S** | Content policy page (bilingual) + report reason enum value. Dep: report reasons. |
| **CAPTCHA / bot protection on signup + post** | MISSING | Stops automated account/ad spam | **S** | Add lightweight CAPTCHA (e.g. hCaptcha/Turnstile) to register + post. Dep: auth, post form. Cheap insurance. |

### Differentiators (Competitive Advantage — esp. Cape Verde / Lusophone niche)

Not required, but where CaboFeira can win. These should align with the small-market, mobile-first, WhatsApp-heavy reality of Cape Verde (majority access internet via mobile; WhatsApp ubiquitous regionally; Vinti4 is the domestic digital-payment rail; cash-on-meetup common).

| Feature | Value Proposition | Complexity | Notes / Dependencies |
|---------|-------------------|------------|----------------------|
| **WhatsApp "Contact seller" button** | In Cape Verde/Lusophone Africa, WhatsApp is the default conversational-commerce channel. A `wa.me/<number>?text=` deep link from a listing meets buyers where they already are and dramatically lifts contact rates | **S** | Build link from seller phone + prefilled listing title; show alongside in-app message. Dep: seller phone in profile. Highest-ROI differentiator for this market. |
| **Seller ratings & reviews / reputation** | Trust is the scarce resource in a small market where buyer and seller may know each other socially. Star ratings tied to completed deals build a reputation graph OLX/Jiji rely on | **L** | `reviews` table (reviewer, seller, rating, text, product), aggregate on profile, gate to users who messaged/transacted to limit fake reviews. Dep: messaging + "sold" status (proof-of-interaction). Heavy: RLS, anti-abuse, aggregation. |
| **Saved searches + new-listing alerts** | Brings buyers back ("notify me when a Toyota appears in Praia"). Retention engine that classifieds leaders all run | **M** | `saved_searches` table storing filter params; matcher (Edge Function on insert, or on-login diff) + notification. Dep: notifications + search filter model. |
| **Price-drop alerts on favorites** | Re-engages buyers who shortlisted; pairs naturally with favorites + notifications | **S–M** | On product price UPDATE, notify favoriters. Dep: notifications, favorites, realtime. |
| **Native pt-CV (Cape Verdean Creole) UX, not just generic PT** | Genuine local language is a moat global players (OLX/FB) don't bother with; already partly built | **S** | Audit pt-CV coverage; ensure category/region names are truly local. Dep: existing i18n. Low cost, real differentiation. |
| **Island/region-aware discovery & "near me on my island"** | Cape Verde is an archipelago; cross-island logistics are real friction. Filtering/sorting by island + intra-island proximity is genuinely useful and locally specific | **S–M** | Island filter exists; add "my island first" default sort + neighborhood/city granularity. Dep: existing location data. |
| **Featured / promoted listings (already monetized via pricing)** | App already has a featured surcharge — surfacing featured ads prominently is the proven classifieds revenue model and an operator differentiator | **S** | `is_featured` + sort/badge in feed and category. Dep: existing pricing/featured concept — verify it actually renders featured ads, not just charges. |
| **Share listing (link + WhatsApp share)** | Social distribution is how listings spread in WhatsApp-first markets; one tap to share to a group | **S** | Web Share API + wa.me share + copy-link. Dep: public product URLs (exist). Candidate already noted in PROJECT.md. |
| **Richer seller profiles (member-since, # listings, response indicator)** | Builds buyer confidence before contacting; cheap trust signals | **S** | Aggregate counts on profile page. Dep: products/messaging data. |

### Anti-Features (Deliberately do NOT build for a contact-the-seller v1)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Online checkout / cart / card payment** | "Real marketplaces sell" | App is explicitly contact-the-seller (PROJECT.md out-of-scope). In Cape Verde, deals settle cash-on-meetup or via Vinti4/mobile money OUTSIDE the app; building checkout adds PCI scope, payment-provider integration, refunds, and chargebacks with near-zero local demand | Keep transactions offline; provide WhatsApp/in-app contact + safe-meetup guidance. Revisit only with PMF. |
| **Escrow / buyer-protection / payment holds** | "Protect buyers from scams" | Requires being a money-services business: licensing, dispute arbitration, fraud liability — wildly out of scope for a small launch | Trust features instead: verification, ratings, reporting, safe-meetup tips, block. |
| **Integrated shipping / delivery booking** | "Like the big platforms" | Cape Verde's inter-island logistics are bespoke; no courier API to integrate; huge ops burden | Let buyer/seller arrange offline; maybe a "delivery available" boolean on listings (S) instead of real shipping. |
| **End-to-end message encryption** | "Privacy" | PROJECT.md defers it; adds key-management complexity, breaks moderation/search, blocks abuse review. For meetup-coordination chat the value is low vs cost | Standard RLS + TLS; moderation visibility; defer unless compliance forces it (matches PROJECT decision). |
| **Native mobile apps (now)** | "Everyone's on mobile" | True that Cape Verde is mobile-first — but that's an argument for a great mobile WEB experience now, not a separate native build this milestone (PROJECT out-of-scope) | Mobile-responsive PWA-quality web; add to home screen; native later. |
| **Public comments on listings** | "Engagement" | Spam magnet, moderation sink, and leaks contact attempts outside the report-able channel; classifieds use private messaging for a reason | Private buyer↔seller messaging (already built). |
| **Auctions / bidding** | "Maximize price" | Different product entirely; needs timers, bid integrity, anti-sniping, payment — not classifieds | Fixed price + "negotiable" flag; let price be discussed in chat. |
| **Algorithmic/personalized feed ranking** | "Like FB Marketplace" | Over-engineering for current scale; recency + island + featured is enough and explainable | Simple recency/featured/island sort; revisit at scale. |
| **Automated AI content moderation pipeline (now)** | "Catch all bad listings" | Heavy infra (model hosting/3rd-party cost) for a small catalog; false positives kill thin supply | Rate limits + structured reports + optional review queue for new users; add AI later if volume demands. |

## Feature Dependencies

```
Listing status (active/sold/expired/hidden)   [FOUNDATION — build early]
    ├──enables──> Mark as Sold
    ├──enables──> Listing expiry + renewal ──requires──> Scheduled job (Edge Function/cron)
    └──enables──> Moderation queue (pending status)

Notifications subsystem (table + realtime + bell)   [FOUNDATION]
    ├──enables──> In-app new-message alerts
    ├──enables──> Saved searches + new-listing alerts ──requires──> Saved searches table + matcher
    ├──enables──> Price-drop alerts ──requires──> Favorites (HAS)
    └──enhances──> Report-outcome + ad-approved alerts

Structured report reasons (enum on reports)
    ├──enables──> Duplicate-report dedup + reporter tracking
    └──enhances──> Admin moderation efficiency

Messaging (HAS)
    ├──requires-before──> Block user
    └──proof-of-interaction-for──> Seller ratings & reviews ──also-requires──> "Sold" status

Seller phone (HAS, profile)
    └──enables──> WhatsApp contact button + WhatsApp share

Admin panel (HAS)
    └──requires-for-launch──> Admin audit log
```

### Dependency Notes

- **Listing `status` field is the keystone.** Mark-as-sold, expiry/renewal, and the moderation queue all hang off one enum column. Build it in an early phase so later features compose cheaply.
- **Notifications is the second keystone.** In-app message alerts, saved-search alerts, and price-drop alerts all need one `notifications` table + the realtime pattern that already exists in `MessagesContext`/`PricingContext`. Build the subsystem once.
- **Ratings/reviews require "sold" + messaging as proof-of-interaction** to limit fake reviews — don't build reviews before status exists, or you'll have no abuse gate.
- **Block user must precede or accompany any reputation feature** — without blocking, harassment scales with engagement.
- **Scheduled job is new infra** (no cron today; manual SQL only). Listing expiry forces introducing a Supabase Edge Function / pg_cron — sequence accordingly.

## MVP Definition (for this pre-launch completion milestone)

### Launch With (v1 — trust + correctness floor)

Ruthlessly: the smallest set that makes the app feel complete and safe.

- [ ] **Structured report reasons** (S) — cheap, removes an amateur edge, makes moderation real
- [ ] **Listing status + Mark as Sold** (S) — keystone; removes the "is this still available?" trust killer
- [ ] **Block user** (M) — harassment safety floor for a messaging app
- [ ] **Verified-seller badge surfaced to buyers** (S) — realize value of a flag you already store
- [ ] **WhatsApp contact button** (S) — single highest-ROI feature for THIS market
- [ ] **Share listing (link + WhatsApp)** (S) — distribution in a WhatsApp-first market
- [ ] **In-app notifications: new message at minimum** (M) — closes the messaging loop
- [ ] **Admin audit log** (M) — security/accountability gate before real users (PROJECT security thrust)
- [ ] **Anti-spam post rate limit + CAPTCHA on signup/post** (S–M) — block automated abuse from day one

### Add After Validation (v1.x)

- [ ] **Saved searches + new-listing alerts** (M) — retention engine; trigger once supply is steady
- [ ] **Listing expiry + renewal** (M) — once catalog ages and staleness becomes visible
- [ ] **Price-drop alerts on favorites** (S–M) — re-engagement, after notifications proven
- [ ] **Moderation/approval queue for new users** (M) — turn on if spam appears despite rate limits
- [ ] **Richer seller profiles** (S) — incremental trust polish
- [ ] **Transactional emails beyond welcome (new message, report outcome)** (M)

### Future Consideration (v2+)

- [ ] **Seller ratings & reviews / reputation** (L) — high value but heavy and abuse-prone; needs sold+messaging maturity and an anti-fake-review gate. Defer until there's real transaction volume to review.
- [ ] **"Delivery available" listing flag** (S) — lightweight nod to logistics without building shipping
- [ ] **AI-assisted moderation** — only if listing volume outgrows manual + rate limits

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Structured report reasons | MEDIUM | LOW | P1 |
| Listing status + Mark as Sold | HIGH | LOW | P1 |
| WhatsApp contact button | HIGH | LOW | P1 |
| Verified-seller badge surfaced | MEDIUM | LOW | P1 |
| Block user | HIGH | MEDIUM | P1 |
| Admin audit log | MEDIUM (ops/trust) | MEDIUM | P1 |
| Anti-spam rate limit + CAPTCHA | HIGH | LOW-MED | P1 |
| In-app notifications (messages) | HIGH | MEDIUM | P1/P2 |
| Share listing | MEDIUM | LOW | P1/P2 |
| Saved searches + alerts | HIGH | MEDIUM | P2 |
| Listing expiry + renewal | MEDIUM | MEDIUM | P2 |
| Price-drop alerts | MEDIUM | LOW-MED | P2 |
| Moderation/approval queue (new users) | MEDIUM | MEDIUM | P2 |
| Richer seller profiles | LOW-MED | LOW | P2/P3 |
| Seller ratings & reviews | HIGH | HIGH | P3 |

**Priority key:** P1 = build this milestone (trust + safety + market-fit floor) · P2 = next, after validation · P3 = defer until PMF/volume.

## Competitor Feature Analysis

| Feature | OLX / Jiji (emerging-market classifieds) | Facebook Marketplace | Marktplaats / Craigslist | CaboFeira Approach |
|---------|------------------------------------------|----------------------|--------------------------|--------------------|
| Contact channel | In-app chat + phone + (Jiji) WhatsApp | Messenger only | In-app/email; phone | In-app chat (HAS) **+ add WhatsApp button** |
| Seller verification | Verified-seller badge (ID/phone) | FB account trust | Light | Has `verified` flag — **surface it**; consider phone verify later |
| Ratings/reviews | Yes (Jiji) | Buyer/seller ratings | Minimal (Craigslist none) | **Defer to v2** (heavy, abuse-prone) |
| Saved searches/alerts | Yes + push | Yes | Yes (email alerts) | **v1.x** via notifications subsystem |
| Listing expiry | Yes (renew/repost) | Auto-relist | Yes (Craigslist 30–45d) | **v1.x**, needs scheduled job |
| Mark as sold | Yes | Yes | Yes | **v1** (keystone status field) |
| Block user | Yes | Yes | Limited | **v1** safety floor |
| Report reasons | Structured categories | Structured + auto-flagging | Structured | **v1** upgrade from free-text |
| Moderation | Queue + AI + rate limits | Heavy automated | Light + rate limits | Rate limits + reports v1; **optional queue v1.x** |
| Payments/checkout | Optional in some markets | Shipping/checkout in US | None (Craigslist) | **Deliberately none** (anti-feature) — cash/Vinti4 offline |
| Promoted listings | Core revenue (featured) | Boost ads | Top/featured ads | **Has pricing/featured** — verify it renders |

## Sources

- [Marketplace Risk: Common Scams & How to Prevent Marketplace Fraud — Unit21](https://www.unit21.ai/trust-safety-dictionary/marketplace-risk)
- [Online Marketplace Fraud Prevention — Incognia](https://www.incognia.com/industries/marketplace-apps) and [Seller Fraud Detection — Incognia](https://www.incognia.com/blog/seller-fraud-detection)
- [Trust and Safety on Marketplace — Meta](https://www.meta.com/safety/scam-prevention/marketplace-safety/) and [Facebook Marketplace meeting in person — Facebook Help](https://www.facebook.com/help/2329750133711372)
- [Facebook Marketplace Scams: How to Spot Them — Avast](https://www.avast.com/c-facebook-marketplace-scams)
- [What happens now that OLX is officially Jiji — Dignited](https://www.dignited.com/48088/what-happens-olx-now-officially-jiji/) and [OLX — Wikipedia](https://en.wikipedia.org/wiki/OLX)
- [How to Build a Classified App Like OLX or Craigslist in 2026 — Primocys](https://primocys.com/blog/build-classified-app-like-olx-craigslist/)
- [How can I Control Spam Ads on a Classifieds Site — Directorist](https://directorist.com/blog/control-spam-ads-on-a-classifieds-site/)
- [Bot & Fraud Prevention for Online Marketplaces & Classifieds — DataDome](https://datadome.co/solutions/online-marketplaces-classifieds-industry/)
- [Why So Much of Africa's Commerce Runs on WhatsApp — TechTrendsKE](https://techtrendske.co.ke/2026/03/11/africa-whatsapp-commerce/) and [How South African Businesses Use WhatsApp to Sell — Raimond](https://www.raimond.biz/insights/how-south-african-businesses-use-whatsapp-to-sell/)
- [Majority of Cape Verdeans access the internet via mobile phone — Africa Press](https://www.africa-press.net/cape-verde/all-news/majority-of-cape-verdeans-access-the-internet-via-mobile-phone)
- [Popular Local Payment Methods in Cape Verde (Vinti4) — Transfi](https://www.transfi.com/blog/popular-local-payment-methods-and-solutions-in-cape-verde)
- CaboFeira internal: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`

---
*Feature research for: contact-the-seller classifieds marketplace (Cape Verde / Lusophone)*
*Researched: 2026-06-07*
