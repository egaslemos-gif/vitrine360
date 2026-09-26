# PLATFORM-IDENTITY-10A — Current State Audit

**Date:** 2026-09-24 · Code + docs inspected

## Code (`src/`)

| Search | Result |
|--------|--------|
| `plan` / `subscription` / `entitlement` tables | **Absent** |
| Billing / Stripe | **Absent** |
| `getEffectiveEntitlements` | **Absent** |
| Hidden max devices/users/storage in services | **Not found** |
| `PLATFORM_PERMISSIONS` | `platform.tenants.read`, `platform.tenants.suspend` only |
| `ROLE_PERMISSIONS` | Tenant operational permissions only |
| `PLATFORM_IDENTITY_ENABLED` | Feature **flag** (infra), not commercial entitlement |
| `tenants.status` | Lifecycle only (PI-09) |
| IndexedDB “quota” comments | Browser storage quota — unrelated to SaaS |

## Documentation (pre-existing)

| Doc | Content |
|-----|---------|
| PI-01 Audit | Billing boundary sketched; no implementation |
| PI-02 Target + `ENTITLEMENT-MODEL.md` | Permission vs Entitlement; Plan→Subscription→Entitlement |
| PI-02 Permission matrix | Future `platform.plans.*` / `billing.*` / `entitlements.*` (not coded) |
| PI-03 phases | Historically numbered PI-08 entitlements — **superseded in practice** by lifecycle PI-08/09 |
| PI-04…09 | Explicitly exclude Billing/Entitlements from ship |

## Roadmap only

Commercial SKUs, prices, Stripe, usage dashboards — not in repo as product constants.

## Informal limits

Rate limits (API) and Experience bridge byte limits are **security/technical**, not plan entitlements.
