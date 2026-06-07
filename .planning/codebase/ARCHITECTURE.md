<!-- refreshed: 2026-06-07 -->
# Architecture

**Analysis Date:** 2026-06-07

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                         React SPA (Browser)                              │
│  Pages + Components + Context Providers                                  │
│  `src/pages/*`, `src/components/*`, `src/context/*`                     │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
                   ┌───────────────────┼───────────────────┐
                   │                   │                   │
                   ▼                   ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
        │ Supabase Auth    │  │ Supabase DB      │  │ Supabase     │
        │ (Users)          │  │ (Products,       │  │ Storage      │
        │ `lib/supabase.js`│  │  Messages, etc)  │  │ (Images)     │
        │                  │  │                  │  │              │
        └──────────────────┘  └──────────────────┘  └──────────────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       │
                       ┌───────────────────────────┐
                       │  Supabase Backend         │
                       │ (RLS, Functions, Events)  │
                       └───────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Auth Context** | User login/register, session state, profile updates, admin role management | `src/context/AuthContext.jsx` |
| **Products Context** | Product CRUD, favorites, search, caching (200 most recent ads), pagination | `src/context/ProductsContext.jsx` |
| **Messages Context** | Conversation metadata, unread tracking, realtime message subscriptions | `src/context/MessagesContext.jsx` |
| **Pricing Context** | Admin-controlled category & featured posting prices, realtime sync | `src/context/PricingContext.jsx` |
| **I18n Context** | Locale detection, language switching (English / Portuguese CV), translation lookup | `src/i18n/I18nContext.jsx` |
| **Toast Provider** | Transient notifications (success/error/info messages) | `src/components/Toast.jsx` |
| **Navbar** | Global navigation, search form, auth status, unread message badge | `src/components/Navbar.jsx` |
| **Pages** | Route handlers: Home, Search, ProductDetail, PostAd (create/edit), Profile, Messages, Admin, Auth flows | `src/pages/*.jsx` |
| **Data Helpers** | Static categories, subcategories, island locations, pricing defaults | `src/data/*.js` |
| **Utils** | Price formatting, relative time (timeAgo), Cape Verdean Escudo locale | `src/utils/format.js` |

## Pattern Overview

**Overall:** Context-based state management with React Router. Each major feature domain (Auth, Products, Messages, Pricing, i18n) is isolated in its own context provider, each with custom hook accessors. No global state library (Redux/Zustand) — contexts handle all async operations and cache management.

**Key Characteristics:**
- **Context provider nesting:** App wraps I18nProvider > ToastProvider > AuthProvider > ProductsProvider > PricingProvider > MessagesProvider > Router
- **Supabase as single backend:** All data, auth, file storage, realtime events come from Supabase
- **Server-side pagination:** Search/Admin use `fetchProducts({ range, sort, filters })` for large result sets; Home uses cached 200 most recent
- **Optimistic UI updates:** Toggle favorite, increment views updates local state immediately; DB sync is async & non-blocking
- **Realtime subscriptions:** Messages, pricing changes, reports use Supabase Postgres Change notifications

## Layers

**UI Layer (Pages & Components):**
- Purpose: Render routes, forms, product listings, chat UI
- Location: `src/pages/*.jsx`, `src/components/*.jsx`
- Contains: React JSX, CSS, form validation, state derived from contexts
- Depends on: All contexts (Auth, Products, Messages, Pricing, I18n), utils, data
- Used by: Browser/React DOM

**Context Layer (State & Side Effects):**
- Purpose: Manage business logic, API calls, caching, realtime subscriptions
- Location: `src/context/*.jsx`, `src/i18n/I18nContext.jsx`, `src/components/Toast.jsx`
- Contains: Context creators, custom hooks, Supabase queries, useEffect orchestration
- Depends on: Supabase client (`lib/supabase`), translation files
- Used by: All pages/components via custom hooks (useAuth, useProducts, etc.)

**Library Layer (Backend Integration):**
- Purpose: Initialize Supabase client, manage credentials
- Location: `src/lib/supabase.js`
- Contains: Supabase client creation, environment variable loading
- Depends on: @supabase/supabase-js, REACT_APP_* environment variables
- Used by: All contexts for database/auth/storage operations

**Data Layer (Enums & Defaults):**
- Purpose: Category definitions, island locations, default prices
- Location: `src/data/*.js`
- Contains: Category hierarchies (id, name, icon, subcategories), island list, default posting prices
- Depends on: react-icons for category icons
- Used by: Forms (PostAd, Search), pages (Home, Categories)

