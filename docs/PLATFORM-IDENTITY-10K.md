# PLATFORM-IDENTITY-10K — Quota & Entitlement Cross-System Audit

**Status:** VALIDATED  
**Phase type:** AUDIT + HARDENING (no Billing / Subscription / Payments / Stripe)  
**Flag:** `ENTITLEMENTS_ENABLED` remains **OFF** by default (not flipped in production by this phase)

## 1. Executive Summary

Cross-system audit of PI-10B→PI-10J confirms the chain

**Entitlement → Effective Entitlement → Usage → Quota Evaluation → Atomic Enforcement → Mutation → Observability**

is coherent for `devices.max` and `storage.maxBytes`, tenant-safe, fail-closed when the flag is ON, and concurrency-resistant under `withTenantAllocationLock` + drizzle `BEGIN IMMEDIATE`.

Hardening applied only where the audit found real integrity gaps (heal-path quota bypass, prepare reservation TTL sticky quota, suspended-tenant service-layer allocation, activity-log masking successful pair).

## 2. Current Architecture

```
EntitlementDefinition + Plan + PlanEntitlement + TenantPlan
        ↓ resolveEffectiveEntitlements (central)
Effective entitlements
        ↓ evaluateQuota / assertDevicesMaxAllocation / reserveStorageForUpload
Usage (PAIRED_NON_DISABLED | committed+reserved)
        ↓ withTenantAllocationLock + db.transaction
Mutation (pair / reactivate / reserve / MediaAsset)
        ↓ Activity Log (observability only)
```

## 3. Entitlement Matrix

| Key | Type | Enforcement | Usage | Mutation | Status |
|-----|------|-------------|-------|----------|--------|
| devices.enabled | BOOLEAN | FEATURE_GATE | n/a | pair/reactivate gate | PI-10D |
| devices.max | INTEGER | HARD_LIMIT | PAIRED_NON_DISABLED | allocation boundary | PI-10G |
| storage.maxBytes | BYTES | HARD_LIMIT | committed + reserved | reservation boundary | PI-10J |

No new entitlements invented in PI-10K.

## 4. Usage Authority Matrix

| Metric | Authority | Not authority |
|--------|-----------|---------------|
| Device count | `tenant_id IS NOT NULL AND status != DISABLED` | heartbeat, JWT, Activity |
| Storage committed | `SUM(media_assets.file_size)` | R2 inventory, Activity |
| Storage reserved | `SUM(storage_reservations.expected_bytes WHERE status=RESERVED)` | client counters |
| Effective storage | committed + reserved | — |

## 5. Enforcement Matrix

| Path | Enforces | Boundary |
|------|----------|----------|
| pairDevice | devices.enabled + devices.max + tenant operable | allocation lock |
| setDeviceStatus DISABLED→ACTIVE | same | allocation lock |
| uploadMediaAsset / prepare / complete | storage.maxBytes (+ operable) | reserve before put |
| heal stale MediaAsset | delta reserve when growth | media.heal operationId |
| heartbeat / sync / playback | none (no allocation) | — |

## 6. Transaction Matrix

| Operation | Lock | TX |
|-----------|------|-----|
| Device allocate | withTenantAllocationLock | drizzle transaction |
| Storage reserve/release/commit | withTenantAllocationLock | drizzle transaction |
| Bare `client.execute(BEGIN/COMMIT)` | **absent** in src | — |

## 7. Concurrency Results

| Scenario | Expected | Result |
|----------|----------|--------|
| devices.max=1, 2 parallel pairs | 1 success, 1 deny, usage=1 | PASS |
| storage max=100MB, committed=80MB, 2×15MB reserve | 1 success, 1 deny, reserved=15MB | PASS |
| same tenant same checksum parallel upload | 1 MediaAsset | PASS |
| cross-tenant same operationId | independent | PASS |

## 8. Security Matrix

| ID | Result |
|----|--------|
| PI10K-SEC-001 … 014 | PASS (see evidence/TEST-RESULTS.md) |

## 9. Fail-Closed Matrix

| Condition | Expected | Result |
|-----------|----------|--------|
| no tenant | DENY | PASS |
| tenant suspended | DENY (service + session) | PASS |
| no active plan (flag ON) | DENY | PASS |
| quota exceeded | DENY | PASS |
| reservation wrong tenant | DENY | PASS |
| actual > reserved | DENY | PASS |
| flag OFF | legacy ALLOW | PASS |

## 10. Lifecycle Matrix

| Status | Allocation / upload |
|--------|---------------------|
| ACTIVE | normal |
| SUSPENDED | blocked at `assertTenantOperable` on pair/reactivate/upload/prepare/complete/reserve |

Existing resources and usage preserved (no auto-delete / auto-disable).

## 11. Deduplication Audit

`UNIQUE(tenant_id, checksum)` in schema + migration 0008 + ensureSchema. Intra-tenant reuse → one asset; cross-tenant → independent. Race → UNIQUE handling + idempotent return.

## 12. Reservation Audit

Transitions: RESERVED→COMMITTED|RELEASED|EXPIRED. Lazy overdue RELEASE on next `reserveStorage` (not a TTL worker — DEC-STORAGE-08 remains OPEN). Prepare sets `expiresAt` ≈ signed URL TTL (900s).

## 13. Migration Audit

| Artifact | Status |
|----------|--------|
| drizzle schema entitlements / reservations / media_assets | OK |
| 0008 storage_reservations + checksum unique | OK |
| ensureSchema catch on duplicate-blocking unique index | residual MEDIUM (ops) |

## 14. Findings

| ID | Severity | Area | Finding | Status |
|----|----------|------|---------|--------|
| F1 | HIGH | storage heal | buffer heal `storage.put` without reserve | **FIXED** |
| F2 | HIGH | storage heal | complete heal could grow file_size without reserve | **FIXED** |
| F3 | HIGH | reservation | prepare `expiresAt=null` sticky RESERVED | **FIXED** (TTL on prepare + lazy release) |
| F4 | MEDIUM | schema | ensureSchema swallows unique index failure | OPEN (ops/TD) |
| F5 | MEDIUM | direct upload | signed PUT without ContentLength condition | OPEN (residual) |
| F6 | LOW | soft limit | SOFT_LIMIT skips hard reserve | DOC (by design) |
| F7 | HIGH | lifecycle | service allocate without operable check | **FIXED** |
| F8 | MEDIUM | observability | activity log failure after pair masked success | **FIXED** |

## 15. Corrections

1. Heal paths reserve growth (`media.heal:*`) before put/update.
2. Prepare reservations get 900s `expiresAt`; overdue RESERVED lazily RELEASED on next reserve.
3. `assertTenantOperable` on pair, reactivate, upload, prepare, complete, `reserveStorageForUpload`.
4. `pairDevice` activity log failure no longer fails allocation after commit.
5. Map reservation CONFLICT → EntitlementDeniedError in storage-quota layer.

## 16. Residual Risks

- Direct-upload oversized PUT until complete rejects (cost/orphan risk) — DEC/follow-up.
- ensureSchema unique index may be missing if historical duplicates exist.
- DEC-STORAGE-07 replacement and DEC-STORAGE-08 TTL worker remain OPEN.
- Multi-process SQLITE_BUSY under local file DB (environment).

## 17. Test Evidence

`docs/evidence/platform-identity-10k/` · `scripts/test-platform-identity-10k.ts`

## 18. Release Gate

See checklist in `docs/evidence/platform-identity-10k/CHECKLIST.md`.

**Next phase:** only after this audit is accepted — do **not** start Billing.
