---
status: incomplete
---
# Live hardening progress — 2026-09-07

Local implementation and audit delivered; market-readiness remains unproven. No deployment, database execution, remote messages, history rewrite or commit performed. Existing user changes preserved.

Product decisions confirmed: first year from launch free for everyone; no support mailbox yet; cabofeira.com redirects to cabofeira.vercel.app.

Implemented listing/favorites paging, detail freshness, launch pricing presentation, upload validation and placeholders, safe redirects, report enums, seller pages, WhatsApp, blocking and unblock management, notification center, audit viewer, message race/dedup guards, honest info pages, profile-save feedback and dialog focus handling. Separate SQL review proposals repair seller guards, conversation integrity, notification trigger and bucket restrictions, plus transactional admin audit capture.

Validation: production builds succeeded; 13 redirect/phone checks; source parsing; all 460 translation keys aligned and static references resolved. Local browser verified contact/terms and PT switch, navbar search update on same search page. Authenticated E2E and live RLS untested. Build tooling reports stale Browserslist data.

Next: obtain/prepare separate Supabase staging, resolve public private-profile exposure with a coordinated schema/frontend change, verify proposed SQL against applied objects, test with ordinary accounts, provision CAPTCHA and support, complete remaining items in cabofeira/docs/RELEASE-AUDIT.md. User was asked whether staging exists; no answer received at time of writing.
