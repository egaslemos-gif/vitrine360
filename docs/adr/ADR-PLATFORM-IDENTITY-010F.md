# ADR-PLATFORM-IDENTITY-010F — Usage & Quota Foundation

## Status

Accepted (foundation). Enforcement deferred to PI-10G pending OPEN decisions.

## Context

PI-10E defined hybrid derived usage and quota-as-entitlement. Implementation needs a safe read-only layer before any HARD_LIMIT wiring.

## Decision

1. Add pure domain `evaluateQuota` and Usage DTO/sources.
2. Derive current usage from DB tables only (`resolveUsage`).
3. Storage authority = `SUM(media_assets.file_size)`; never R2 for quota.
4. Keep device count mode provisional/OPEN — do not ship commercial semantics.
5. Do not call evaluation from resource mutations in this phase.
6. Preserve OPEN: DEC-07/08/11/14/15 and device count.

## Consequences

PI-10G can wire `evaluateQuota` + `resolveUsage` inside transactional boundaries once product closes device semantics and downgrade policy.
