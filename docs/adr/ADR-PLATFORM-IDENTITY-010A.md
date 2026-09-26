# ADR-PLATFORM-IDENTITY-010A — Entitlements & Plan Model (Architecture)

**Status:** Accepted (architecture)  
**Date:** 2026-09-24  
**Phase:** PLATFORM-IDENTITY-10A  
**Follow-on:** PI-10B+ implementation (not this ADR)

## Context

PI-09 enforces Tenant Lifecycle. Commercial **Plans / Entitlements / Quotas** remain unimplemented. PI-02 already separated Permission vs Entitlement conceptually. Implementation without a hardened audit would risk encoding plan limits as roles or JWT claims.

## Decision

1. Keep **RBAC**, **Entitlements**, **Lifecycle**, **Feature flags**, and **Billing** as distinct axes.  
2. Adopt the conceptual graph: `EntitlementDefinition` → `Plan`/`PlanEntitlement` → `TenantPlan` → `EffectiveEntitlements` (+ optional Platform overrides + Usage meters).  
3. Day-1 value types: BOOLEAN, INTEGER, BYTES (ENUM deferred).  
4. Resolve entitlements **server-side**; never durable JWT authority.  
5. Evaluation order: Auth → Lifecycle → RBAC → Entitlement → Tenant scope.  
6. Ship **documentation only** in PI-10A; no schema/API/UI/runtime changes.  
7. Preserve PI-02 naming intent; renumber implementation to PI-10B+ (lifecycle already used PI-08/09).

## Consequences

- Existing tenants need a future default `TenantPlan` before hard enforcement.  
- Platform permission catalogue will later grow (`plans.*`, `entitlements.*`, …) without merging into tenant `PERMISSIONS`.  
- Billing may drive plan binding or suspend actions only through explicit policies.
