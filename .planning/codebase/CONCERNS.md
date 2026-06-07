# Codebase Concerns

**Analysis Date:** 2026-06-07

## Tech Debt

### Large, Complex Components

**Admin Page (629 lines):**
- Issue: `cabofeira/src/pages/Admin.jsx` combines user management, pricing controls, ads management, and reporting into a single massive component with multiple tabs and state management
- Files: `cabofeira/src/pages/Admin.jsx`
- Impact: Difficult to test, modify, or reuse individual features. Side effects are scattered throughout. Hard to debug state mutations across tabs
- Fix approach: Refactor into smaller components (UsersTab, PricingTab, AdsTab, ReportsTab). Extract shared state logic into a custom hook or reducer. Consider moving pricing logic to dedicated component

**PostAd Page (572 lines):**
- Issue: Multi-step form with image uploads, validation, and editing bundled together
- Files: `cabofeira/src/pages/PostAd.jsx`
- Impact: Hard to test individual steps in isolation. Image upload logic mixed with form handling. Difficult to add new features without unintended side effects
- Fix approach: Extract image upload into a custom hook (`useImageUpload`). Split form validation into separate module. Consider extracting step rendering into separate components

**ProductDetail Page (495 lines):**
- Issue: Combines product display, messaging, reporting, favorites, and related products into one component
- Files: `cabofeira/src/pages/ProductDetail.jsx`
- Impact: Multiple concerns handled in single component. Modal logic for messaging/reporting could be extracted
- Fix approach: Extract messaging modal to separate component. Extract reporting modal to separate component. Pull out shared modal infrastructure

### Fire-and-Forget Async Operations

**Storage Cleanup Without Error Handling:**
- Issue: In `cabofeira/src/context/ProductsContext.jsx` (line 234-236), when a product is deleted, orphaned image files are cleaned up with a best-effort approach that logs warnings but doesn't notify user or block deletion
- Files: `cabofeira/src/context/ProductsContext.jsx` (line 234-236)
- Impact: If storage cleanup fails (network issue, permissions), files become orphans and waste storage. User doesn't know cleanup failed. No cleanup job mentioned in codebase
- Fix approach: Add periodic cleanup job script or Supabase Edge Function to sweep orphaned images. Consider notifying admin of failed cleanups

**Debounced Price Updates Without Cancellation Safeguards:**
- Issue: In `cabofeira/src/context/PricingContext.jsx`, debounced timer callbacks (lines 77, 91) fire async DB writes with no explicit cancellation if component unmounts
- Files: `cabofeira/src/context/PricingContext.jsx` (lines 75-101)
- Impact: Potential memory leaks or state update on unmounted component warnings. If user rapidly edits then navigates away, pending writes might resolve after cleanup
- Fix approach: Cancel pending timers in cleanup. Consider using `useCallback` with explicit dependency tracking. Add AbortController support for fetch-based operations

## Known Bugs

### Potential State Sync Issues

**Session Recovery Flag Edge Case:**
- Symptoms: `RECOVERY_FLAG` in sessionStorage (used for password reset flow) could become stale if user doesn't complete reset and navigates elsewhere
- Files: `cabofeira/src/context/AuthContext.jsx` (lines 25, 67-72, 97-100)
- Trigger: User clicks password reset link, doesn't complete reset, refreshes page or closes tab, then returns later
- Workaround: The code does clear the flag when user leaves `/reset-password` route, but edge cases around tab switching or manual URL edits could leave stale flags

**Unread Badge Calculation Race Condition:**
- Symptoms: If messages arrive during the refresh cycle in `MessagesContext`, counts could briefly be inaccurate
- Files: `cabofeira/src/context/MessagesContext.jsx` (lines 23-61)
- Trigger: New message arrives while `refresh()` is executing fetch queries
- Workaround: Realtime channel updates trigger refresh, so eventual consistency is achieved, but brief inconsistency possible

### Missing Null Safety

**Product Avatar Rendering:**
- Symptoms: Line 305 in `cabofeira/src/pages/ProductDetail.jsx` accesses `product.seller.name[0]` without checking if name exists or is empty string
- Files: `cabofeira/src/pages/ProductDetail.jsx` (line 305)
- Trigger: If seller has no name, accesses `undefined[0]` which returns `undefined`, potentially rendering as empty
- Workaround: Schema should enforce `name NOT NULL`, but defensive coding would help

## Security Considerations

### Image Upload Path Traversal

**Arbitrary File Extensions:**
- Risk: `cabofeira/src/pages/PostAd.jsx` (lines 16-21) trusts file MIME types and extracts extensions without strict validation
- Files: `cabofeira/src/pages/PostAd.jsx` (line 16-21)
- Current mitigation: File input type is `accept="image/*"` which helps. Storage path uses `user.id` prefix and randomUUID. File size capped at 5MB. MIME type checking at line 126
- Recommendations: Add strict extension whitelist (jpg, png, webp only). Validate MIME type server-side in Supabase. Consider adding image dimension/content validation

