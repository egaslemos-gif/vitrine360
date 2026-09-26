# ADR-PLATFORM-IDENTITY-009 — Tenant Lifecycle Enforcement

**Status:** Accepted  
**Date:** 2026-09-23  
**Phase:** PLATFORM-IDENTITY-09  
**Supersedes residual R1** from ADR-PLATFORM-IDENTITY-008 (semantics) with runtime enforcement.

## Context

PI-08 defined `ACTIVE ⇄ SUSPENDED` and forbade hard delete. `tenants.status` was still display-only (R1). Operators could believe SUSPENDED meant blocked.

## Decision

1. Implement Platform-scoped `suspend` / `reactivate` behind `platform.tenants.suspend`.  
2. Enforce a single **tenant operable gate** (`ACTIVE` only, fail closed) on session, tenant authz, workspace switch, device Bearer, and experience serve.  
3. Do **not** cascade-update memberships or devices on suspend.  
4. Keep JWT free of tenant status claims; revalidate from DB.  
5. Ship no hard-delete API.  
6. Keep Platform metadata read available for SUSPENDED tenants.  
7. Audit every lifecycle mutation with `from` / `to` / `idempotent` / optional `reason`.

## Consequences

- Flag OFF → lifecycle mutation routes 404; enforcement helpers still fail closed on non-ACTIVE if called.  
- Suspended workspace: no admin session, no device sync/manifest/heartbeat/media via Bearer, no `/x/` serve.  
- Reactivate restores gates without data rebuild.  
- Further states (PENDING / ARCHIVED) and hard delete need separate ADRs.
