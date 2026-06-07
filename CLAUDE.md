<!-- GSD:project-start source:PROJECT.md -->

## Project

**CaboFeira**

CaboFeira is a Cape Verde–focused online marketplace (classifieds) web app where people post, browse, and message about listings — vehicles, real estate, electronics, fashion, jobs, services, and more. It's a React 19 single-page app backed entirely by Supabase (Postgres, Auth, Storage, Realtime), with English and Cape Verdean Portuguese (pt-CV) localization. This milestone is a **pre-launch hardening-and-completion pass**: add the marketplace features users expect, make sure every feature actually works, and close all security holes before real users arrive.

**Core Value:** A trustworthy marketplace where a buyer can find a listing and safely contact the seller — and a seller can post a listing that real buyers will see. If everything else fails, **browse → find → message must work, and no user can be harmed by a security hole.**

### Constraints

- **Tech stack**: Stay on React 19 + Supabase + CRA — No rewrite; extend the existing Context-based architecture and conventions (see `.planning/codebase/CONVENTIONS.md`).
- **Backend changes**: SQL schema/RLS edits ship as new files in `cabofeira/supabase/` and are applied manually in Supabase — No automated migration runner exists.
- **Testing approach**: Manual QA + fix, not an automated suite — User decision for this milestone.
- **Localization**: Every new user-facing string must exist in both `en.json` and `pt-cv.json` — App is bilingual by design.
- **Security bar**: No backdoors, no privilege escalation, no leaked secrets before launch — Explicit project goal.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES6+) - React application and components
- JSX - Component rendering
- SQL - Supabase database schema and stored procedures
- CSS - Styling (vanilla CSS)

## Runtime

- Node.js v22.13.0+ (development)
- npm v11.3.0+ (package management)
- Browser (React SPA runs client-side)
- npm
- Lockfile: `package-lock.json` present

## Frameworks

- React 19.1.0 - UI framework
- React DOM 19.1.0 - DOM rendering
- React Router DOM 7.6.0 - Client-side routing
- React Scripts 5.0.1 - Create React App build tooling
- Web Vitals 2.1.4 - Performance monitoring
- React Icons 5.6.0 - Icon library
- @testing-library/react 16.3.0 - Component testing
- @testing-library/dom 10.4.0 - DOM testing utilities
- @testing-library/jest-dom 6.6.3 - DOM matchers
- @testing-library/user-event 13.5.0 - User interaction simulation

## Key Dependencies

- @supabase/supabase-js 2.105.4 - PostgreSQL database client and authentication
- None additional (Supabase handles all backend services)

## Configuration

- `.env.local` file required (created from `.env.example`)
- Key environment variables:
- Create React App default webpack/Babel configuration (ejected? No)
- ESLint: `react-app`, `react-app/jest` (inherited from CRA)
- No explicit Prettier or TypeScript configuration

## Platform Requirements

- Node.js 22.13.0 or compatible
- npm or yarn
- Modern browser (Chrome, Firefox, Safari)
- Static web hosting (serves compiled React SPA)
- Supabase PostgreSQL backend (external)
- Supabase Storage for image uploads (external)

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components: PascalCase (e.g., `ProductCard.jsx`, `AuthContext.jsx`, `Navbar.jsx`)
- Pages: PascalCase (e.g., `Home.jsx`, `Search.jsx`, `Login.jsx`)
- CSS stylesheets: match component name (e.g., `Navbar.css`, `ProductCard.css`)
- Utility/data files: camelCase (e.g., `format.js`, `supabase.js`, `products.js`)
- Context providers: PascalCase with Context suffix (e.g., `AuthContext.jsx`, `ProductsContext.jsx`)
- i18n/Context files: PascalCase with file type (e.g., `I18nContext.jsx`)
- React components: PascalCase (e.g., `function Home()`, `function Navbar()`)
- React hooks: camelCase with `use` prefix (e.g., `useAuth()`, `useProducts()`, `useT()`, `useToast()`)
- Helper functions: camelCase (e.g., `formatPrice()`, `timeAgo()`, `getCategoryById()`)
- Internal/private functions: camelCase (e.g., `fromProfile()`, `toRow()`, `fromRow()`)
- Transform functions: `from{Type}`/`to{Type}` pattern (e.g., `fromProfile()`, `toRow()`, `fromRow()`)
- State variables: camelCase (e.g., `user`, `products`, `loading`, `menuOpen`)
- Constants: UPPER_SNAKE_CASE (e.g., `RECOVERY_FLAG`, `PAGE_SIZE`, `SEARCH_DEBOUNCE_MS`, `PRODUCT_IMAGES_BUCKET`)
- Boolean variables/properties: prefixed with `is` or `has` (e.g., `isAdmin`, `isRecovering`, `isFavorite`, `isEdit`)
- Collections: plural form (e.g., `products`, `users`, `messages`, `categories`)
- React props objects: implicit, no explicit interface definitions in JS files
- Context-related types: named with Provider/Consumer pattern (e.g., `AuthContext`, `ProductsContext`)
- Constants objects: UPPER_SNAKE_CASE or camelCase for config (e.g., `DICTS`, `defaultPostingPrices`)

