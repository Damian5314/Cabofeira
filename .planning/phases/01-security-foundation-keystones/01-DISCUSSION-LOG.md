# Phase 1: Security Foundation + Keystones - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 01-security-foundation-keystones
**Areas discussed:** Status enforcement layer, Notifications keystone shape, Audit log keystone shape

---

## Status Enforcement Layer

### Where to enforce "only active listings are public"
| Option | Description | Selected |
|--------|-------------|----------|
| RLS policy | Rewrite products SELECT: `status='active' OR auth.uid()=seller_id OR is_admin()`. Defense-in-depth. | ✓ |
| App-level filtering only | `.eq('status','active')` in app queries; RLS stays world-readable. Bypassable via direct API. | |
| Both (RLS + app filter) | RLS boundary + explicit app filter for clarity/perf. | |

### Status column type
| Option | Description | Selected |
|--------|-------------|----------|
| text + CHECK | Matches existing convention (role, currency); easy to extend. | ✓ |
| Postgres ENUM | Stronger typing but needs ALTER TYPE; diverges from schema. | |

### Visibility of non-active listings
| Option | Description | Selected |
|--------|-------------|----------|
| Owner + admin | Seller sees own sold/hidden in My Ads; admin sees all; public sees active only. | ✓ |
| Admin only | Owner can't query own non-active listings; breaks My Ads. | |

**User's choice:** RLS policy / text + CHECK / Owner + admin
**Notes:** Owner+admin visibility chosen to support Phase 2 mark-as-sold "My Ads" UX. RLS is the security boundary; app-level filter optional later.

---

## Notifications Keystone Shape

### Reusable fan-out mechanism
| Option | Description | Selected |
|--------|-------------|----------|
| Generic function + thin triggers | One `create_notification()` SECURITY DEFINER fn; events plug in via small triggers. | ✓ |
| Per-event triggers only | Each event writes rows directly. Duplication. | |
| Function only, no triggers yet | Build fn now, defer all triggers to consuming phases. | |

### Notification `type` field flexibility
| Option | Description | Selected |
|--------|-------------|----------|
| text + CHECK, seeded set | `check(type in ('new_message','saved_search','price_drop','system'))`. Validated + forward-looking. | ✓ |
| Open text (no CHECK) | Any string; never migrates but unvalidated. | |

### Read/unread state representation
| Option | Description | Selected |
|--------|-------------|----------|
| read_at timestamp | Unread = null; retains read timestamp. | ✓ |
| read boolean | Simpler; loses timestamp. | |

**User's choice:** Generic function + thin triggers / text + CHECK seeded set / read_at timestamp
**Notes:** No event triggers wired this phase — Phase 2 wires `new_message`. Forward-looking type values avoid immediate ALTER. Keystone = function + table + realtime publication.

---

## Audit Log Keystone Shape

### Function & row shape
| Option | Description | Selected |
|--------|-------------|----------|
| Generic + jsonb details | `log_admin_action(action, target_table, target_id, details jsonb)`. One signature for all. | ✓ |
| Typed per-action columns | Queryable without jsonb but rigid; ALTER per action type. | |

### Before/after diff capture
| Option | Description | Selected |
|--------|-------------|----------|
| Caller passes details jsonb | Action code supplies relevant before/after in details. Flexible. | ✓ |
| Auto-capture full old+new rows | Table triggers auto-fill old/new jsonb. Complete but heavy. | |

### Append-only enforcement
| Option | Description | Selected |
|--------|-------------|----------|
| No UPDATE/DELETE policies + revoke | Admin SELECT only; inserts via SECURITY DEFINER fn. RLS-native. | ✓ |
| Trigger that RAISES on UPDATE/DELETE | Explicit but redundant vs RLS denial. | |

**User's choice:** Generic + jsonb details / Caller passes details jsonb / No UPDATE/DELETE policies + revoke
**Notes:** Keystone for Phase 2 ADMIN-01/02. Read restricted to admins via `is_admin()`.

---

## Claude's Discretion

- **RLS guard mechanism (SEC-01/02/03):** mechanism prescribed by requirements (WITH CHECK + BEFORE UPDATE trigger). Failure mode set to silent reset to OLD/safe values (not RAISE EXCEPTION) — flagged for researcher to challenge if a hard error is materially safer.
- **SEC-04 demo accounts & git scrub** (area not selected for discussion): delete demo accounts in Supabase Auth, strip credential block from schema.sql, scrub git history with `git filter-repo` + coordinated force-push (belt-and-suspenders since demo passwords belong to deleted accounts). Method (filter-repo vs BFG, force-push coordination) confirmed at execution.
- SQL file organization, grant/revoke specifics, realtime publication statement wording.

## Deferred Ideas

- Demo-login replacement / real test accounts — decide during SEC-04 execution.
- `increment_product_views()` rate-limiting — abuse vector, not a Phase 1 criterion.
- Auto-capture audit triggers — considered, rejected for launch.
- Saved-search / price-drop notification triggers — v2.
- Message-notification trigger (FEAT-08) — Phase 2.