**i18n Layer (Localization):**
- Purpose: Translate UI strings, detect browser locale
- Location: `src/i18n/I18nContext.jsx`, `src/i18n/{en,pt-cv}.json`
- Contains: Context for locale state, nested message dictionaries, variable interpolation
- Depends on: localStorage for preference persistence
- Used by: All pages/components via useT() hook

## Data Flow

### Primary Request Path: Viewing a Product

1. Home or Search page renders → calls `useProducts()` to access cached products
2. User clicks product card → navigates to `/product/:id`
3. ProductDetail mounts → tries `getProduct(id)` from cache (fast path)
4. If not cached, calls `fetchProduct(id)` → fetches from Supabase, adds to cache
5. `incrementViews(id)` called → updates local state immediately, then RPC call to `increment_product_views` in background
6. User can favorite → `toggleFavorite(id)` → optimistic UI update + async DB write to `favorites` table
7. User clicks "Send Message" → creates/fetches conversation, redirects to Messages page

### Search Flow

1. Search page receives query params: `?q=keyword&category=electronics&min=1000&max=5000&sort=price-asc&location=Praia`
2. Parses params into state (search, category, subcategory, island, minPrice, maxPrice, sort)
3. 300ms debounce on keyword input → triggers runQuery
4. Calls `fetchProducts({ search, category, ..., range: [0, 23] })`
5. Server-side filtering via SQL: ILIKE for text search, equality for category/island, price ranges
6. Pagination: click "Load More" → appends next range `[24, 47]`, etc.
7. Realtime state updates to URL params so browser back/forward work

### Posting/Editing an Ad

1. User navigates to `/postad` (create) or `/edit/:id` (edit)
2. PostAd page checks `isEdit` flag; if edit, fetches existing product if not cached
3. Form has 3 steps: category/subcategory selection → details/images → review
4. Image upload: files read as Blob → sent to Supabase Storage bucket `product-images` with random UUID path
5. On submit: calls `addProduct(product)` or `updateProduct(id, patch)`
6. Product added to local products array; ProductsContext maintains cache
7. Redirects to `/product/:id` or `/profile/ads`

### Messaging

1. ProductDetail shows "Send Message" → fetches or creates conversation (buyer, seller, product_id)
2. Messages page loads all conversations for current user (joined with buyer/seller/product details)
3. Clicking conversation loads messages, calls `markRead(convId)` to update `last_read_at`
4. Messages page subscribes to realtime channel for active conversation → live message insertion
5. Unread count tracked in MessagesContext: counts messages created after user's `last_read_at` threshold

### Admin Flow

1. Only users with `role = "admin"` can access `/admin`
2. Admin tabs: Users (role/verification), Products (full search), Reports (product reports), Settings (category prices)
3. Settings tab: admin adjusts category posting prices → `setPrice(categoryId, value)` debounced 400ms
4. Pricing changes via realtime subscription trigger `refresh()` in PricingContext → all open browsers see new prices
5. Reports listed with nested product/reporter details; admin can mark as reviewed/delete product

**State Management:**
- AuthContext: `user` (logged-in profile), `users` (all profiles for admin), `isAdmin` (computed), `isRecovering` (password reset flow)
- ProductsContext: `products` (cache), `favorites` (array of product IDs), `productsLoading`
- MessagesContext: `unreadByConv` (map of conversation_id → unread count)
- PricingContext: `prices` (category_id → cost), `featuredPrice`
- I18nContext: `locale` (en / pt-cv), `languages` (available locales)

## Key Abstractions

**Product Mapper (fromRow / toRow):**
- Purpose: Transform database rows to app domain objects
- Example: `fromRow(dbRow)` unpacks seller as nested object, converts DB snake_case to camelCase
- Pattern: Each context has its own mappers (AuthContext uses `fromProfile`, ProductsContext uses `fromRow`, etc.)

**Supabase Queries:**
- Purpose: Encapsulate database selection, filtering, joining
- Examples: `PRODUCT_SELECT` (named fragment with seller join), `fetchProducts` (dynamic filtering)
- Pattern: Queries built with fluent Supabase API, error handling inline

**Toast API:**
- Purpose: Lightweight pub/sub for notifications
- Pattern: Context exposes `{ success(), error(), info(), dismiss() }` methods; components use `useToast()` hook
- Examples: Auth errors shown as toasts; product update success/failure feedback