## Code Style

- No explicit formatter configured (Create React App defaults)
- 2-space indentation (React standard)
- Double quotes for JSX attributes, strings (observed in package.json config)
- Trailing commas in objects/arrays
- ESLint via react-scripts
- Config: extends `react-app` and `react-app/jest` from Create React App
- Console warnings disabled with inline `// eslint-disable-next-line no-console` when necessary
- No prettier config found; uses CRA defaults
- Functions generally kept under 150 lines; longer ones split into concerns
- Component JSX returned directly without intermediate variables (except SearchForm in `Navbar.jsx`)
- Prefer explicit variable names over abbreviations

## Import Organization

- No path aliases configured (`jsconfig.json`/`tsconfig.json` not present)
- Relative imports used consistently (e.g., `../context/AuthContext`, `../components/Navbar`)

## Error Handling

## Logging

- Console.error used for error conditions with prefixes like `[context-name]` for origin identification
- Prefix format: `[module-name] operation: message`
- ESLint disable comment placed before each console statement: `// eslint-disable-next-line no-console`
- No debug/verbose logging observed (only errors)
- Log messages are placed after error objects for clarity

## Comments

- Explain WHY, not WHAT (code should be self-documenting for WHAT)
- Complex business logic (e.g., recovery flag logic, debounce patterns)
- Non-obvious state management side effects
- Workarounds for library behavior
- Not used in this codebase (no .ts files, minimal type documentation)
- Code relies on clear naming and inline comments instead

## Function Design

- Most functions stay under 100 lines
- Longer functions (150+ lines) split at logical boundaries
- Example: `PostAd.jsx` main component is ~250 lines but handles distinct phases (edit detection, validation, upload, submission)
- Destructuring used for object parameters (common in React/context patterns)
- Props components destructure in function signature: `function ConfirmDialog({ open, title, onConfirm, ... })`
- Many functions accept single objects to avoid parameter explosion
- React components return JSX or null
- Async utility functions return `{ ok: boolean, error?: string, ...data }` for consistency
- Hooks return objects or arrays (standard React pattern)
- Event handlers return void or cleanup functions

## Module Design

- Named exports for hooks and providers: `export function useAuth() { ... }`
- Default exports for React components: `export default function Home() { ... }`
- Named exports for utility functions: `export function formatPrice() { ... }`
- Context providers exported as named exports
- Not used in this codebase
- Each component/context module exports only its own content
- No index.js re-exports observed

## React Patterns

- Exclusively used (no class components)
- Function declaration style for named components: `function ComponentName() { ... }`
- Arrow functions for custom hooks and utilities
- State management via `useState()`
- Side effects via `useEffect()`
- Context consumption via `useContext()` with custom hooks
- Callbacks with `useCallback()` for stable function references
- Memoization with `useMemo()` for expensive computations
- Refs with `useRef()` for DOM access and mutable values

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Context provider nesting:** App wraps I18nProvider > ToastProvider > AuthProvider > ProductsProvider > PricingProvider > MessagesProvider > Router
- **Supabase as single backend:** All data, auth, file storage, realtime events come from Supabase
- **Server-side pagination:** Search/Admin use `fetchProducts({ range, sort, filters })` for large result sets; Home uses cached 200 most recent
- **Optimistic UI updates:** Toggle favorite, increment views updates local state immediately; DB sync is async & non-blocking
- **Realtime subscriptions:** Messages, pricing changes, reports use Supabase Postgres Change notifications

