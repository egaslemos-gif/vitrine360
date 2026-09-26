# ADR-PLATFORM-IDENTITY-010-QUOTA-SEMANTICS — Device Count & Downgrade

## Status

Accepted. Closes blockers for PI-10G Quantitative Enforcement (devices.max).

## Context

PI-10F left device count mode provisional and DEC-08 OPEN. Enforcement cannot ship without deterministic Usage and downgrade behaviour.

## Decision

1. **`devices.count` / future `devices.max` Usage** = paired non-DISABLED devices (`tenant_id` present ∧ `status ≠ DISABLED`).
2. **Downgrade overage** = BLOCK NEW allocations + ALLOW EXISTING devices; no auto-disable, no grace timer, no tenant suspend-for-overage in v1. Reactivate DISABLED counts as NEW if it would exceed.

## Consequences

- PI-10G can implement `assertDevicesQuota` using `countDevices(..., "PAIRED_NON_DISABLED")`.
- Plan Management must surface over-quota state (usage > limit) without deleting screens.
- Grace/auto-disable remain future product options, not prerequisites.

## Alternatives rejected

- ACTIVE_ONLY — under-counts OFFLINE inventory.
- ALL_WITH_TENANT — charges for DISABLED.
- Force-disable excess on downgrade — destructive without operator consent.
- Grace before BLOCK NEW — adds scheduler complexity; defer.
