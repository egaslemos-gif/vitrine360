# PLATFORM-IDENTITY-04 — Pre-Implementation Audit

**Date:** 2026-09-23  
**Phase:** PI-04 foundation only  
**Status:** COMPLETE — before schema changes

---

## 1. Current schema (identity-relevant)

| Table | Purpose | Notes |
|-------|---------|-------|
| `tenants` | Workspace boundary | `status` text default `ACTIVE` (residual risk from PI-03) |
| `users` | Account | Legacy `role` + `tenant_id` (home); authz via memberships |
| `memberships` | Tenant authority | `role` includes `SUPER_ADMIN`; `status` ACTIVE/INVITED/SUSPENDED |
| `user_identities` | OAuth bindings | Not platform |
| `devices` | Device identity | Bearer/pairing — out of PI-04 scope |

No platform tables exist today.

---

## 2. Migration mechanism

| Mechanism | Role |
|-----------|------|
| `drizzle/` SQL files | Versioned migrations (`0000`…`0005`; journal lags for some) |
| `ensureSchema()` in `src/db/client.ts` | Idempotent runtime CREATE/ALTER for pilot DBs |
| `db:push` / `db:generate` | Drizzle Kit helpers |

**PI-04 approach:** additive SQL file **and** `ensureSchema()` CREATE TABLE IF NOT EXISTS (same pattern as memberships).

---

## 3. Naming conventions

- Tables: snake_plural (`memberships`, `user_identities`)
- Columns: snake_case in SQL / camelCase in Drizzle
- Status: uppercase text (`ACTIVE`, `SUSPENDED`)
- Roles: uppercase snake (`SUPER_ADMIN`)
- Timestamps: `created_at` / `updated_at` as text datetime

**Proposed table:** `platform_assignments`  
**Proposed role enum (app-validated):** `PLATFORM_SUPER_ADMIN` (minimum for PI-04)  
**Proposed status:** `ACTIVE` | `SUSPENDED` | `REVOKED`

---

## 4. Current auth / membership

- Session JWT: user + tenant context; permissions revalidated server-side from membership.
- `SUPER_ADMIN` = tenant Membership role only.
- Seed `admin@vitrine360.local` → tenant `SUPER_ADMIN` — **must not** become platform.

---

## 5. Proposed additions (additive only)

1. Feature flag `PLATFORM_IDENTITY_ENABLED` (default false / undefined → false), server-side.
2. Table `platform_assignments` (user_id FK → users, role, status, timestamps, optional notes).
3. Domain types + `PlatformIdentityRepository`.
4. No JWT/session/authz/UI/API/Billing/Entitlement changes.
5. No backfill from memberships.

---

## 6. Compatibility strategy

| Invariant | Strategy |
|-----------|----------|
| Flag OFF = current behaviour | Flag gated; no auth wiring in PI-04 |
| Existing SUPER_ADMIN | Untouched; no INSERT from memberships |
| Seed | Unchanged semantics |
| Rollback | DROP TABLE platform_assignments only; document procedure |
| Residual risks (tenants.status, seed, /x/, login home) | Reviewed in RISK section of evidence — not blockers for additive schema |

---

## 7. Explicit non-goals (PI-04)

Platform Admin UI, Platform APIs, JWT claims, authorization middleware, Entitlements, Billing, Campaigns, Live Media, Experience/Device changes.