### Redirect Parameter Not Validated

**Open Redirect Vulnerability:**
- Risk: `cabofeira/src/pages/Login.jsx` (line 15) reads `redirect` from URL params and passes to `navigate()` without validation
- Files: `cabofeira/src/pages/Login.jsx` (line 15)
- Current mitigation: React Router's `navigate()` is safer than `window.location` — it prevents absolute URLs from being trusted
- Recommendations: Validate that redirect path starts with `/` and doesn't contain `://`. Use allowlist of safe routes

### Environment Variables Exposed in Client

**Supabase Public Key Risk:**
- Risk: `cabofeira/src/lib/supabase.js` loads `REACT_APP_SUPABASE_ANON_KEY` from environment, which is necessary for client-side Supabase but should have RLS policies enforced
- Files: `cabofeira/src/lib/supabase.js`
- Current mitigation: Code logs warning if key is missing. Relies on Supabase RLS policies
- Recommendations: Review RLS policies in schema files. Audit that admin operations require `is_admin()` function. Ensure `profiles` table doesn't expose sensitive data without auth

## Performance Bottlenecks

### Unbounded Product Cache

**Memory Growth Issue:**
- Problem: `cabofeira/src/context/ProductsContext.jsx` caches up to 200 most recent products in memory (line 85 range)
- Files: `cabofeira/src/context/ProductsContext.jsx` (line 85)
- Cause: `refreshProducts()` pulls top 200 and keeps them in state forever. As new products post, cache grows. Old products stay unless explicitly removed
- Improvement path: Implement LRU cache with max size. Periodically prune stale entries. Consider IndexedDB for larger datasets

### N+1 Query Pattern in Admin

**Reports Table with Relations:**
- Problem: `cabofeira/src/pages/Admin.jsx` (lines 45-53) selects reports with nested product and profile relations
- Files: `cabofeira/src/pages/Admin.jsx` (lines 44-54)
- Cause: If reports list grows large, each report triggers nested relation fetches. No pagination on reports
- Improvement path: Add pagination to reports tab. Lazy-load product/profile data. Consider materialized view for common report queries

### Search Debounce May Be Too Aggressive

**300ms Delay:**
- Problem: `cabofeira/src/pages/Search.jsx` (line 12) uses 300ms debounce — feels sluggish on fast typists
- Files: `cabofeira/src/pages/Search.jsx` (line 12)
- Cause: User types quickly and waits 300ms for search results. Multiple keystroke bursts extend wait
- Improvement path: Reduce to 150-200ms. Add request deduplication using ref pattern (already done in line 37-58 with `requestIdRef`). Consider optimistic UI updates

## Fragile Areas

### ProductsContext Relies on Supabase Schema

**Tight Coupling to Database Design:**
- Files: `cabofeira/src/context/ProductsContext.jsx`
- Why fragile: Hard-coded column names in `PRODUCT_SELECT` (lines 13-17). Seller relation fetching assumes specific foreign key. Adding new fields to schema requires code changes
- Safe modification: Abstract query building into config object. Document schema assumptions in comments. Add tests for query construction
- Test coverage: No unit tests for query building logic. E2E tests would catch breaking changes after deploying schema

### i18n Key Resolution Fallback Chain

**Silent Failures:**
- Files: `cabofeira/src/i18n/I18nContext.jsx` (lines 54-63)
- Why fragile: If translation key is misspelled, defaults to English. If English doesn't have key, returns the key string itself. Hard to spot missing translations
- Safe modification: Add dev mode flag that throws on missing keys. Generate list of unused keys in CI. Use TypeScript for translation key validation
- Test coverage: No tests for key resolution. Easy to introduce new untranslated strings

### Messages Realtime Channel Subscription

**Complex Channel Management:**
- Files: `cabofeira/src/pages/Messages.jsx` (lines 70-93) and `cabofeira/src/context/MessagesContext.jsx` (lines 70-88)
- Why fragile: Multiple overlapping Supabase realtime subscriptions. If one fails to unsubscribe, connection leaks. Channel naming depends on user ID — if ID changes, old channels hang around
- Safe modification: Centralize channel cleanup. Add teardown logging. Consider using Effect cleanup for all subscriptions. Test subscription lifecycle in mounted/unmounted scenarios
- Test coverage: No tests for subscription cleanup or race conditions between mount/unmount

### Admin Pricing Persist Without Transaction

**Race Condition in Concurrent Saves:**
- Files: `cabofeira/src/context/PricingContext.jsx` (lines 75-101)
- Why fragile: Two admins can modify prices concurrently. Second admin's save overwrites first. No transaction or conflict detection
- Safe modification: Use Supabase RLS with versioning. Add `updated_at` timestamp and check-before-update pattern. Consider locking mechanism for pricing updates
- Test coverage: No tests for concurrent updates. Edge case only surfaces under load

