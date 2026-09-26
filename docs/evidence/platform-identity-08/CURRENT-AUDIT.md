# PLATFORM-IDENTITY-08 — Current Tenant Behaviour Audit

**Date:** 2026-09-23  
**Method:** Code inspection (`src/`), no behaviour changes

## Creation

- `createTenant({ name, slug })` → always `status: "ACTIVE"`
- Callers: seed, tests, `ensureDefaultTenant`, Google identity provisioning helpers
- No platform-permission gate on create today

## Update

- `PATCH /api/admin/workspace` → name, timezone only (`manage_users`)
- Does **not** accept or mutate `status`

## Delete

- No application `deleteTenant`
- Schema: many child tables `ON DELETE cascade` from `tenants`

## Status reads

| Consumer | Uses `tenants.status`? |
|----------|------------------------|
| Platform list/detail API | Yes (display) |
| Platform Console UI | Yes (display) |
| Workspace GET | Yes (display) |
| `getSession` / `requireSession` | **No** |
| `getAuthContext` tenant axis | **No** |
| Device Bearer / sync / manifest | **No** |
| Experience admit / `/x/` | **No** |
| Media routes | **No** |

## Membership lifecycle (separate)

`memberships.status`: ACTIVE | INVITED | SUSPENDED — **enforced** for session.  
Independent of `tenants.status`.
