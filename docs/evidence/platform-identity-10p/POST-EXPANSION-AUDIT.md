# PI-10P — Production Post-Expansion Audit

**Date:** 2026-09-25  
**Mode:** READ-ONLY (no cohort change, no flag toggle, no deploy, no schema mutation)  
**Verdict:** **POST-EXPANSION AUDIT PASS**  
**Prior evidence:** `CONTROLLED-COHORT-EXPANSION.md`

## 1. Scope

Audit Production integrity after controlled enrollment of tenant `demo` into the entitlements cohort alongside pilot `egaslemos`. This phase does **not** expand further.

Hard safety: no TenantPlan create/alter/remove, no limit changes, no `ENTITLEMENTS_ENABLED` change, no deploy, no migrations, no R2 mutation, no resource delete/cleanup, no rollback execution.

## 2. Production Deployment

| Field | Value |
|-------|--------|
| Deployment ID | `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6` |
| readyState | **READY** |
| target | production |
| Alias | `vitrine360-psi.vercel.app` (+ project alias) |
| URL | `vitrine360-2sgrwjkp6-egaslemos-5751s-projects.vercel.app` |
| createdAt | 2026-09-25 14:27:30Z |
| ready | 2026-09-25 14:28:36Z |
| source | CLI |
| commit meta | empty (CLI deploy — known INFO) |
| Deploy during this audit | **none** |

Live `/api/health`:

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

## 3. Cohort State

| Tenant | Role | Plan | Resolve |
|--------|------|------|---------|
| `egaslemos` | pilot | `pi10p_production_pilot` | RESOLVED |
| `demo` | cohort (auth `admin@vitrine360.local`) | `pi10p_production_cohort_demo` | RESOLVED |
| `acc-mubsv40q` | non-cohort witness | — | NO_ACTIVE_PLAN |

**ACTIVE TenantPlans = 2** (exactly expected).

## 4. TenantPlan Integrity

| TenantPlan id | Tenant | Plan | Status |
|---------------|--------|------|--------|
| `ade45831-…` | `egaslemos` (`cafb0624-…`) | `pi10p_production_pilot` (`66b6a870-…`) | ACTIVE |
| `ed34579a-…` | `demo` (`efc35203-…`) | `pi10p_production_cohort_demo` (`c2c7ce9c-…`) | ACTIVE |

Confirmed:

- no third ACTIVE TenantPlan
- no duplicate ACTIVE per tenant
- witness `acc-mubsv40q` ACTIVE plans = **0**
- `pi10p-%` plans = exactly **2** (pilot + cohort_demo)
- plan_entitlements = **6** (3 per plan); entitlement_definitions = **3**

## 5. Effective Entitlements

Server-side `resolveEffectiveEntitlements` ×3 each:

| Tenant | ×3 statuses | Values |
|--------|-------------|--------|
| `egaslemos` | RESOLVED,RESOLVED,RESOLVED | `devices.enabled=true`, `devices.max=5`, `storage.maxBytes=10485760` |
| `demo` | RESOLVED,RESOLVED,RESOLVED | `devices.enabled=true`, `devices.max=10`, `storage.maxBytes=104857600` |
| `acc-mubsv40q` | NO_ACTIVE_PLAN ×3 | no entitlement grant |

Determinism: **PASS**. Tenant-scoped / server-authoritative: **PASS** (no JWT/client entitlement derivation in resolution path).

## 6. Device Quota

Canonical mode: **PAIRED_NON_DISABLED** (`tenant_id IS NOT NULL AND status != DISABLED`). PENDING bootstrap uses `tenant_id=null` → does not count.

| Tenant | ACTIVE | OFFLINE | DISABLED | Canonical usage | Limit | Headroom |
|--------|--------|---------|----------|-----------------|-------|----------|
| `egaslemos` | 0 | 0 | 0 | **0** | 5 | OK |
| `demo` | 5 | 0 | 0 | **5** | 10 | OK |
| `acc-mubsv40q` | 1 | 0 | 0 | 1 (no quota) | — | NO_ACTIVE_PLAN |

