# ADR-PLATFORM-IDENTITY-010K — Quota & Entitlement Cross-System Audit

## Status

Accepted (VALIDATED)

## Context

PI-10B–PI-10J delivered entitlements, effective resolution, usage, device quota, storage reservation, and storage enforcement. PI-10K audits the full chain and hardens only integrity gaps.

## Decision

1. Keep centralized `resolveEffectiveEntitlements` as the only entitlement authority for enforcement.
2. Keep usage authorities: PAIRED_NON_DISABLED; storage committed+reserved.
3. Keep `withTenantAllocationLock` + drizzle transaction as the allocation boundary.
4. Harden heal paths, prepare reservation expiry (lazy), and suspended-tenant checks at service layer.
5. Do **not** start Billing / Subscription / Payments / Stripe / Customer Billing UI.
6. Do **not** implement DEC-STORAGE-07 / DEC-STORAGE-08 TTL worker.
7. Leave `ENTITLEMENTS_ENABLED` default OFF.

## Consequences

- Production behaviour unchanged while flag OFF.
- Flag ON remains fail-closed for missing plan/entitlement and over-quota.
- Sticky prepare reservations no longer permanently consume quota after TTL (lazy release).
