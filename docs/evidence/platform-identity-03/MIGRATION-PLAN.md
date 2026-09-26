# PLATFORM-IDENTITY-03 — Migration Plan

Additive only. Existing Users / Memberships / Tenants remain valid.

## 1. Principles

1. **No destructive rename** of membership `SUPER_ADMIN` in first ship.  
2. **No dual-write of platform role into `memberships`**.  
3. **Backfill empty** platform assignments — zero automatic promotions.  
4. **First Platform Super Admin** created by controlled ops script/env allowlist — never “all workspace SUPER_ADMINs”.  
5. **Rollback** = feature flag off (code paths ignore platform tables).

## 2. Steps (future implementation phases)

| Step | Action | Rollback |
|------|--------|----------|
| M1 | Add platform assignment table(s) via migration | Drop tables (empty) |
| M2 | Deploy code with `PLATFORM_IDENTITY_ENABLED=false` | Redeploy previous |
| M3 | Run ops bootstrap for N platform operators | Delete assignment rows |
| M4 | Staging flag on + SECURITY-GATE | Flag off |
| M5 | Production flag on | Flag off |
| M6 | Optional later: rename membership SUPER_ADMIN display / enum | Dedicated migration + UX |

## 3. Data mapping

| Existing | Action |
|----------|--------|
| `users` | Unchanged identity |
| `memberships` | Unchanged tenant authority |
| `users.role` / `users.tenantId` | Remain legacy; optional cleanup phase later |
| Workspace SUPER_ADMIN rows | **Stay** tenant SUPER_ADMIN — **not** copied to platform |

## 4. Forbidden migrations

- `UPDATE memberships SET role = 'PLATFORM_*'`  
- Granting platform permissions inside `ROLE_PERMISSIONS` for SUPER_ADMIN  
- Deleting memberships to “force” platform-only users without product decision  

## 5. Entitlements (later)

Separate tables bound to `tenantId` as customer.  
Billing updates entitlements; **never** membership roles.  
No entitlement rows required for PI-04/05 authz ship.
