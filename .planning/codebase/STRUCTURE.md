# Codebase Structure

**Analysis Date:** 2026-06-07

## Directory Layout

```
cabofeira/
├── public/              # Static assets (favicon, index.html)
├── build/               # Production build output (committed)
├── src/                 # Application source code
│   ├── index.jsx        # React root entry point
│   ├── App.jsx          # Router + provider nesting
│   ├── index.css        # Global styles
│   │
│   ├── pages/           # Route handler components (one per page)
│   │   ├── Home.jsx
│   │   ├── Search.jsx
│   │   ├── Categories.jsx
│   │   ├── ProductDetail.jsx
│   │   ├── PostAd.jsx   # Create & edit ads (both routes use same component)
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── Profile.jsx  # User profile + settings
│   │   ├── MyAds.jsx    # User's posted products
│   │   ├── Favorites.jsx
│   │   ├── Messages.jsx # Messaging inbox
│   │   ├── Admin.jsx    # Admin panel (users, ads, reports, pricing)
│   │   ├── Info.jsx     # About, Contact, FAQ, 404
│   │   └── *.css        # Page-specific styles
│   │
│   ├── components/      # Reusable UI components
│   │   ├── Navbar.jsx   # Top navigation bar
│   │   ├── Footer.jsx   # Footer
│   │   ├── ProductCard.jsx     # Product listing card
│   │   ├── ConfirmDialog.jsx   # Confirmation modal
│   │   ├── Skeleton.jsx        # Loading placeholder
│   │   ├── Toast.jsx    # Notification context + provider
│   │   ├── LanguageSwitcher.jsx
│   │   ├── ScrollToTop.jsx     # Scroll restoration on route change
│   │   ├── assets/
│   │   │   └── logo.jsx        # Logo component
│   │   └── *.css        # Component styles
│   │
│   ├── context/         # State management contexts
│   │   ├── AuthContext.jsx         # User auth, login, profile, admin role
│   │   ├── ProductsContext.jsx     # Products, favorites, search, cache
│   │   ├── MessagesContext.jsx     # Conversations, unread tracking
│   │   └── PricingContext.jsx      # Category & featured posting prices
│   │
│   ├── i18n/            # Internationalization
│   │   ├── I18nContext.jsx         # Locale state, translation lookup
│   │   ├── en.json                 # English translations
│   │   └── pt-cv.json              # Portuguese (Cape Verdean) translations
│   │
│   ├── lib/             # External service clients
│   │   └── supabase.js            # Supabase client initialization
│   │
│   ├── data/            # Static data & enums
│   │   ├── categories.js          # Product categories, subcategories, icons
│   │   ├── locations.js           # Island/city options
│   │   ├── postingPrices.js       # Default prices by category
│   │   ├── products.js            # Seeded demo products (if used)
│   │   └── seedUsers.js           # Demo user data (if used)
│   │
│   ├── utils/           # Utility functions
│   │   └── format.js              # formatPrice(), timeAgo()
│   │
│   ├── setupTests.js    # Jest/testing-library configuration
│   └── reportWebVitals.js         # Web Vitals reporting (optional)
│
├── tests/               # Test directory (empty structure)
│   ├── unit/
│   └── e2e/
│
├── supabase/            # Supabase schema, migrations, RLS policies
│   └── (migrations, functions, policies defined here)
│
├── scripts/             # Utility scripts
│
├── package.json         # Dependencies, scripts, config
├── package-lock.json    # Lockfile
├── .env.local           # Local env vars (not committed)
├── .env.example         # Template for env vars
├── .gitignore           # Git exclusions
└── README.md            # Project documentation
```

## Directory Purposes

**`public/`:**
- Purpose: Static public assets served by webpack dev server and build output
- Contains: `index.html` (React root), favicon, robots.txt
- Key files: `public/index.html` (mounts `<div id="root">`)

