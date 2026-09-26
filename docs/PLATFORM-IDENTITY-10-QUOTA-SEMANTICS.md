# PLATFORM-IDENTITY-10 — Quota Semantics & Downgrade Decision Closure

**Status:** Decisions **CLOSED**. Unblocks PI-10G design.  
**Type:** Decision + documentation (+ minimal usage-mode alignment).  
**Does not implement:** quantitative enforcement, mutation wiring, grace timers, billing.

## Closed decisions

### 1. Device Count Semantics → **DECIDED**

**Canonical mode:** `PAIRED_NON_DISABLED`

| Include | Exclude |
|---------|---------|
| Devices with `tenant_id` set and `status` in {`ACTIVE`, `OFFLINE`, `PENDING` if paired} | `status = DISABLED` |
| | Rows with `tenant_id IS NULL` (unpaired TV bootstrap) |

**Formula (conceptual):**

```sql
COUNT(*) FROM devices
WHERE tenant_id = :tenantId
  AND tenant_id IS NOT NULL
  AND status != 'DISABLED'
```

**Rationale (repo evidence):**

- Pairing assigns `tenant_id` and typically `ACTIVE` (`pairDevice`).
- `DISABLED` is an intentional admin soft-out (`setDeviceStatus`) that clears tokens — it frees plan capacity without hard delete.
- `OFFLINE` is presence/runtime, not de-licensing — still occupies a screen slot.
- Counting `ACTIVE` only would under-count real inventory offline between heartbeats.
- Counting DISABLED would charge tenants for deliberately retired screens.

**Maps from prior options:** Option **B** (Non-DISABLED paired inventory). Options A/C/D rejected.

### 2. DEC-08 Downgrade Over-Quota → **DECIDED**

**Policy:** **BLOCK NEW + ALLOW EXISTING**

When EffectiveEntitlements HARD_LIMIT decreases and `usage > limit`:

| Action | Allowed? |
|--------|----------|
| Keep existing counted devices operating | **Yes** |
| Pair / create new device that would increase usage | **No** (DENY) |
| Reactivate DISABLED → non-DISABLED if that would push usage ≥ limit | **No** (treat as NEW allocation) |
| Update metadata / playlist assign on existing | **Yes** (no usage increase) |
| Delete device / set DISABLED | **Yes** (frees capacity) |
| Auto-disable excess devices | **No** (v1) |
| Auto-suspend tenant for overage alone | **No** |
| Timed grace period | **No** (v1) — deferred as future product enhancement, not required for PI-10G |

**Rationale:** Matches PI-10E architecture recommendation; avoids destructive surprise on plan change; fail-closed for growth; lifecycle SUSPEND remains separate (PI-09).

## Still OPEN (do not block device.max pilot)

| ID | Topic |
|----|--------|
| DEC-07 | Upload reservation |
| DEC-11 | Billing period TZ |
| DEC-14 | Historical retention |
| DEC-15 | Which limits are HARD vs SOFT by default (propose devices.max HARD for PI-10G) |

## PI-10G readiness

| Prerequisite | Status |
|--------------|--------|
| Device count semantics | **CLOSED** |
| DEC-08 downgrade | **CLOSED** |
| Usage foundation (PI-10F) | Done |
| Atomic TX boundary (PI-10E) | Documented |
| ENTITLEMENTS_ENABLED default OFF | Remains OFF until explicit activation |

**PI-10G may proceed** for `devices.max` pilot under these semantics, still flag-gated.

## Evidence

- `docs/adr/ADR-PLATFORM-IDENTITY-010-QUOTA-SEMANTICS.md`
- `docs/evidence/platform-identity-10-quota-semantics/`
- Updated `docs/evidence/platform-identity-10e/DECISIONS.md`
