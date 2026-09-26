# PI-10P — Controlled Production Cohort Expansion

**Date:** 2026-09-25  
**Verdict:** **PRODUCTION CONTROLLED COHORT EXPANSION READY**  
**Authorization:** `Authorize cohort expansion: admin@vitrine360.local`  
**Resolved tenant:** `demo` (unique ACTIVE membership)  
**Prior pilot:** `egaslemos` (unchanged)  
**Flag / deploy:** unchanged (`ENTITLEMENTS_ENABLED=true`, `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6`)

## Absolute safety (PASS)

| Check | Result |
|-------|--------|
| Production DB / host | `vitrine360` / Production Turso host |
| Preview DB / host | distinct; Preview flag untouched |
| Production R2 | `vitrine360` |
| Schema migrations this phase | **none** |
| Flag change | **none** (already ON) |
| Redeploy | **none** |
| Authorized identity | email → **1** user → **1** membership → slug `demo` |
| Mass expansion | **no** — only `demo` added |

## Identity resolution

| Field | Value |
|-------|--------|
| Auth string | `admin@vitrine360.local` |
| user_id | `667cb298-…` |
| membership | SUPER_ADMIN / ACTIVE |
| tenant slug | `demo` |
| tenant status | ACTIVE |

## Pre-expansion usage floors (`demo`)

| Metric | Value |
|--------|-------|
| PAIRED_NON_DISABLED devices | 5 |
| committed_bytes | 47 029 922 (~44.9 MiB) |
| reserved_bytes | 0 |
| Prior TenantPlans | **0** (was non-cohort witness) |

Pilot plan limits (`devices.max=5`, `storage.maxBytes=10 MiB`) are **below** demo storage → separate cohort plan required.

## Cohort plan assigned

| Field | Value |
|-------|--------|
| plan key | `pi10p_production_cohort_demo` |
| `devices.enabled` | true |
| `devices.max` | **10** (≥ usage 5) |
| `storage.maxBytes` | **104 857 600** (100 MiB ≥ committed+reserved) |
| TenantPlan | ACTIVE |

## Post-expansion cohort

| Tenant | Plan | Resolve |
|--------|------|---------|
| `egaslemos` | `pi10p_production_pilot` | RESOLVED (unchanged) |
| `demo` | `pi10p_production_cohort_demo` | RESOLVED |

**ACTIVE TenantPlans = 2** (pilot + demo only).

## Non-cohort isolation

Former witness `demo` is now in cohort. New witness: `acc-mubsv40q` → **NO_ACTIVE_PLAN** (fail-closed DENY).

## Live Production health (unchanged)

```json
{
  "ok": true,
  "environmentHint": "production",
  "entitlementsEnabled": true,
  "databaseHost": "vitrine360-vercel-icfg-rd8hoku6p0oaszo88ixdwcu4.aws-us-east-1.turso.io",
  "r2BucketName": "vitrine360",
  "mediaStorageProvider": "r2"
}
```

## Device quota post-check (`demo`)

`assertDevicesMaxAllocation` → **ALLOW** / `FEATURE_ENABLED` (usage 5 / limit 10).

## Explicit non-actions

- No additional tenants beyond `demo`
- No Preview env / DB mutation
- No schema / RBAC / JWT / quota-semantics changes
- No R2 key remint
- No stress create / destructive ops
- No flag toggle / redeploy

## Rollback

1. Set Production `ENTITLEMENTS_ENABLED=false` (or remove) + redeploy → global OFF, **or**
2. Soft-deactivate `demo` TenantPlan only (status ≠ ACTIVE) to remove demo from cohort while keeping pilot.

Pilot TenantPlan may remain either way.

## Scripts / logs

- `scripts/probe-pi10p-cohort-identity.ts`
- `scripts/expand-pi10p-production-cohort.ts`
- `docs/evidence/platform-identity-10p/cohort-identity-probe.log`
- `docs/evidence/platform-identity-10p/production-cohort-expansion.log`
- `docs/evidence/platform-identity-10p/production-integrity-post-cohort.log`

## Findings

| Severity | Item |
|----------|------|
| MEDIUM | R2 account-scoped keys (residual, unchanged) |
| INFO | Former non-cohort witness `demo` now enrolled; witness moved to `acc-mubsv40q` |