**I18n Lookup Chain:**
- Purpose: Fallback to English if Portuguese key missing
- Pattern: `getNested(DICTS[locale], key) ?? getNested(DICTS.en, key) ?? key`
- Safety: Returns key literal if not found to prevent "objects are not valid React children" errors

## Entry Points

**App Root:**
- Location: `src/index.jsx`
- Triggers: Browser loads HTML, ReactDOM mounts React app
- Responsibilities: Bootstrap React 19, mount `src/App.jsx`

**App Component:**
- Location: `src/App.jsx`
- Triggers: ReactDOM creates component tree
- Responsibilities: Nest all context providers, define routes, render Navbar + Routes + Footer

**Router:**
- Location: React Router inside `src/App.jsx`
- Triggers: URL changes, link clicks
- Routes: 25+ paths covering auth (login, register, forgot, reset), catalog (home, categories, search, product detail), user (profile, ads, favorites, messages), admin, info pages

## Architectural Constraints

- **Threading:** Single-threaded event loop (browser); async operations (Supabase queries) use Promises, no workers
- **Global state:** No module-level singletons except Supabase client (`lib/supabase.js`); all app state lives in contexts
- **Circular imports:** Not observed; contexts depend only on Supabase client and data helpers; pages/components depend on contexts
- **Realtime caveats:** Supabase Change subscriptions rely on Postgres triggers; offline mode not handled—pages may stale if connection drops
- **Cache invalidation:** Products context maintains 200-item cache; old items not re-fetched automatically (assumes ad shelf-life < typical session)
- **Browser storage:** LocalStorage used for locale preference; SessionStorage used for password recovery flag (ensures redirect doesn't persist)

## Anti-Patterns

### Product Cache Not Invalidated on Other User Edits

**What happens:** ProductsContext caches up to 200 most recent products. If another user edits a product via `updateProduct()`, that user's app updates their cache, but other browsers see stale data until they refresh or navigate away.

**Why it's wrong:** Product details can be inconsistent across browsers; reported bugs or price changes may not appear immediately.

**Do this instead:** Add Supabase realtime subscription in ProductsContext to listen for `UPDATE` events on products table, trigger `refreshProducts()` or patch the local product when detected. See pattern in PricingContext (`src/context/PricingContext.jsx` lines 61–73).

### Async Errors Swallowed in Multiple Contexts

**What happens:** Many Supabase calls log errors to console but don't propagate them (e.g., `await supabase.storage.from(...).remove(paths).then(...)` in `src/context/ProductsContext.jsx` line 234). Storage cleanup failure silently orphans files.

**Why it's wrong:** Orphaned image files accumulate; unclear if operations succeeded; users get no feedback on hidden failures.

**Do this instead:** Fail-fast for critical operations; show toasts for user-facing failures (use `useToast()` in context). Log critical errors; consider a periodic cleanup job in Supabase for orphaned storage.

### Unread Message Tracking via Threshold Timestamps

**What happens:** MessagesContext compares message `created_at` against user's `last_read_at` for each conversation. If clocks are skewed (client vs. server), or user reads message, navigates away, and message is edited, the unread count can be wrong.

**Why it's wrong:** Unread badges may be inaccurate; users miss messages or see phantom unreads.

**Do this instead:** Supabase tracks read status explicitly in a `message_reads` junction table or `messages.read_by` array; MessagesContext queries that instead of computing from timestamps.

## Error Handling

**Strategy:** Try-catch at Supabase boundary, inline error returns with `{ ok: false, error: string }` pattern in auth/data methods. UI layer logs errors or shows toast notifications. Non-critical failures (e.g., storage cleanup) log warnings.

**Patterns:**
- Auth methods (login, register, etc.) return `{ ok: boolean, error?: string }` so pages can render error messages
- Product mutations (add, update, remove) throw on error; pages wrap in try-catch and show toast
- Realtime subscriptions log errors to console; don't crash
- Validation errors shown inline in forms before submission

## Cross-Cutting Concerns

**Logging:** `console.log()` / `console.warn()` / `console.error()` with prefixes like `[supabase]`, `[products]`, `[messages-unread]` for filtering. No structured logging library.

**Validation:** Form validation in page components (e.g., PostAd checks title, price, category before submit). Password validation in AuthContext (length >= 6, confirm match). No centralized validator.

**Authentication:** Supabase Auth session persisted by Supabase SDK (httpOnly cookies). App-level checks via `useAuth()` for guarded routes; pages redirect to login if `!user`. Password recovery flow uses `isRecovering` flag to prevent auto-login until user completes reset.

---

*Architecture analysis: 2026-06-07*
