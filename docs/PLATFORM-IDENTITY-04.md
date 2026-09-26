# PLATFORM-IDENTITY-04 — Schema Foundation

**Date:** 2026-09-23  
**Status:** Implementation complete — see evidence + final verdict in chat report  
**Scope:** Additive schema, feature flag, domain types, repository. No authz/JWT/UI/API.

---

## Invariant

When `PLATFORM_IDENTITY_ENABLED` is absent or false, observable behaviour equals pre-PI-04.

Enabling the flag exposes **infrastructure only**. It does **not** grant platform authority.

---

## Model

```text
User
├── platform_assignments (0..N)  → PlatformRole + status
└── memberships (0..N)           → Tenant role (SUPER_ADMIN, …)
```

`SUPER_ADMIN` remains tenant-scoped. `PLATFORM_SUPER_ADMIN` is a separate enum value stored only on `platform_assignments`.

---

## Feature flag

| Aspect | Behaviour |
|--------|-----------|
| Name | `PLATFORM_IDENTITY_ENABLED` |
| Default | `false` (undefined/empty ⇒ false) |
| Surface | Server-side (`src/lib/platform-identity-flag.ts`) |
| Client override | Forbidden |

---

## Persistence

| Object | Detail |
|--------|--------|
| Table | `platform_assignments` |
| Migration | `drizzle/0006_platform_identity.sql` + `ensureSchema()` |
| Unique | `(user_id, role)` |
| Status | `ACTIVE` \| `SUSPENDED` \| `REVOKED` |
| Backfill | **None** — no SUPER_ADMIN promotion |

---

## Out of scope (deferred)

Platform Admin UI/API, JWT claims, authorization wiring (PI-05), Entitlements, Billing, Campaigns, Live Media, Device/Experience runtime.

---

## Evidence

`docs/evidence/platform-identity-04/`  
ADR: `docs/adr/ADR-PLATFORM-IDENTITY-004.md`
