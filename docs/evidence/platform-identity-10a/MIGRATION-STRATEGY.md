# PLATFORM-IDENTITY-10A — Migration Strategy

## Principles

- Additive schema only; feature flag for enforcement.  
- No JWT migration.  
- No Membership backfill of fake “plan roles”.  
- Default plan for all existing tenants **before** hard limits.  
- Enforcement starts on **create** paths; reads remain available.

## Suggested sequence (future)

| Step | Action |
|------|--------|
| M1 | Schema: definitions, plans, plan_entitlements, tenant_plans (+ optional overrides/usage) |
| M2 | Seed MVP plan + entitlement keys |
| M3 | Backfill TenantPlan → default plan for every tenant |
| M4 | `getEffectiveEntitlements` + tests (no deny yet) |
| M5 | Shadow log would-deny |
| M6 | Enforce selected hard limits behind flag |
| M7 | Platform Console plan assign UI |
| M8 | Billing provider binding (optional later) |

## Compatibility

| Surface | Impact |
|---------|--------|
| Devices / Media / Content / Playlists / Schedules | Unchanged until M6 |
| Experience / Player / Device Runtime | Unchanged; gates later at admit/create |
| Platform Console | Read-only today; later plan metadata |
| PI-09 Lifecycle | Remains first operable gate |

**No backfill executed in PI-10A.**
