# ADR-PLATFORM-IDENTITY-010G — devices.max quantitative enforcement

## Status

Accepted (PI-10G)

## Context

PI-10F delivered derived Usage + pure `evaluateQuota`. Device Count semantics and DEC-08 were closed. This ADR records the first HARD_LIMIT enforcement pilot.

## Decision

1. Enforce `devices.max` only when `ENTITLEMENTS_ENABLED=ON`.
2. Allocation = operations that increase `PAIRED_NON_DISABLED`: `pairDevice`, reactivate via `setDeviceStatus(DISABLED→ACTIVE)`.
3. Fail-closed on missing/invalid entitlement when flag ON.
4. Atomicity: `withTenantAllocationLock` = per-tenant async mutex + `db.transaction` (libsql `BEGIN IMMEDIATE`); COUNT uses the same `tx` as the mutation.
5. No persistent counters or reservation tables.
6. DEC-08: overage after downgrade keeps existing devices; new allocations DENY.
7. Disable/delete never blocked by quota.
8. Error contract: HTTP 403 `{ error: "ENTITLEMENT_DENIED", code: "QUOTA_EXCEEDED", entitlement, reason }`.

## Consequences

- Cross-process safety relies on SQLite write-lock serialization of IMMEDIATE transactions.
- Observability for denials is best-effort (must not mask `EntitlementDeniedError`).
- Next: PI-10H storage quota (separate pilot).