## Scaling Limits

### Product Views Counter Not Rate-Limited

**Potential Abuse Vector:**
- Current capacity: No limit on `increment_product_views()` RPC calls (mentioned in `cabofeira/src/context/ProductsContext.jsx` line 246)
- Limit: User could spam refresh to artificially inflate view counts
- Scaling path: Add rate limiting in Supabase RPC. Check IP/user-id + product-id + time window. Consider moving to server-side view tracking

### Conversations and Messages Unbounded Growth

**Database Bloat:**
- Current capacity: No retention policy for old messages mentioned in codebase
- Limit: Conversations/messages table grows indefinitely. Queries for old conversations slow down
- Scaling path: Implement message archival for old conversations (>6 months). Add pagination limits to message queries. Consider adding conversation soft-delete

### Admin Ads Tab Pagination Manual

**Hard Limit of 30 Per Load:**
- Current capacity: `cabofeira/src/pages/Admin.jsx` line 28 sets `ADS_PAGE_SIZE = 30` — fixed at code level
- Limit: Admin viewing 10,000 ads must load 334 times. No search/filter on admin ads tab unlike search page
- Scaling path: Add search and filter options to Admin ads tab (category, seller, date range). Increase page size to 100 or make configurable

## Dependencies at Risk

### React Router v7.6.0 Major Jump

**Risk:** `package.json` shows `"react-router-dom": "^7.6.0"` — this is a major version bump from v6
- Risk: Breaking changes in routing API, loader/action patterns. Older tutorials/docs may not apply
- Impact: Future maintenance requires understanding v7 API. If v7 becomes abandoned, migration costs are high
- Migration plan: Lock to specific minor (`^7.6.1`). Write routing tests to catch breaking changes in future updates. Document any v7-specific patterns used

### Supabase Realtime Channels

**Risk:** Multiple hardcoded channel names with no versioning (`"admin-reports"`, `"messages-${activeId"`, `"conv-list-${user.id}"`)
- Risk: Changing channel names in code requires careful migration. Old instances may hang on old channels
- Impact: Memory leaks, connection exhaustion during deployments
- Migration plan: Consider centralizing channel names in config. Add channel health check on app init. Implement graceful channel migration with version awareness

## Missing Critical Features

### No Message Encryption

**Problem:** Messages are stored and transmitted in plaintext via Supabase
- Blocks: Cannot meet privacy requirements for sensitive conversations (e.g., GDPR if EU users)
- Recommendation: Add client-side encryption for messages before sending. Implement key exchange mechanism. Document security model for users

### No Content Moderation for Reports

**Problem:** Report reasons are free-form text (line 533 in `ProductDetail.jsx`). No validation of report quality or duplicate detection
- Blocks: Can't easily track spam reporters or analyze common issues
- Recommendation: Add predefined report reasons (dropdown). Track reporter reputation. Add duplicate report detection by user+product combo

### No Admin Audit Log

**Problem:** Admin actions (delete ad, promote user, modify prices) are not logged
- Blocks: Can't investigate abuses of admin privileges. No accountability trail
- Recommendation: Create `admin_actions` table. Log all admin mutations with timestamp, admin ID, and change details. Add audit dashboard

## Test Coverage Gaps

### No Test Suite for Contexts

**Untested Area:** All context providers (`AuthContext`, `ProductsContext`, `MessagesContext`, `PricingContext`) lack unit tests
- Files: `cabofeira/src/context/*.jsx`
- Risk: State mutations, async operations, cleanup functions could break silently. Refactoring is risky. Dependencies between contexts not verified
- Priority: High — contexts are core business logic

### No Tests for ProductsContext Queries

**Untested Area:** Query building in `fetchProducts()` (lines 109-159) has no tests
- Files: `cabofeira/src/context/ProductsContext.jsx`
- Risk: Adding new filters or sorting options could break existing queries. Edge cases (min/max price interaction, empty search) untested
- Priority: High — search/filter is critical user-facing feature

### No E2E Tests for Message Flow

**Untested Area:** Full conversation creation, message send, realtime delivery not tested end-to-end
- Files: Multiple (Messages.jsx, MessagesContext.jsx, ProductDetail.jsx message modal)
- Risk: Message send failures, realtime subscription leaks, delivery failures only caught in production
- Priority: Medium — impacts user trust, but failures are recoverable

### No Tests for Image Upload Edge Cases

**Untested Area:** Image upload error handling, size limits, extension validation (lines 105-142 in PostAd.jsx)
- Files: `cabofeira/src/pages/PostAd.jsx`
- Risk: Invalid files could break form state. Large files could timeout. Upload errors might not clean up properly
- Priority: Medium — impacts posting flow

---

*Concerns audit: 2026-06-07*
