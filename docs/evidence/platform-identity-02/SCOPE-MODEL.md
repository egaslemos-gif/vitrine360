# PLATFORM-IDENTITY-02 — Scope Model

**Date:** 2026-09-23  
**Status:** Target design (not implemented)  
**Depends on:** PLATFORM-IDENTITY-01 — AUDIT VALIDATED

## Three scopes

```
┌─────────────────────────────────────────────────────────────┐
│ PLATFORM_SCOPE                                              │
│ Authority over the Vitrine360 SaaS control plane            │
│ Tenants lifecycle · Plans · Billing · Global settings       │
│ Platform audit · Support break-glass                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ binds / entitles (does NOT replace)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ TENANT_SCOPE                                                │
│ Authority inside one Workspace (tenants row)                │
│ Membership.role → Tenant permissions                        │
│ Members · Devices · Contents · Playlists · Schedules · …    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ owns / operates
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ RESOURCE_SCOPE                                              │
│ Concrete objects inside a tenant                            │
│ Device · Group · Content · Media · Playlist · Schedule      │
│ Experience · (future) LiveBroadcast                         │
│ + Device Bearer token path (player runtime)                 │
└─────────────────────────────────────────────────────────────┘
```

## PLATFORM_SCOPE

| Dimension | Definition |
|-----------|------------|
| Subject | Platform staff (same User identity, separate authorization axis) |
| Authority source | Platform Role → Platform Permissions (server-resolved) |
| Objects | Tenant records, plans, prices, subscriptions, invoices, platform settings, platform audit |
| Must NOT | Silently imply Membership in every tenant; mutate tenant content without an explicit Tenant Access Context |

## TENANT_SCOPE

| Dimension | Definition |
|-----------|------------|
| Subject | Workspace member |
| Authority source | ACTIVE `Membership` → tenant role → tenant permissions |
| Objects | Resources of **that** tenant only |
| Active Tenant | **Context** after membership validation — never sole authority |

Current roles remain tenant-scoped: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `OPERATOR`, `VIEWER`.

## RESOURCE_SCOPE

| Dimension | Definition |
|-----------|------------|
| Subject | Member acting on a resource, **or** device acting with Bearer token |
| Authority source | Tenant permission **plus** `resource.tenantId === authorizedTenantId` (and device ownership for player APIs) |
| When tenant permission is enough | Most CRUD today (list/create within tenant; get/update/delete by id + tenantId) |
| When resource-level needed later | Per-resource ACL (e.g. editor owns playlist only); device-bound Experiences; LiveBroadcast channel ownership; support read-only of a single device |

## Hard rule

```
Platform permission  ⇏  Tenant permission
Tenant permission    ⇏  Platform permission
JWT / URL / client tenantId  ≠  authority without server revalidation
```
