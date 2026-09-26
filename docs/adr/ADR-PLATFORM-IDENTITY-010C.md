# ADR-PLATFORM-IDENTITY-010C — Effective Entitlements Resolver

## Status

Accepted (resolver foundation). Enforcement deferred to PI-10D.

## Context

PI-10B persisted Definition / Plan / PlanEntitlement / TenantPlan. Consumers need a single read-only answer: “what are this tenant’s effective entitlements?” without blocking operations yet.

## Decision

1. Implement `resolveEffectiveEntitlements(tenantId)` as a pure read path over ACTIVE TenantPlan → Plan → bindings → definitions.
2. Return a typed `EntitlementResolveResult` (never bare `null` / generic throw for expected domain states).
3. Reuse PI-10B `parseEntitlementValue`; ignore inactive definitions with `INACTIVE_DEFINITION_IGNORED`.
4. No automatic fallback to compatibility plan; no overrides; no usage; no billing; no cache; no resource API wiring.
5. Sort entitlements by `key` for deterministic ordering; inject `now` for stable `resolvedAt` in tests.

## Consequences

- PI-10D can enforce against the same contract.
- Data inconsistencies surface as typed failures (`NO_ACTIVE_PLAN`, `MULTIPLE_ACTIVE_PLANS`, etc.).

## Alternatives considered

- Silent default-plan fallback — rejected (hides missing TenantPlan).
- Enforcement in same phase — rejected (scope PI-10D).
