# PI-10P — Production Entitlement Pilot Closure

**Date:** 2026-09-25  
**Verdict:** **PRODUCTION ENTITLEMENT PILOT = CLOSED**  
**Meaning:** Controlled Production activation + limited cohort validated — **not** general availability / mass rollout.

## 1. Objective

Validate quantitative Entitlements in Production through:

1. Controlled Production activation (pilot `egaslemos`)  
2. Controlled cohort expansion (`demo` via `admin@vitrine360.local`)  
3. Post-expansion audit = PASS  

Then formally close the pilot with an official entitlement matrix, usage snapshot, residual register, and documented rollback — without further cohort expansion.

## 2. Production Environment

| Field | Value |
|-------|--------|
| Deployment | `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6` (READY) |
| Alias | `https://vitrine360-psi.vercel.app` |
| Database | `vitrine360` / Production Turso host |
| Storage (R2) | `vitrine360` |
| Feature flag | `ENTITLEMENTS_ENABLED=true` |
| Schema journal | **9** (UNCHANGED) |

Final read-only check: `scripts/audit-pi10p-post-expansion.ts` → `post_expansion_audit_core=PASS`  
Log: `docs/evidence/platform-identity-10p/pilot-closure-final-state.log`

## 3. Cohort

| Tenant | Plan | devices.max | storage.maxBytes | Status |
|--------|------|-------------|------------------|--------|
| `egaslemos` | `pi10p_production_pilot` | 5 | 10 485 760 (10 MiB) | ACTIVE |
| `demo` | `pi10p_production_cohort_demo` | 10 | 104 857 600 (100 MiB) | ACTIVE |

**ACTIVE TenantPlans = 2** (exactly). No other `pi10p-%` plans.

### Final entitlement matrix

| Tenant | Plan | devices.enabled | devices.max | storage.maxBytes | Status |
|--------|------|-----------------|-------------|------------------|--------|
| `egaslemos` | `pi10p_production_pilot` | true | 5 | 10485760 | ACTIVE / RESOLVED |
| `demo` | `pi10p_production_cohort_demo` | true | 10 | 104857600 | ACTIVE / RESOLVED |
| `acc-mubsv40q` | — | — | — | — | NO_ACTIVE_PLAN |

## 4. Non-Cohort Witness

| Field | Value |
|-------|--------|
| Tenant | `acc-mubsv40q` |
| ACTIVE TenantPlans | 0 |
| Effective resolution | **NO_ACTIVE_PLAN** (×3 deterministic) |
| Allocation | **DENY** |
| Note | Retains 1 existing ACTIVE device (ALLOW EXISTING) |

## 5. Entitlement Resolution

| Property | Result |
|----------|--------|
| Deterministic (×3 identical) | PASS |
| Tenant scoped | PASS |
| Server authoritative | PASS |
| JWT/client authority | none |
| Evidence | closure final-state log + `POST-EXPANSION-AUDIT.md` §5 |

## 6. Quota Validation

| Concern | Result | Evidence |
|---------|--------|----------|
| Device quota | egaslemos 0/5 · demo 5/10 | final-state snapshot |
| Storage quota | egaslemos 90 B/10 MiB · demo ~45 MiB/100 MiB | final-state snapshot |
| Reservation model | global RESERVED=0; orphans=0 | final-state |
| Concurrency | PASS | PI-10J/K/O suites |
| Dedupe | PASS (checksum uidx intact) | PI-10L/K + DB index |
| Downgrade | BLOCK NEW + ALLOW EXISTING | PI-10K (`PI10K-DOWNGRADE`) |
| DISABLED frees capacity | PASS | PI-10K + count semantics |
| OFFLINE remains counted | PASS | PAIRED_NON_DISABLED |
| PENDING does not consume | PASS (`tenant_id=null`) | devices bootstrap + quota semantics |
| Failed uploads / reserved | no committed leak (reservations=0) | final-state |

### Final usage snapshot

