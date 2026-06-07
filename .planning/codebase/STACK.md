# Technology Stack

**Analysis Date:** 2026-06-07

## Languages

**Primary:**
- JavaScript (ES6+) - React application and components
- JSX - Component rendering

**Secondary:**
- SQL - Supabase database schema and stored procedures
- CSS - Styling (vanilla CSS)

## Runtime

**Environment:**
- Node.js v22.13.0+ (development)
- npm v11.3.0+ (package management)
- Browser (React SPA runs client-side)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 19.1.0 - UI framework
- React DOM 19.1.0 - DOM rendering
- React Router DOM 7.6.0 - Client-side routing

**Build/Dev:**
- React Scripts 5.0.1 - Create React App build tooling
- Web Vitals 2.1.4 - Performance monitoring

**UI Components:**
- React Icons 5.6.0 - Icon library

**Testing:**
- @testing-library/react 16.3.0 - Component testing
- @testing-library/dom 10.4.0 - DOM testing utilities
- @testing-library/jest-dom 6.6.3 - DOM matchers
- @testing-library/user-event 13.5.0 - User interaction simulation

## Key Dependencies

**Critical:**
- @supabase/supabase-js 2.105.4 - PostgreSQL database client and authentication

**Infrastructure:**
- None additional (Supabase handles all backend services)

## Configuration

**Environment:**
- `.env.local` file required (created from `.env.example`)
- Key environment variables:
  - `REACT_APP_SUPABASE_URL` - Supabase project URL
  - `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous public key
  - `SUPABASE_SERVICE_ROLE_KEY` - (optional, for backend operations)

**Build:**
- Create React App default webpack/Babel configuration (ejected? No)
- ESLint: `react-app`, `react-app/jest` (inherited from CRA)
- No explicit Prettier or TypeScript configuration

## Platform Requirements

**Development:**
- Node.js 22.13.0 or compatible
- npm or yarn
- Modern browser (Chrome, Firefox, Safari)

**Production:**
- Static web hosting (serves compiled React SPA)
- Supabase PostgreSQL backend (external)
- Supabase Storage for image uploads (external)

---

*Stack analysis: 2026-06-07*
