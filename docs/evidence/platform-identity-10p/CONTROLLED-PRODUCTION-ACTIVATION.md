# PI-10P — Controlled Production Activation

**Date:** 2026-09-25  
**Verdict:** **PRODUCTION CONTROLLED ACTIVATION READY**  
**Authorized pilot:** `egaslemos` only  
**Cohort expansion:** **none**

## Absolute safety (PASS)

| Check | Result |
|-------|--------|
| Production DB / host | `vitrine360` / `vitrine360-vercel-icfg-…turso.io` |
| Preview DB / host | `vitrine360-preview` / distinct |
| Production R2 bucket | `vitrine360` (not preview) |
| Preview flag | still **false** (unchanged) |
| Schema migrations this phase | **none** |
| ACTIVE TenantPlans | **1** (pilot only) |

## Pilot authorization

`Authorize pilot tenant: egaslemos`

| Field | Value |
|-------|--------|
| slug | `egaslemos` |
| status | ACTIVE |
| paired_non_disabled | 0 |
| committed_bytes | 90 |
| reserved_bytes | 0 |
| plan | `pi10p_production_pilot` |
| `devices.enabled` | true |
| `devices.max` | 5 |
| `storage.maxBytes` | 10485760 (10 MiB) |

Non-cohort witness: `demo` — **0** TenantPlans.

## Sequence executed

| Phase | Result |
|-------|--------|
| FASE 1 Safety + baseline | PASS (prior) |
| FASE 2 Pilot auth | PASS (`egaslemos`) |
| FASE 3 Seed defs/plan/TenantPlan (flag OFF) | PASS — `scripts/activate-pi10p-production-pilot.ts` |
| FASE 4 OFF smoke (DB + FLAG_OFF) | PASS — `scripts/smoke-pi10p-production-off.ts` |
| FASE 5 Deploy entitlements code (flag UNSET) | PASS — `dpl_CezALPtRdqimJNaZuoGmXWEkMJv7` |
| Live OFF health | PASS — `entitlementsEnabled=false`, Production DB host |
| FASE 6 Set Production `ENTITLEMENTS_ENABLED=true` | PASS — env id `QVlubQ8jU4Ypjtgt` |
| FASE 7 Redeploy ON | PASS — `dpl_Amo25Sy1eRXspPUYxFirH4DGRaqo` → `vitrine360-psi.vercel.app` |
| FASE 8 Post-ON validate | PASS — `scripts/validate-pi10p-production-on.ts` |
| Integrity | PASS — `scripts/integrity-pi10p-production.ts` |

## Live Production health (post-ON)

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

## Post-ON enforcement

| Subject | Resolve | `devices.enabled` | `devices.max` |
|---------|---------|-------------------|---------------|
| Pilot `egaslemos` | RESOLVED | ALLOW / FEATURE_ENABLED | ALLOW |
| Witness `demo` | NO_ACTIVE_PLAN | DENY / NO_ACTIVE_PLAN | DENY / NO_ACTIVE_PLAN |

Catalog: defs=3, plans=1, bindings=3, tenant_plans=1.

## Deployments

| Role | ID | Alias |
|------|----|-------|
| Pre-activation (legacy) | `dpl_ApP66evgkpos6VhKkUjHh2wctwwW` | superseded |
| OFF entitlements code | `dpl_CezALPtRdqimJNaZuoGmXWEkMJv7` | intermediate |
| ON (flag activation) | `dpl_Amo25Sy1eRXspPUYxFirH4DGRaqo` | intermediate |
| ON auth-fix (current) | `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6` | `https://vitrine360-psi.vercel.app` |

## Hotfix — missing `/api/auth/*` (2026-09-25)

**Cause:** OFF/ON staging used robocopy `/XD auth`, which also excluded `src/app/api/auth` (not only root sqlite `auth` files).

**Fix:** Redeploy without directory exclude of `auth`; remove only root `auth` / `auth-wal` artifacts after copy. Build now lists `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/login`.

## Rollback

1. Set Production `ENTITLEMENTS_ENABLED=false` (or remove key).  
2. Redeploy Production (same code OK).  
3. Confirm `/api/health` → `entitlementsEnabled=false`.  
4. Pilot TenantPlan may remain; enforcement is flag-gated.

No migration rollback required.

## Explicit non-actions

- No additional tenants assigned  
- No Preview env mutation  
- No schema / RBAC / JWT / quota-semantics changes  
- No R2 key remint (MEDIUM residual unchanged)

## Findings

| Severity | Item |
|----------|------|
| MEDIUM | R2 account-scoped keys (residual, unchanged) |
| INFO | Production now has entitlements code + health probe |

## Logs

- `docs/evidence/platform-identity-10p/production-pilot-setup.log`
- `docs/evidence/platform-identity-10p/production-off-smoke.log`
- `docs/evidence/platform-identity-10p/production-off-deploy.log`
- `docs/evidence/platform-identity-10p/production-on-validation.log`
- `docs/evidence/platform-identity-10p/production-integrity-post-activation.log`

## Scripts

- `scripts/activate-pi10p-production-pilot.ts`
- `scripts/smoke-pi10p-production-off.ts`
- `scripts/validate-pi10p-production-on.ts`
