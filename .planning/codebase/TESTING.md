# Testing Patterns

**Analysis Date:** 2026-06-07

## Test Framework

**Runner:**
- Jest (via Create React App's react-scripts)
- Version: Included in `react-scripts@5.0.1` (Jest 29.x)
- Config: `E:\Projecten\Cabofeira\cabofeira\package.json` (eslintConfig extends `react-app/jest`)

**Assertion Library:**
- Jest built-in matchers
- `@testing-library/jest-dom@^6.6.3` - Custom DOM matchers

**Testing Libraries:**
- `@testing-library/react@^16.3.0` - React component testing
- `@testing-library/dom@^10.4.0` - DOM queries
- `@testing-library/user-event@^13.5.0` - User interaction simulation

**Run Commands:**
```bash
npm test                 # Run tests in watch mode
npm run build            # Build for production (includes test check)
```

## Test File Organization

**Location:**
- Tests are NOT currently present in the codebase
- Test directories exist but are empty:
  - `E:\Projecten\Cabofeira\cabofeira\tests\unit` - empty
  - `E:\Projecten\Cabofeira\cabofeira\tests\e2e` - empty
- Setup file exists: `E:\Projecten\Cabofeira\cabofeira\src\setupTests.js`

**Naming Convention (when tests are added):**
- Should follow Create React App convention: `ComponentName.test.js` or `ComponentName.spec.js`
- Co-located with components (file.jsx and file.test.js in same directory)

**Structure (when implementing):**
Tests should be organized by feature/page, following source structure:
```
src/
  components/
    ProductCard.jsx
    ProductCard.test.js      # Co-located test
  context/
    AuthContext.jsx
    AuthContext.test.js      # Context tests
  pages/
    Home.jsx
    Home.test.js             # Page tests
  utils/
    format.js
    format.test.js           # Utility tests
```

## Test Setup

**setupTests.js:**
Located at `E:\Projecten\Cabofeira\cabofeira\src\setupTests.js`

```javascript
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
```

This file is automatically loaded by Jest and configures:
- DOM testing utilities via testing-library/jest-dom
- Custom matchers like `toBeInTheDocument()`, `toHaveTextContent()`, `toBeVisible()`, etc.

## Test Structure

**Suite Organization (recommended pattern based on codebase):**

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductCard from './ProductCard';

describe('ProductCard', () => {
  describe('rendering', () => {
    test('displays product title', () => {
      const product = { id: '1', title: 'Test Product', /* ... */ };
      render(<ProductCard product={product} />);
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    test('shows featured badge when product is featured', () => {
      const product = { id: '1', featured: true, /* ... */ };
      render(<ProductCard product={product} />);
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    test('toggles favorite on button click', async () => {
      const product = { id: '1', /* ... */ };
      const user = userEvent.setup();
      render(<ProductCard product={product} />);
      
      const favButton = screen.getByRole('button', { name: /save/i });
      await user.click(favButton);
      expect(favButton).toHaveAttribute('aria-label', /saved/i);
    });
  });
});
```

**Patterns:**
- Use `describe()` blocks for logical grouping
- Use `test()` or `it()` for individual test cases
- Separate rendering tests from interaction tests
- Use data-testid sparingly, prefer accessible queries (getByRole, getByLabelText, getByText)

## Mocking

**Framework:** Jest mocking (built-in)

**Patterns:**

1. **Mock Context Provider for Integration Tests:**
   ```javascript
   // Wrapper component that provides mocked context
   const MockAuthProvider = ({ children, user = null }) => {
     return (
       <AuthContext.Provider value={{ user, login: jest.fn(), /* ... */ }}>
         {children}
       </AuthContext.Provider>
     );
   };

   test('renders login button when user is null', () => {
     render(<Navbar />, { wrapper: MockAuthProvider });
     expect(screen.getByText(/login/i)).toBeInTheDocument();
   });
   ```

2. **Mock Supabase Client:**
   ```javascript
   jest.mock('../lib/supabase', () => ({
     supabase: {
       from: jest.fn(() => ({
         select: jest.fn(() => ({
           eq: jest.fn(() => ({
             single: jest.fn().mockResolvedValue({
               data: { id: '1', name: 'Test User' },
               error: null
             })
           }))
         }))
       }))
     }
   }));
   ```

3. **Mock React Router:**
   ```javascript
   jest.mock('react-router-dom', () => ({
     ...jest.requireActual('react-router-dom'),
     useNavigate: () => jest.fn(),
     useParams: () => ({ id: 'test-id' })
   }));
   ```

**What to Mock:**
- External services (Supabase, APIs)
- React Router (useNavigate, useParams, useSearchParams)
- Context providers (when testing components that depend on them)
- Window/localStorage (when testing browser APIs)

**What NOT to Mock:**
- React itself or hooks (useState, useEffect, useContext)
- Component rendering logic
- User interactions (use @testing-library/user-event instead)
- Utility functions unless they have side effects

## Fixtures and Factories

**Test Data:**
No existing fixture pattern found. Recommended approach based on project structure:

```javascript
// tests/fixtures/products.js
export const mockProduct = {
  id: '1',
  title: 'Test Product',
  description: 'A test product',
  price: 1000,
  currency: 'CVE',
  category: 'electronics',
  subcategory: 'Cell Phones',
  condition: 'Used',
  location: { island: 'Santiago', city: 'Praia' },
  images: ['https://example.com/image.jpg'],
  featured: false,
  views: 0,
  createdAt: '2026-06-07',
  seller: {
    id: 'seller-1',
    name: 'Test Seller',
    phone: '+238912345678',
    email: 'seller@test.com',
    memberSince: '2026-01-01',
    verified: true
  }
};

export const mockUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'user@test.com',
  phone: '+238912345678',
  bio: 'Test bio',
  role: 'user',
  memberSince: '2026-01-01',
  verified: false,
  avatar: null
};

export const createMockProduct = (overrides = {}) => ({
  ...mockProduct,
  ...overrides
});
```

**Location:**
- Store fixtures in `tests/fixtures/` directory
- Import into test files as needed
- Use factory functions for parameterized test data

## Coverage

**Requirements:** None enforced currently

**View Coverage (when configured):**
```bash
npm test -- --coverage
```

Coverage would show in terminal and generate coverage reports in `coverage/` directory when enabled.

**Configuration Needed (for coverage):**
Add to package.json scripts:
```json
"test:coverage": "react-scripts test --coverage --watchAll=false"
```

## Test Types

**Unit Tests (recommended pattern):**
- Scope: Individual functions, hooks, or components in isolation
- Approach: Test one thing per test case
- Example: Test utility functions like `formatPrice()`, `timeAgo()` with various inputs
- Example: Test custom hooks like `useAuth()` return correct context value
- Example: Test component rendering with different props

```javascript
// tests/utils/format.test.js
import { formatPrice, timeAgo } from '../src/utils/format';

describe('formatPrice', () => {
  test('formats price with default CVE currency', () => {
    expect(formatPrice(1000)).toBe('1,000 CVE');
  });

  test('returns "Contact for price" when amount is zero', () => {
    expect(formatPrice(0)).toBe('Contact for price');
  });

  test('returns "Contact for price" when amount is null', () => {
    expect(formatPrice(null)).toBe('Contact for price');
  });
});
```

**Integration Tests (recommended pattern):**
- Scope: Component + its dependencies (context, child components)
- Approach: Test user workflows that involve multiple components
- Example: Test Login page with mocked AuthContext
- Example: Test ProductCard with ProductsContext

```javascript
// src/pages/Login.test.js
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Login from './Login';
import { AuthProvider } from '../context/AuthContext';

describe('Login Page Integration', () => {
  test('logs in user with valid credentials', async () => {
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <Login />
      </AuthProvider>
    );
    
    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'user@test.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });
  });
});
```

**E2E Tests:**
- Framework: Not currently set up (test directories exist but empty)
- Recommendations when needed: Playwright, Cypress, or Selenium
- Scope: Full user workflows through the application
- Example: User posts an ad from signup to payment to listing

## Common Testing Patterns

**Async Testing:**
```javascript
// Using waitFor for async operations
test('loads and displays products', async () => {
  render(<Home />);
  
  await waitFor(() => {
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });
});

// Using async/await in test
test('displays error when fetch fails', async () => {
  jest.mock('../lib/supabase', () => ({
    supabase: { from: () => ({ select: () => ({ error: 'Failed' }) }) }
  }));
  
  render(<Search />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

**Error Testing:**
```javascript
// Testing error states in components
test('shows error message on failed login', async () => {
  const user = userEvent.setup();
  jest.mock('../lib/supabase', () => ({
    supabase: {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          error: { message: 'Invalid credentials' }
        })
      }
    }
  }));

  render(<Login />);
  const submitButton = screen.getByRole('button', { name: /login/i });
  
  await user.click(submitButton);
  
  await waitFor(() => {
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });
});

// Testing hook errors
test('throws error when useAuth is used outside provider', () => {
  expect(() => {
    render(<ComponentUsingUseAuth />);  // without AuthProvider wrapper
  }).toThrow('useAuth must be used within AuthProvider');
});
```

**Context Testing:**
```javascript
// Testing custom hooks from context
test('useAuth returns current user', () => {
  const { result } = renderHook(() => useAuth(), {
    wrapper: ({ children }) => (
      <AuthProvider>{children}</AuthProvider>
    )
  });

  expect(result.current.user).toBeNull();
  expect(typeof result.current.login).toBe('function');
});

// Testing context provider effects
test('AuthProvider loads user on mount', async () => {
  jest.mock('../lib/supabase', () => ({
    supabase: {
      auth: {
        getSession: jest.fn().mockResolvedValue({
          data: { session: { user: { id: '1' } } }
        })
      }
    }
  }));

  const { getByText } = render(
    <AuthProvider>
      <TestComponent />
    </AuthProvider>
  );

  await waitFor(() => {
    expect(getByText('User loaded')).toBeInTheDocument();
  });
});
```

## Coverage Gaps (Current State)

**Not Tested:**
- All React components (no tests currently exist)
- All utility functions (`format.js`)
- All context providers (`AuthContext.jsx`, `ProductsContext.jsx`, etc.)
- All pages

**High Priority for Testing (by risk):**
1. **AuthContext** - Critical authentication logic, password reset flow, recovery flags
2. **ProductsContext** - Product CRUD operations, image upload/cleanup
3. **Login/Register pages** - User signup/signin flows
4. **PostAd page** - Complex multi-step form with file uploads
5. **Utility functions** - formatPrice, timeAgo (used everywhere)

---

*Testing analysis: 2026-06-07*