| Tenant | devices usage | device limit | remaining devices | committed | reserved | storage limit | remaining storage |
|--------|---------------|--------------|-------------------|-----------|----------|---------------|-------------------|
| `egaslemos` | 0 | 5 | 5 | 90 | 0 | 10 485 760 | 10 485 670 |
| `demo` | 5 | 10 | 5 | 47 029 922 | 0 | 104 857 600 | 57 827 678 |
| `acc-mubsv40q` | 1 (no quota) | — | — | 70 | 0 | — | NO_ACTIVE_PLAN / DENY |

## 7. Security Validation

| Gate | Result | Evidence |
|------|--------|----------|
| Tenant isolation | PASS | PI-10B/O + post-expansion audit |
| Cross-tenant DENY | PASS | PI-10I/K/L/O |
| Device Bearer isolation | PASS | PI-04/05B/07 + device suites |
| Session isolation | PASS | PI-05B/06B/07/09 |
| Client bypass | PASS | PI-05B/06B/07/09/10D/O |
| Platform/tenant separation | PASS | PI-06B/07/09 |
| Server-side entitlement authority | PASS | resolve path + suites |

No destructive Production security tests in this closure phase.

## 8. Operational Validation

| Signal | Result |
|--------|--------|
| Production health | `ok=true`, `entitlementsEnabled=true`, Production DB/R2 |
| 5xx (post-expansion window) | none (cited in `POST-EXPANSION-AUDIT.md`) |
| Entitlement resolution failures | none unexpected |
| Quota anomalies | none |
| Reservation anomalies | none |
| Unexpected mutation this phase | **none** (read-only) |

## 9. Regression Validation

| Gate | Exit | Result |
|------|------|--------|
| `npm run typecheck` | 0 | PASS |
| `npm run lint` | 0 | PASS (0 errors) |
| `npm run build` | 0 | PASS |
| PI-10B / 10C / 10D / 10I / 10J / 10K / 10L / 10N / 10O | 0 each | PASS |
| PI-04 / 05B / 06B / 07 / 09 | 0 each | PASS |

Logs: `pilot-closure-typecheck.log`, `pilot-closure-lint.log`, `pilot-closure-build.log`, `pilot-closure-regressions.log`.

## 10. Known Residuals

| Severity | Finding | Status |
|----------|---------|--------|
| **MEDIUM** | R2 account-scoped keys / cross-write isolation not independently demonstrated | **ACCEPTED RESIDUAL** |
| INFO | CLI deploy empty git commit metadata | open |
| INFO | `acc-mubsv40q` retains one existing device under NO_ACTIVE_PLAN | expected |

The MEDIUM residual did **not** block: tenant isolation tests, storage quota enforcement, checksum isolation, reservation isolation, or this Production pilot.

No CRITICAL. No HIGH.

## 11. Rollback

**Documented — NOT executed in this phase.**

1. Set Production `ENTITLEMENTS_ENABLED=false` (or remove key).  
2. Redeploy Production if required by Vercel env handling.  
3. Verify `/api/health` → `entitlementsEnabled=false`.  
4. Existing resources remain intact.  
5. No migration required.  
6. No TenantPlan deletion required.  
7. No storage cleanup required.  
8. Re-run health/security checks.

Optional cohort-only remove: soft-deactivate `demo` TenantPlan while keeping pilot.

Implementation coherence: flag gates enforcement (`isEntitlementsEnabled`); resolution/plans may remain; resources untouched — validated across PI-10N/O/P.

## 12. Production Decision

**PRODUCTION ENTITLEMENT PILOT = CLOSED**

| Decision | Value |
|----------|--------|
| `ENTITLEMENTS_ENABLED` | remains **TRUE** |
| Current cohort | **`egaslemos`**, **`demo`** only |
| Further tenants | **not** enabled by this phase |
| General availability | **NOT** claimed |
| Future expansion | requires **new explicit authorization** |

### Related evidence

- `CONTROLLED-PRODUCTION-ACTIVATION.md`
- `CONTROLLED-COHORT-EXPANSION.md`
- `POST-EXPANSION-AUDIT.md`
- `PRODUCTION-COHORT-EXPANSION-REVIEW.md`

### ADR

See `docs/adr/ADR-PLATFORM-IDENTITY-010P.md` (Production Closure evidence pointer; architectural Preview decisions unchanged).
