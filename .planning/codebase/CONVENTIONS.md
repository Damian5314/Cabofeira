# Coding Conventions

**Analysis Date:** 2026-06-07

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `ProductCard.jsx`, `AuthContext.jsx`, `Navbar.jsx`)
- Pages: PascalCase (e.g., `Home.jsx`, `Search.jsx`, `Login.jsx`)
- CSS stylesheets: match component name (e.g., `Navbar.css`, `ProductCard.css`)
- Utility/data files: camelCase (e.g., `format.js`, `supabase.js`, `products.js`)
- Context providers: PascalCase with Context suffix (e.g., `AuthContext.jsx`, `ProductsContext.jsx`)
- i18n/Context files: PascalCase with file type (e.g., `I18nContext.jsx`)

**Functions:**
- React components: PascalCase (e.g., `function Home()`, `function Navbar()`)
- React hooks: camelCase with `use` prefix (e.g., `useAuth()`, `useProducts()`, `useT()`, `useToast()`)
- Helper functions: camelCase (e.g., `formatPrice()`, `timeAgo()`, `getCategoryById()`)
- Internal/private functions: camelCase (e.g., `fromProfile()`, `toRow()`, `fromRow()`)
- Transform functions: `from{Type}`/`to{Type}` pattern (e.g., `fromProfile()`, `toRow()`, `fromRow()`)

**Variables:**
- State variables: camelCase (e.g., `user`, `products`, `loading`, `menuOpen`)
- Constants: UPPER_SNAKE_CASE (e.g., `RECOVERY_FLAG`, `PAGE_SIZE`, `SEARCH_DEBOUNCE_MS`, `PRODUCT_IMAGES_BUCKET`)
- Boolean variables/properties: prefixed with `is` or `has` (e.g., `isAdmin`, `isRecovering`, `isFavorite`, `isEdit`)
- Collections: plural form (e.g., `products`, `users`, `messages`, `categories`)

**Types/Interfaces:**
- React props objects: implicit, no explicit interface definitions in JS files
- Context-related types: named with Provider/Consumer pattern (e.g., `AuthContext`, `ProductsContext`)
- Constants objects: UPPER_SNAKE_CASE or camelCase for config (e.g., `DICTS`, `defaultPostingPrices`)

## Code Style

**Formatting:**
- No explicit formatter configured (Create React App defaults)
- 2-space indentation (React standard)
- Double quotes for JSX attributes, strings (observed in package.json config)
- Trailing commas in objects/arrays

**Linting:**
- ESLint via react-scripts
- Config: extends `react-app` and `react-app/jest` from Create React App
- Console warnings disabled with inline `// eslint-disable-next-line no-console` when necessary
- No prettier config found; uses CRA defaults

**Key Rules Observed:**
- Functions generally kept under 150 lines; longer ones split into concerns
- Component JSX returned directly without intermediate variables (except SearchForm in `Navbar.jsx`)
- Prefer explicit variable names over abbreviations

## Import Organization

**Order:**
1. React core imports (`React` from "react")
2. External libraries (routing, UI libraries: `react-router-dom`, `react-icons`)
3. Context providers/hooks from own codebase (`../context/*`)
4. Utility hooks (`useT` from i18n, `useToast`, custom hooks)
5. Data modules (`../data/*`)
6. Utility functions (`../utils/*`)
7. Supabase client (`../lib/supabase`)
8. CSS imports (`.css` files)

**Path Aliases:**
- No path aliases configured (`jsconfig.json`/`tsconfig.json` not present)
- Relative imports used consistently (e.g., `../context/AuthContext`, `../components/Navbar`)

**Example from `App.jsx`:**
```jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { AuthProvider } from "./context/AuthContext";
import { ProductsProvider } from "./context/ProductsContext";
import { I18nProvider } from "./i18n/I18nContext";
import Home from "./pages/Home";
import "./App.css";
```

## Error Handling

**Patterns:**

1. **Hook Provider Guard**: Custom hooks check context exists and throw if not used within provider
   ```jsx
   export function useAuth() {
     const ctx = useContext(AuthContext);
     if (!ctx) throw new Error("useAuth must be used within AuthProvider");
     return ctx;
   }
   ```
   See: `AuthContext.jsx`, `MessagesContext.jsx`, `ToastContext.jsx`, `I18nContext.jsx`

2. **Async/Await with Destructuring**: Supabase calls use destructuring to extract error and data
   ```jsx
   const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
   if (error || !data) {
     setUser(null);
     return;
   }
   ```
   See: `AuthContext.jsx:36-46`, `ProductsContext.jsx:76-88`

3. **Try-Catch for Complex Async**: Used in multi-step async operations
   ```jsx
   try {
     const uploaded = await Promise.all([...]);
     update({ images: [...form.images, ...uploaded] });
   } catch (err) {
     setUploadError(err.message || fallback);
   } finally {
     setUploading(n => Math.max(0, n - arr.length));
   }
   ```
   See: `PostAd.jsx:119-141`

