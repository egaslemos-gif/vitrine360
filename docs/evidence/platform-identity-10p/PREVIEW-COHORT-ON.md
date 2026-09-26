# PI-10P — Preview Cohort ON / Entitlements Activation

**Status:** PREVIEW ENTITLEMENTS ACTIVATION READY  
**Date:** 2026-09-25  
**Production:** `ENTITLEMENTS_ENABLED` = **UNSET / OFF** (unchanged)

## 1. Preview environment

| Field | Value |
|-------|--------|
| Project | `prj_fcQMbXzU4QF9VmhuTi9aRWMnX032` |
| DB | `vitrine360-preview` |
| Host | `libsql://vitrine360-preview-elemos.aws-us-west-2.turso.io` |
| Storage | R2 `vitrine360-preview` |
| ON deploy | `dpl_6E24HbQaEUbn2JzRu9RD182SxD8t` (`…j3tbhjt8u…`) — health `entitlementsEnabled=true` |
| OFF rollback deploy | `dpl_7U7ivaLBEW3U1tgcUYFdEeVpPz3N` (`…cgazxkwa2…`) — health `entitlementsEnabled=false` |
| Target | Preview only (`target=null`) |

## 2. Cohort (Preview DB only)

| Tenant | Plan | Notes |
|--------|------|-------|
| A | Full quantitative | `devices.enabled=true`, `devices.max=2`, `storage.maxBytes=1048576` (1 MB) |
| B | Different limits | `devices.max=5`, `storage.maxBytes=2 MB` |
| C | Compatibility only | `devices.enabled` only — fail-closed for quantitative ops |

Script: `npx tsx scripts/cohort-pi10p-preview-activation.ts` → **56/56 PASS**

## 3–4. Plans / controlled values

Existing entitlement keys only:

- `devices.enabled` BOOLEAN FEATURE_GATE  
- `devices.max` INTEGER HARD_LIMIT  
- `storage.maxBytes` BYTES HARD_LIMIT  

Tenant A used **devices.max=2**, **storage.maxBytes=1 MB** for deterministic tests.

## 5. Effective entitlements

Tenant A resolve: `RESOLVED` with correct `devices.enabled`, `devices.max=2`, `storage.maxBytes=1048576`.  
Authority: TenantPlan → Plan → PlanEntitlement → EntitlementDefinition (server-side).

## 6–8. Device / storage / concurrency

| Check | Result |
|-------|--------|
| Device 1–2 PASS, 3 DENY | PASS |
| PENDING unpaired no usage | PASS |
| OFFLINE counts / DISABLED frees | PASS |
| DISABLED→ACTIVE at max DENY | PASS |
| Device concurrency 1 SUCCESS / 1 DENY | PASS |
| Storage within / over limit | PASS |
| Reservation RESERVED→COMMIT/RELEASE | PASS |
| Expired lazy TTL RELEASED | PASS |
| Storage concurrency 1/1 | PASS |
| Dedup same checksum | PASS |

## 9–12. Isolation / fail-closed / gate / downgrade

| Check | Result |
|-------|--------|
| Cross-tenant quota/checksum | PASS |
| Tenant C missing max → DENY | PASS |
| No plan → DENY | PASS |
| `devices.enabled=false` DENY | PASS |
| Device downgrade BLOCK NEW + ALLOW EXISTING | PASS |
| Storage downgrade existing kept, new DENY | PASS |

## 13–14. Suspension / security

Suspended Tenant A: pair/upload/reserve DENY.  
Client cannot force flag ON; resolver server-side.

## 15. Rollback

Process + Vercel Preview env restored to `ENTITLEMENTS_ENABLED=false`.  
Live health on rollback deploy: `entitlementsEnabled=false`.  
Legacy pair/upload without plan PASS. Cohort resources preserved.

## 16. Production integrity

| Check | Result |
|-------|--------|
| Hosts distinct | PASS |
| Production `pi10p-%` tenants | **0** |
| Production env entitlements | UNSET |
| Production deployment | unchanged (`dpl_ApP66…`) |
| Migrations on Production | none |

## Limitations

1. Live Preview URL rotates per CLI/redeploy (no stable Preview alias).  
2. Accidental CLI project `vitrine360-pi10p-on` was created during a mis-linked deploy attempt — not used for gate evidence; real evidence uses project `vitrine360` Preview redeploys.  
3. Reservation expiry is **lazy** (on next reserve), default TTL 900s — no scheduler.  
4. R2 keys remain account-scoped; isolation by bucket name.

## Next gate

**PI-10P — PRODUCTION READINESS REVIEW**  
Do not activate Production entitlements.