Allocation probe (`assertDevicesMaxAllocation`):

- `egaslemos` → ALLOW / FEATURE_ENABLED  
- `demo` → ALLOW / FEATURE_ENABLED  
- `acc-mubsv40q` → **DENY** (`EntitlementDeniedError`)

## 7. Storage Quota

| Tenant | committed | reserved | effective | Limit |
|--------|-----------|----------|-----------|-------|
| `egaslemos` | 90 | 0 | 90 | 10 MiB |
| `demo` | 47 029 922 (~44.9 MiB) | 0 | 47 029 922 | 100 MiB |
| `acc-mubsv40q` | 70 | 0 | 70 | none (NO_ACTIVE_PLAN) |

No negative committed bytes. Checksum unique index present: `media_assets_tenant_checksum_uidx` on `(tenant_id, checksum)`. No within-tenant checksum duplicates.

## 8. Reservation Integrity

| Check | Result |
|-------|--------|
| Global `storage_reservations` rows | **0** |
| Orphan tenant reservations | **0** |
| Duplicate `operation_id` | **none** |
| Expired still RESERVED | **0** |

No reservation anomalies. No cleanup performed.

## 9. Non-Cohort Witness

`acc-mubsv40q`:

- ACTIVE TenantPlans = 0  
- Effective = NO_ACTIVE_PLAN (deterministic ×3)  
- Device allocation = DENY  
- Flag ON did **not** auto-grant `devices.enabled` / `devices.max` / `storage.maxBytes`

Existing device (1 ACTIVE) remains (BLOCK NEW + ALLOW EXISTING; no deletion).

## 10. Cross-Tenant Security

Existing suites (PI-10I/K/L/O) cover:

- cross-tenant `operationId` independence  
- checksum isolation  
- quota/asset isolation  

Production probe: each tenant’s resolve/usage scoped to own `tenant_id`; witness cannot obtain cohort entitlements. **CROSS-TENANT = DENY** (suite + inspection).

## 11. Client Bypass

Regression suites (PI-05B/06B/07/09 + PI-10D/O) reconfirm server derives tenant from session/membership, not client-supplied plan/limit/entitlement payloads. No Production browser mutation performed.

## 12. Allocation Paths

Code inspection + PI-10K/J/O suites:

| Path | Guard |
|------|-------|
| `pairDevice` | AUTH → tenant operable → `assertDevicesEnabled` + `assertDevicesMaxAllocation` inside allocation lock |
| DISABLED→ACTIVE | same max allocation guard |
| `reserveStorageForUpload` / prepare/complete/heal | storage-quota reservation under flag |

Expected chain: AUTH → TENANT OPERABLE → EFFECTIVE ENTITLEMENTS → QUOTA → ATOMIC ALLOCATION → MUTATION. No Production pair/upload executed.

## 13. Non-Allocating Paths

| Path | Consumes quota? |
|------|-----------------|
| PENDING pairing bootstrap (`tenantId=null`) | **No** |
| heartbeat / sync / manifest | **No** (ungated) |
| disable | frees count (DISABLED excluded) |
| OFFLINE + PAIRED | still counts (does not free) |

## 14. R2 Integrity

| Check | Result |
|-------|--------|
| Production bucket | `vitrine360` (health) |
| Expansion-created objects | none expected / none observed via DB reservation path |
| Known residual | MEDIUM — account-scoped keys; cross-write not independently demonstrated |

No new R2 anomaly evidence. Residual unchanged (not escalated).

## 15. Observability

Window ~6h / 24h post-expansion:

| Signal | Result |
|--------|--------|
| Runtime error clusters (24h) | **none** |
| HTTP 5xx (6h) | **none** |
| Status codes (6h) | 200×193, 404×10, 307×4, 304×3 |
| Entitlement/quota query hits | empty (no unexpected clusters) |

404s treated as expected client misses / legacy paths — not entitlement corruption. No unexpected auth failure spike.

