# External Integrations

**Analysis Date:** 2026-06-07

## APIs & External Services

**Supabase (Primary Backend):**
- PostgreSQL database - All application data
  - SDK/Client: `@supabase/supabase-js` 2.105.4
  - Client initialization: `src/lib/supabase.js`
  - Auth: `REACT_APP_SUPABASE_ANON_KEY` (public key for client)

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Schema: `cabofeira/supabase/schema.sql`
  - Connection: Environment variables `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`
  - Client: Supabase JS SDK via `supabase` singleton in `src/lib/supabase.js`
  - Tables:
    - `profiles` - User accounts and profile information
    - `products` - Listings (ads) with seller snapshots
    - `favorites` - User favorites mapping
    - `conversations` - Messaging between buyers and sellers
    - `messages` - Individual messages in conversations
    - `app_settings` - Dynamic pricing and configuration

**File Storage:**
- Supabase Storage (bucket: `product-images`)
  - Image uploads: `src/pages/PostAd.jsx` handles client-side upload
  - Image management: `src/context/ProductsContext.jsx` manages paths and cleanup
  - Max file size: 5MB per image (enforced client-side)
  - Max images per product: 6
  - Public URL pattern: `/storage/v1/object/public/product-images/{path}`

**Caching:**
- In-memory React Context state
- No external caching layer (Redis, Memcached)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: `src/context/AuthContext.jsx`
  - Methods:
    - Email/password sign-up: `supabase.auth.signUp()`
    - Email/password login: `supabase.auth.signInWithPassword()`
    - Password reset: `supabase.auth.resetPasswordForEmail()`
    - Password update: `supabase.auth.updateUser()`
    - Logout: `supabase.auth.signOut()`
  - Session management: Client-side session listener `supabase.auth.onAuthStateChange()`
  - Email confirmation: Optional (if enabled in Supabase project settings)
  - Password recovery flow: Special handling via `PASSWORD_RECOVERY` event and sessionStorage flag

**User Profile:**
- Stored in `profiles` table (mirrors auth.users)
- Auto-created via Supabase trigger `on_auth_user_created` (schema.sql line 83-85)
- Additional fields: name, phone, bio, role (user/admin), verified, avatar, member_since

## Monitoring & Observability

**Error Tracking:**
- None detected - errors logged to console.error()

**Logs:**
- Console logging (development via `console.error()`, `console.warn()`, `console.log()`)
- No external log aggregation

## CI/CD & Deployment

**Hosting:**
- Not specified - prepared for static hosting (runs `npm run build` to generate `/build` folder)

**CI Pipeline:**
- None detected in codebase

## Environment Configuration

**Required env vars:**
- `REACT_APP_SUPABASE_URL` - e.g., `https://your-ref.supabase.co`
- `REACT_APP_SUPABASE_ANON_KEY` - Public anonymous key from Supabase project

**Optional env vars:**
- `SUPABASE_SERVICE_ROLE_KEY` - Not used in current implementation (backend operations only)

**Secrets location:**
- `.env.local` (git-ignored, never committed)
- `.env.example` provides template

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Password reset redirect: `{window.location.origin}/reset-password` (hardcoded in `AuthContext.jsx` line 165)
- Supabase realtime subscriptions:
  - Messages table changes: `MessagesContext.jsx` listens to INSERT/UPDATE on `messages` and `conversations`
  - App settings changes: `PricingContext.jsx` listens to all changes on `app_settings`

## Realtime Features

**Supabase Realtime Subscriptions:**
- Messages: `src/context/MessagesContext.jsx` subscribes to `postgres_changes` on messages/conversations tables
- Pricing: `src/context/PricingContext.jsx` subscribes to `postgres_changes` on app_settings table
- Channel subscription pattern: `supabase.channel(name).on(...).subscribe()`

## Database Procedures

**Custom SQL Functions:**
- `public.handle_new_user()` - Auto-creates profile row on auth signup
- `public.is_admin()` - Checks if current user has admin role
- `public.increment_product_views(p_id)` - Increments product view counter (called via `supabase.rpc()`)
- `public.delete_my_account()` - Custom RPC for account deletion (called in `AuthContext.jsx` line 185)

## Row Level Security (RLS)

**Policies:**
- `profiles`: Public read, self-update, admin override
- `products`: Public read, owner CRUD, admin override
- `favorites`: User-scoped (each user manages their own)
- All enforced via `supabase` client using authenticated session

---

*Integration audit: 2026-06-07*