## Layers

- Purpose: Render routes, forms, product listings, chat UI
- Location: `src/pages/*.jsx`, `src/components/*.jsx`
- Contains: React JSX, CSS, form validation, state derived from contexts
- Depends on: All contexts (Auth, Products, Messages, Pricing, I18n), utils, data
- Used by: Browser/React DOM
- Purpose: Manage business logic, API calls, caching, realtime subscriptions
- Location: `src/context/*.jsx`, `src/i18n/I18nContext.jsx`, `src/components/Toast.jsx`
- Contains: Context creators, custom hooks, Supabase queries, useEffect orchestration
- Depends on: Supabase client (`lib/supabase`), translation files
- Used by: All pages/components via custom hooks (useAuth, useProducts, etc.)
- Purpose: Initialize Supabase client, manage credentials
- Location: `src/lib/supabase.js`
- Contains: Supabase client creation, environment variable loading
- Depends on: @supabase/supabase-js, REACT_APP_* environment variables
- Used by: All contexts for database/auth/storage operations
- Purpose: Category definitions, island locations, default prices
- Location: `src/data/*.js`
- Contains: Category hierarchies (id, name, icon, subcategories), island list, default posting prices
- Depends on: react-icons for category icons
- Used by: Forms (PostAd, Search), pages (Home, Categories)
- Purpose: Translate UI strings, detect browser locale
- Location: `src/i18n/I18nContext.jsx`, `src/i18n/{en,pt-cv}.json`
- Contains: Context for locale state, nested message dictionaries, variable interpolation
- Depends on: localStorage for preference persistence
- Used by: All pages/components via useT() hook

## Data Flow

### Primary Request Path: Viewing a Product

### Search Flow

### Posting/Editing an Ad

### Messaging

### Admin Flow

- AuthContext: `user` (logged-in profile), `users` (all profiles for admin), `isAdmin` (computed), `isRecovering` (password reset flow)
- ProductsContext: `products` (cache), `favorites` (array of product IDs), `productsLoading`
- MessagesContext: `unreadByConv` (map of conversation_id → unread count)
- PricingContext: `prices` (category_id → cost), `featuredPrice`
- I18nContext: `locale` (en / pt-cv), `languages` (available locales)

## Key Abstractions

- Purpose: Transform database rows to app domain objects
- Example: `fromRow(dbRow)` unpacks seller as nested object, converts DB snake_case to camelCase
- Pattern: Each context has its own mappers (AuthContext uses `fromProfile`, ProductsContext uses `fromRow`, etc.)
- Purpose: Encapsulate database selection, filtering, joining
- Examples: `PRODUCT_SELECT` (named fragment with seller join), `fetchProducts` (dynamic filtering)
- Pattern: Queries built with fluent Supabase API, error handling inline
- Purpose: Lightweight pub/sub for notifications
- Pattern: Context exposes `{ success(), error(), info(), dismiss() }` methods; components use `useToast()` hook
- Examples: Auth errors shown as toasts; product update success/failure feedback
- Purpose: Fallback to English if Portuguese key missing
- Pattern: `getNested(DICTS[locale], key) ?? getNested(DICTS.en, key) ?? key`
- Safety: Returns key literal if not found to prevent "objects are not valid React children" errors

## Entry Points

- Location: `src/index.jsx`
- Triggers: Browser loads HTML, ReactDOM mounts React app
- Responsibilities: Bootstrap React 19, mount `src/App.jsx`
- Location: `src/App.jsx`
- Triggers: ReactDOM creates component tree
- Responsibilities: Nest all context providers, define routes, render Navbar + Routes + Footer
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

### Async Errors Swallowed in Multiple Contexts

### Unread Message Tracking via Threshold Timestamps

## Error Handling

- Auth methods (login, register, etc.) return `{ ok: boolean, error?: string }` so pages can render error messages
- Product mutations (add, update, remove) throw on error; pages wrap in try-catch and show toast
- Realtime subscriptions log errors to console; don't crash
- Validation errors shown inline in forms before submission

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