## 16. Regression Tests

| Gate | Exit | Result |
|------|------|--------|
| `npm run typecheck` | 0 | **PASS** |
| `npm run lint` | 0 | **PASS** (0 errors / 95 warnings) |
| `npm run build` | 0 | **PASS** |
| `test:platform-identity-10b` | 0 | PASS |
| `test:platform-identity-10c` | 0 | PASS |
| `test:platform-identity-10d` | 0 | PASS |
| `test:platform-identity-10i` | 0 | PASS |
| `test:platform-identity-10j` | 0 | PASS |
| `test:platform-identity-10k` | 0 | PASS (includes BLOCK NEW + ALLOW EXISTING / DISABLED→ACTIVE) |
| `test:platform-identity-10l` | 0 | PASS |
| `test:platform-identity-10n` | 0 | PASS |
| `test:platform-identity-10o` | 0 | PASS |
| `test:platform-identity-04` | 0 | PASS |
| `test:platform-identity-05b` | 0 | PASS |
| `test:platform-identity-06b` | 0 | PASS |
| `test:platform-identity-07` | 0 | PASS |
| `test:platform-identity-09` | 0 | PASS |

Logs: `post-expansion-typecheck.log`, `post-expansion-lint.log`, `post-expansion-build.log`, `post-expansion-regressions.log` (terminal summary), `post-expansion-audit-core.log`, `post-expansion-integrity.log`.

## 17. Production Data Integrity

Compared to post-expansion baseline (`CONTROLLED-COHORT-EXPANSION.md` + expansion log):

| Artifact | Expected delta from pre-expansion | Observed now |
|----------|-----------------------------------|--------------|
| Schema journal | unchanged **9** | **9** |
| ACTIVE TenantPlans | 1 → **2** (`demo` added) | **2** |
| `pi10p` plans | +1 cohort_demo | **2** |
| demo devices / storage | unchanged | 5 / 47 029 922 |
| egaslemos usage | unchanged | 0 devices / 90 B |
| storage_reservations | 0 | **0** |
| Unexpected tenants/plans/migrations | none | **none** |

Inventory snapshot: tenants=20, devices=76, contents=55, media_assets=27, playlists=17, schedules=5, storage_reservations=0, tenant_plans=2, plans=2, plan_entitlements=6, entitlement_definitions=3.

Integrity script: **PASS** (`hosts_distinct`, journal=9, no Production PI-10P test tenants).

Audit-phase mutations: **none** (read-only probes only).

## 18. Rollback Readiness

Documented / code-confirmed (not executed):

1. Set Production `ENTITLEMENTS_ENABLED=false` (+ redeploy) → global OFF.  
2. Optional: soft-deactivate `demo` TenantPlan only.

Requires: **no** migration, **no** TenantPlan delete, **no** resource delete. Schema remains compatible; existing resources stay intact. Flag left **true**.

## 19. Findings

| Severity | Finding | Status | Evidence |
|----------|---------|--------|----------|
| MEDIUM | R2 account-scoped keys; cross-write not independently demonstrated | ACCEPTED residual | health bucket + prior readiness |
| INFO | CLI deploy has empty git commit meta | open | Vercel deployment meta |
| INFO | Witness retains 1 ACTIVE device under NO_ACTIVE_PLAN | expected ALLOW EXISTING | device breakdown |

No CRITICAL. No HIGH. No unexpected Production mutation.

## 20. Release Gate

**POST-EXPANSION AUDIT PASS**

All PASS criteria met: healthy Production, schema unchanged, exactly 2 ACTIVE cohort TenantPlans with correct bindings, witness NO_ACTIVE_PLAN, deterministic entitlements, isolation/client-bypass/quota/reservation/storage integrity, R2 residual unchanged, observability clean, rollback ready, typecheck/lint/build/regressions PASS, no CRITICAL/HIGH.

## 21. Next Step

**NEXT STEP:**  
**PI-10P — CLOSE PRODUCTION ENTITLEMENT PILOT**

Do **not** execute in this phase.