**`src/`:**
- Purpose: All application source code
- Contains: Components, pages, contexts, utilities, styles
- Key files: `src/index.jsx` (entry), `src/App.jsx` (routing)

**`src/pages/`:**
- Purpose: Full-page components mapped to routes
- Contains: One component per page/route, paired CSS file
- Key files: `Home.jsx` (home), `ProductDetail.jsx` (product view), `PostAd.jsx` (create/edit), `Admin.jsx` (admin panel)
- Pattern: Each page imports contexts via hooks (useAuth, useProducts, useT) and renders a full page layout

**`src/components/`:**
- Purpose: Reusable UI fragments smaller than pages
- Contains: Cards, headers, modals, icons, layout wrappers
- Key files: `Navbar.jsx` (global nav), `ProductCard.jsx` (grid item), `Toast.jsx` (notifications)
- Constraint: Components should not import pages; pages import components

**`src/context/`:**
- Purpose: React Context providers for feature domains
- Contains: State initialization, async operations, custom hooks
- Key files: `AuthContext.jsx` (authentication), `ProductsContext.jsx` (products/search), `MessagesContext.jsx` (messaging)
- Pattern: Each context exports `Provider` component and `useXxx()` custom hook; providers are nested in `App.jsx`

**`src/i18n/`:**
- Purpose: Localization / multi-language support
- Contains: Context for locale switching, translation dictionaries
- Key files: `I18nContext.jsx` (locale provider), `en.json` and `pt-cv.json` (message catalogs)
- Usage: Pages/components call `const t = useT()` then `t("key.path")` to fetch translated string

**`src/lib/`:**
- Purpose: External service clients (DB, auth, storage)
- Contains: Initialized SDK clients
- Key files: `supabase.js` (Supabase client creation with env vars)
- Constraint: Should not contain business logic; only client setup

**`src/data/`:**
- Purpose: Static lookup tables, enums, defaults
- Contains: Category definitions, location lists, seeded demo data, default prices
- Key files: `categories.js` (marketplace categories), `locations.js` (islands), `postingPrices.js` (default posting fees)
- Usage: Imported by forms, filters, admin settings; not database-backed

**`src/utils/`:**
- Purpose: Shared utility functions (formatting, helpers)
- Contains: Pure functions for formatting, date math, etc.
- Key files: `format.js` (formatPrice, timeAgo)

**`supabase/`:**
- Purpose: Backend schema, migrations, functions, RLS policies
- Contains: SQL migrations, Postgres custom functions, row-level security rules
- Note: Not fully explored; managed via Supabase Dashboard or CLI

**`tests/`:**
- Purpose: Test files
- Contains: Unit tests, E2E tests (structure exists but sparse)
- Note: Minimal test coverage observed; infrastructure in place

**`scripts/`:**
- Purpose: Build/utility scripts
- Contains: Any pre/post-build or setup scripts
- Note: Not deeply explored

## Key File Locations

**Entry Points:**
- `src/index.jsx`: React entry point; creates root and mounts `<App />`
- `src/App.jsx`: Provider nesting and route definitions; where `<Router>` lives
- `public/index.html`: HTML root with `<div id="root">`

**Configuration:**
- `package.json`: Dependencies (React 19, React Router 7, Supabase SDK, react-icons), scripts (start, build, test), eslint config
- `.env.local`: Supabase URL and anon key (secret; not committed)
- `.env.example`: Template showing required vars

**Core Logic:**
- `src/context/AuthContext.jsx`: User auth (login, register, password reset, profile updates), admin role checks
- `src/context/ProductsContext.jsx`: Product CRUD, cache (200 items), favorites, server-side search/paginate
- `src/context/MessagesContext.jsx`: Conversations, unread count tracking, realtime subscriptions
- `src/lib/supabase.js`: Supabase client singleton

**Styling:**
- `src/index.css`: Global reset, typography, utility classes
- `src/pages/*.css`: Page-specific layouts and components
- `src/components/*.css`: Component styles (Navbar, ProductCard, Toast, etc.)

