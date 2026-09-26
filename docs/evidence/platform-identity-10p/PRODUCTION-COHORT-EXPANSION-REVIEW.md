# PI-10P — Production Cohort Expansion Review

**Date:** 2026-09-25 (re-run after HIGH typecheck/build remediação)  
**Mode:** Read-only  
**Verdict:** **READY FOR COHORT EXPANSION**  
**Cohort expanded this phase:** **no**

## 1. Scope

Re-execute the full Production cohort expansion review after:

- HIGH ops-script typecheck/build blocker → **RESOLVED** (`OPS-SCRIPT-TYPECHECK-BUILD-FIX.md`)

This phase **does not** expand the cohort, mutate Production data/schema, change the flag, or deploy.

Authorized pilot remains: `egaslemos` only.

## 2. Production Deployment

| Field | Value |
|-------|--------|
| Alias | `https://vitrine360-psi.vercel.app` |
| Deployment ID | `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6` |
| readyState | **READY** |
| target | production |
| source | cli (auth-fix after `/XD auth` staging bug) |
| Commit | **not attached** (CLI deploy; no gitSource meta) |
| ready timestamp | `1790346516069` (epoch ms) |
| Health | `ok=true`, `environmentHint=production` |
| `entitlementsEnabled` | **true** |
| `databaseHost` | Production Turso `vitrine360-vercel-…turso.io` |
| `r2BucketName` | **vitrine360** |
| Redeploy this phase | **none** |

## 3. Environment Isolation

| Env | Flag | DB host | R2 |
|-----|------|---------|-----|
| Production | **true** | Production Turso | `vitrine360` |
| Preview | **false** | Preview Turso | `vitrine360-preview` |

Hosts distinct. Integrity script: **PASS**.

## 4. Production Baseline

Compared to prior expansion review snapshot — **unchanged**:

| Metric | Value |
|--------|-------|
| Active TenantPlans | **1** |
| Catalog plans / defs / tenant_plans | 1 / 3 / 1 |
| pi10p-% tenants | **0** |
| Global / pilot reservations | **0** / **0** |
| Journal | **9** |
| Tables | **24** |

No unexpected mutation vs prior review.

## 5. Pilot Tenant

| Field | Value |
|-------|--------|
| slug | `egaslemos` |
| tenantId | `cafb0624-3391-4749-a6f9-f55cdc0d94d4` |
| status | ACTIVE |
| TenantPlan | ACTIVE `ade45831-94da-4eba-8c09-f24caf0fc609` |
| Plan | `pi10p_production_pilot` |
| `devices.enabled` | **true** |
| `devices.max` | **5** |
| `storage.maxBytes` | **10485760** |
| PAIRED_NON_DISABLED | **0** |
| contents / media_assets / playlists / schedules | 12 / 2 / 1 / 1 |
| committed / reserved | **90** / **0** |
| memberships | 4 |

## 6. Entitlement Resolution

Three consecutive `resolveEffectiveEntitlements(egaslemos)` reads:

identical → `[["devices.enabled",true],["devices.max",5],["storage.maxBytes",10485760]]`

| Check | Result |
|-------|--------|
| Deterministic | **PASS** |
| Server-side | **PASS** |
| Tenant-scoped | **PASS** |
| JWT / client authority | **none** (10C/10D + code) |

## 7. Device Quota

| Field | Value |
|-------|--------|
| usage (PAIRED_NON_DISABLED) | 0 |
| limit | 5 |
| headroom | 5 |
| class | **HEALTHY HEADROOM** |
| anomalies | none |

## 8. Storage Quota

| Field | Value |
|-------|--------|
| committed + RESERVED | 90 + 0 |
| limit | 10485760 |
| headroom | 10485670 |
| class | **HEALTHY HEADROOM** |
| reservation anomalies | **none** (0 rows) |

## 9. Non-Cohort Isolation

| Check | `demo` |
|-------|--------|
| TenantPlans | **0** |
| Resolve | **NO_ACTIVE_PLAN** |
| Gate | **DENY / NO_ACTIVE_PLAN** |
| Inherited pilot plan | **no** |

## 10. Cross-Tenant Security

