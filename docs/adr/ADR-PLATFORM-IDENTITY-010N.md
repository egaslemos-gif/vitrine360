# ADR-PLATFORM-IDENTITY-010N — Non-production entitlements activation readiness

## Status

Accepted — VALIDATED WITH ENVIRONMENT LIMITATION

## Context

PI-10B–10M delivered entitlements through storage decision closure with `ENTITLEMENTS_ENABLED` default OFF. PI-10N proves controlled non-production activation is safe and documents blockers for wholesale ON.

## Decision

1. Production must remain OFF until a separate production readiness phase.
2. `compatibility_default` is insufficient alone for quantitative ops under fail-closed; staging activation requires explicit `devices.max` + `storage.maxBytes` plan bindings (technical, not commercial SKUs).
3. Activation procedure is reversible by flag OFF alone (no schema rollback).
4. Flag is trusted-env only; never client-controlled.
5. No Billing / Subscription / Payments / Stripe / commercial UI in this phase.

## Consequences

- Ops must plan staging TenantPlans before flipping Preview ON.
- Local suite `test-platform-identity-10n` is the automated readiness gate until Preview env is wired.