4. **Return Value Pattern**: Async functions return `{ ok: boolean, error?: string }` for user feedback
   ```jsx
   const login = async ({ email, password }) => {
     if (!email || !password) {
       return { ok: false, error: t("auth.errors.missingCredentials") };
     }
     const { error } = await supabase.auth.signInWithPassword({ email, password });
     if (error) return { ok: false, error: error.message };
     return { ok: true };
   };
   ```
   See: `AuthContext.jsx:115-126`

5. **Console.error with Prefix**: Debug logging uses prefixed console.error with eslint disable
   ```jsx
   // eslint-disable-next-line no-console
   console.error("[messages-unread] fetch:", msgErr);
   ```
   See: `MessagesContext.jsx:49-50`, `PricingContext.jsx:42-43`

6. **Silent Failure with Logging**: Some operations fail silently but are logged (cache misses, optional operations)
   ```jsx
   if (msgErr) {
     console.error("[messages-unread] fetch:", msgErr);
     return;
   }
   ```
   See: `MessagesContext.jsx:48-51`

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- Console.error used for error conditions with prefixes like `[context-name]` for origin identification
- Prefix format: `[module-name] operation: message`
- ESLint disable comment placed before each console statement: `// eslint-disable-next-line no-console`
- No debug/verbose logging observed (only errors)
- Log messages are placed after error objects for clarity

**Examples:**
```jsx
console.error("[pricing] load:", error);
console.warn(`[i18n] key "${key}" resolved to an object, not a string`);
console.warn("[products] storage cleanup failed:", e.message);
```

## Comments

**When to Comment:**
- Explain WHY, not WHAT (code should be self-documenting for WHAT)
- Complex business logic (e.g., recovery flag logic, debounce patterns)
- Non-obvious state management side effects
- Workarounds for library behavior

**JSDoc/TSDoc:**
- Not used in this codebase (no .ts files, minimal type documentation)
- Code relies on clear naming and inline comments instead

**Examples:**
```jsx
// Recovery flag should only count when the user is actively on the
// reset page. Otherwise it's stale state from an abandoned reset flow.
let recovering = sessionStorage.getItem(RECOVERY_FLAG) === "1";
if (recovering && window.location.pathname !== "/reset-password") {
  sessionStorage.removeItem(RECOVERY_FLAG);
  setIsRecovering(false);
  recovering = false;
}

// Cached pool for Home/MyAds/Favorites lookups. Capped to 200 most recent
// ads — pages that need broader access (Search, Admin) use fetchProducts
// for server-side paginated queries instead.

// Refs so debounced DB writes always see the latest values, even if
// React hasn't re-rendered yet between rapid keystrokes.
```

## Function Design

**Size:** 
- Most functions stay under 100 lines
- Longer functions (150+ lines) split at logical boundaries
- Example: `PostAd.jsx` main component is ~250 lines but handles distinct phases (edit detection, validation, upload, submission)

**Parameters:**
- Destructuring used for object parameters (common in React/context patterns)
- Props components destructure in function signature: `function ConfirmDialog({ open, title, onConfirm, ... })`
- Many functions accept single objects to avoid parameter explosion

**Return Values:**
- React components return JSX or null
- Async utility functions return `{ ok: boolean, error?: string, ...data }` for consistency
- Hooks return objects or arrays (standard React pattern)
- Event handlers return void or cleanup functions

**Example Function Signatures:**
```jsx
// Component with destructured props
function ProductCard({ product }) { ... }

// Custom hook
function useProducts() { ... }

// Async function with standard result pattern
const login = async ({ email, password }) => {
  // ...
  return { ok: true };
};

// Utility transform function
const fromProfile = (row) => ({
  id: row.id,
  name: row.name,
  // ...
});
```

## Module Design

**Exports:**
- Named exports for hooks and providers: `export function useAuth() { ... }`
- Default exports for React components: `export default function Home() { ... }`
- Named exports for utility functions: `export function formatPrice() { ... }`
- Context providers exported as named exports

**Barrel Files:**
- Not used in this codebase
- Each component/context module exports only its own content
- No index.js re-exports observed

**Example Export Patterns:**
```jsx
// Context: named export for Provider and Hook
export function AuthProvider({ children }) { ... }
export function useAuth() { ... }

// Component: default export
export default function Navbar() { ... }

// Utilities: named exports
export function formatPrice(amount, currency = "CVE") { ... }
export function timeAgo(dateStr) { ... }
```

## React Patterns

**Functional Components:**
- Exclusively used (no class components)
- Function declaration style for named components: `function ComponentName() { ... }`
- Arrow functions for custom hooks and utilities

**Hooks:**
- State management via `useState()`
- Side effects via `useEffect()`
- Context consumption via `useContext()` with custom hooks
- Callbacks with `useCallback()` for stable function references
- Memoization with `useMemo()` for expensive computations
- Refs with `useRef()` for DOM access and mutable values

**Context Pattern:**
1. Create context with `createContext(null)`
2. Export provider component that provides value
3. Export custom hook that checks context exists and throws if missing
4. Provider wraps children in context.Provider with value

**Example:**
```jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // ... logic ...
  return (
    <AuthContext.Provider value={{ user, login, logout, ... }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

---

*Convention analysis: 2026-06-07*