| Check | Result |
|-------|--------|
| Usage APIs tenant_id scoped | PASS |
| Active plans only pilot | PASS |
| Suites 04 / 05B / 07 / 10* | PASS |
| Device Bearer ≠ entitlement source | PASS (10D) |
| Client cannot set entitlement | PASS (10D) |

## 11. Allocation Paths

Code + suite evidence (no Production stress create):

| Path | Gate |
|------|------|
| `pairDevice` | `assertDevicesEnabled` + `assertDevicesMaxAllocation` |
| DISABLED→ACTIVE | same |
| upload / prepare / complete | storage quota + reservation (10J/10L/10O) |
| concurrency | suite evidence (10I/10J/10K/10O) |

No Production allocation mutations this phase.

## 12. Non-Allocating Paths

| Path | Consumes quota? |
|------|-----------------|
| startPairing / PENDING | **no** |
| heartbeat / sync / manifest | **no** (API routes ungated) |
| playback | **no** |
| disable / delete | free capacity on DISABLED (10K/10O) |
| OFFLINE | still counts if PAIRED_NON_DISABLED |

Pilot has **0** devices → live runtime sample N/A; code evidence PASS.

## 13. Observability

| Signal (24h) | Result |
|--------------|--------|
| Runtime error clusters | **none** |
| Status mix | 200×233, 404×13, 307×6, 304×3 |
| 404 paths | fonts + historical `/api/auth/google` (remediated) + health probe noise |
| 5xx | **none** |
| Entitlement resolution errors | **none** |
| Quota / reservation anomalies | **none** |

EXPECTED: remediated auth 404s, missing font assets.  
UNEXPECTED: none.

Latency SLOs: not instrumented → INFO only (not a new security/isolation MEDIUM).

## 14. Rollback Readiness

Not executed. Documented path remains:

1. Production `ENTITLEMENTS_ENABLED=false`  
2. Redeploy  
3. Confirm health `entitlementsEnabled=false`

| Check | Result |
|-------|--------|
| No migration required | **yes** |
| No data cleanup required | **yes** |
| Resources remain valid | **yes** |
| Flag OFF → FLAG_OFF ALLOW | **yes** (code) |
| Flag changed this phase | **no** |

## 15. Regression Tests

| Suite | Exit |
|-------|------|
| 10B / 10C / 10D | **0** |
| 10I / 10J / 10K / 10L | **0** |
| 10N / 10O | **0** |
| 04 / 05B / 06B / 07 / 09 | **0** |
| `npm run typecheck` | **0** |
| `npm run lint` | **0** (0 errors / 92 warnings) |
| `npm run build` | **0** |

## 16. Production Integrity

Post-suite recheck:

| Check | Result |
|-------|--------|
| Active TenantPlans | **1** (`egaslemos` / `pi10p_production_pilot`) |
| demo plans | **0** |
| Reservations | **0** |
| Schema journal | **9** |
| Unexpected resources | **none** |
| Health still ON + Production DB/R2 | **PASS** |
| Unexpected mutations | **none** |

## 17. Findings

| Severity | Finding | Status | Evidence |
|----------|---------|--------|----------|
| MEDIUM | R2 account-scoped keys; cross-write not independently demonstrated | ACCEPTED residual | prior readiness + health buckets distinct |
| INFO | CLI deploy has no git commit meta | open | Vercel deployment meta empty |
| INFO | Pilot has 0 devices — no live heartbeat sample | N/A | review script |
| INFO | Transient auth 404s during prior staging bug | remediated | runtime 404 paths |
| ~~HIGH~~ | Ops script typecheck/build | **RESOLVED** | `OPS-SCRIPT-TYPECHECK-BUILD-FIX.md` |

No new HIGH/CRITICAL. No new MEDIUM compromising isolation/quota/integrity/rollback.

## 18. Release Gate

**READY FOR COHORT EXPANSION**

Criteria met: health ON, pilot integrity, deterministic resolution, quota integrity, non-cohort + cross-tenant isolation, rollback documented, observability without unexpected errors, schema/data unchanged, typecheck/lint/build/regressions PASS, prior HIGH cleared.

## 19. Next Step

**NEXT STEP:**  
**PI-10P — CONTROLLED COHORT EXPANSION**

Requires explicit authorization.  
**Do not execute in this phase.** Do not add tenants.