**Routing:**
- `src/App.jsx` lines 40–67: Route definitions (25+ paths)

## Naming Conventions

**Files:**
- Pages: `PageName.jsx` + `PageName.css` (PascalCase, one page per file)
- Components: `ComponentName.jsx` + `ComponentName.css` (PascalCase)
- Contexts: `FeatureContext.jsx` (PascalCase, with "Context" suffix)
- Utilities: `utility.js` (camelCase)
- Data files: `plural.js` (camelCase, plural for arrays/maps; e.g., `categories.js`, `locations.js`)
- i18n: `locale.json` (lowercase locale code; e.g., `en.json`, `pt-cv.json`)

**Directories:**
- Feature folders: lowercase (e.g., `pages/`, `components/`, `context/`)
- Shared utilities: `lib/`, `utils/`, `data/`

**Exports:**
- Contexts: Named export `FunctionProvider` + named export `useFunctionHook()`
- Pages: Default export `Page` component
- Components: Default or named export (convention varies)
- Data: Named exports for arrays/objects (e.g., `export const categories = [...]`)

**Constants & Variables:**
- Category IDs, field names: camelCase (e.g., `categoryId`, `sellerId`, `location_island` in DB maps to `location.island` in app)
- Env vars: REACT_APP_ prefix (e.g., `REACT_APP_SUPABASE_URL`)
- Magic strings: UPPERCASE (e.g., `PRODUCT_IMAGES_BUCKET`, `RECOVERY_FLAG`, `STORAGE_KEY`)

## Where to Add New Code

**New Feature (e.g., Wishlists):**
- Context: `src/context/WishlistsContext.jsx` — state, Supabase queries, custom hook
- Pages using it: Add routes in `src/App.jsx`, create `src/pages/Wishlists.jsx`
- Components: If needed, add to `src/components/` (e.g., `WishlistCard.jsx`)
- Tests: `tests/unit/wishlists.test.js` or `tests/e2e/wishlists.e2e.js`

**New Component (e.g., ImageGallery):**
- Location: `src/components/ImageGallery.jsx` + `src/components/ImageGallery.css`
- Import in parent page/component
- If reusable across features, place in `src/components/`; if feature-specific, consider keeping in page folder (not yet observed; structure allows for it)

**New Utility:**
- Location: `src/utils/newUtil.js` (camelCase filename)
- Export pure functions; import in components/contexts as needed

**New Data/Enum:**
- Location: `src/data/feature.js` (plural name for array/map)
- Export named exports; import in contexts/pages that need lookups

**New i18n Strings:**
- Location: Add keys to `src/i18n/en.json` and `src/i18n/pt-cv.json` (hierarchy: domain.feature.key)
- Usage: `useT()` in component, call `t("domain.feature.key")`

**New Page:**
- Create `src/pages/PageName.jsx` + `src/pages/PageName.css`
- Add route in `src/App.jsx` `<Routes>` block
- Component should use `useNavigate()`, context hooks, and render full-page layout

**Tests:**
- Location: `tests/unit/` for unit tests, `tests/e2e/` for end-to-end
- Pattern: Jest + React Testing Library (see `setupTests.js`)

## Special Directories

**`build/`:**
- Purpose: Production build output
- Generated: Yes (via `npm run build`)
- Committed: Yes (for CI/deployment convenience; can be .gitignored if using cloud builds)

**`node_modules/`:**
- Purpose: npm package installations
- Generated: Yes (via `npm install`)
- Committed: No (.gitignored)

**`public/`:**
- Purpose: Static files copied as-is to build root
- Generated: No
- Committed: Yes

**`supabase/`:**
- Purpose: Supabase-specific schema and migrations
- Generated: Partially (migrations generated by CLI)
- Committed: Yes (version control for DB changes)

---

*Structure analysis: 2026-06-07*
