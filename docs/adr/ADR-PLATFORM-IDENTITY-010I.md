# ADR-PLATFORM-IDENTITY-010I — Storage reservation foundation

## Status

Accepted (PI-10I)

## Context

PI-10H closed DEC-07: reservation REQUIRED before `storage.maxBytes` HARD_LIMIT. Upload must not change yet.

## Decision

1. Persist `storage_reservations` with unique `(tenant_id, operation_id)`.
2. Active capacity = rows with `status = RESERVED` only.
3. Atomic reserve uses the same drizzle IMMEDIATE transaction pattern as device allocation (PI-10G).
4. Conceptual `maxBytes` is a parameter for foundation/tests — not PlanEntitlement resolution in this phase.
5. Apply missing `media_assets_tenant_checksum_uidx` via additive migration (no historical rewrite).
6. Leave DEC-STORAGE-07 / DEC-STORAGE-08 OPEN.

## Consequences

PI-10J can wire prepare/complete to reserve/commit/release behind `ENTITLEMENTS_ENABLED` without inventing concurrency controls.
