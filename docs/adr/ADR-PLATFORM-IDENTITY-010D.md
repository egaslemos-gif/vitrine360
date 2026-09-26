# ADR-PLATFORM-IDENTITY-010D — Entitlement Enforcement Pilot

## Status

Accepted (controlled pilot). Usage/quota deferred.

## Context

PI-10C can answer “what does the tenant have?”. Operations need “is this allowed?” without duplicating resolution or scattering plan checks.

## Decision

1. Central `enforceEntitlement({ tenantId, key, operation })` consuming `resolveEffectiveEntitlements`.
2. When `ENTITLEMENTS_ENABLED` is OFF → ALLOW (`FLAG_OFF`) without requiring a plan.
3. When ON → fail-closed FEATURE_GATE; missing/invalid/no plan → DENY.
4. Pilot wire only: `pairDevice` → `assertDevicesEnabled` (`devices.enabled`).
5. Compatibility seed binds `devices.enabled=true` (not a quota).
6. API deny: HTTP 403 `{ code: "ENTITLEMENT_DENIED", entitlement }`.
7. RBAC and lifecycle remain separate (session layer); entitlement does not replace them.

## Consequences

- Turning the flag ON without TenantPlan assignment will deny device pairing (intentional fail-closed).
- `startDevicePairing` (PENDING, no tenant) is not gated — association happens at pair time.

## Alternatives considered

- Enforce `devices.max` now — rejected (needs Usage engine).
- Route-only checks — rejected (bypass risk / duplication).
