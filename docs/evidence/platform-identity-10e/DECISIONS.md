# DECISIONS — PI-10E

| ID | Decision | State | Notes |
|----|----------|-------|-------|
| DEC-01 | Usage derived vs materialized vs hybrid | **DECIDED** | Hybrid: derive current RESOURCE/STORAGE; events for temporal |
| DEC-02 | Source of truth | **DECIDED** | Resource tables (devices, media_assets, …) for current; events for period metrics |
| DEC-03 | RESOURCE_COUNT quotas | **DECIDED** | Start with devices; contents/playlists optional later |
| DEC-04 | STORAGE quotas | **DECIDED** | Logical `SUM(file_size)` per tenant media_assets |
| DEC-05 | Temporal cumulative | **DECIDED** | Future bandwidth/uploads via period aggregates; not for devices.max |
| DEC-06 | Race avoidance | **DECIDED** | Single DB transaction check+write (BEGIN IMMEDIATE) |
| DEC-07 | Reservation | **OPEN** | Needed for prepare→complete upload if charging before complete; else charge only on complete |
| DEC-08 | Downgrade overage | **DECIDED** | BLOCK NEW + ALLOW EXISTING; reactivate DISABLED = NEW; no auto-disable / grace / tenant-suspend for overage in v1. See `PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.md` |
| DEC-09 | Deletion effect on Usage | **DECIDED** | Hard delete / unlink decreases current count/bytes after commit |
| DEC-10 | Reconciliation | **DECIDED** | If counters exist, reconcile vs COUNT/SUM; tables win |
| DEC-11 | Period timezone | **OPEN** | Default UTC; confirm if Billing needs tenant TZ |
| DEC-12 | Usage when SUSPENDED | **DECIDED** | Continue counting stored resources; access already blocked by lifecycle |
| DEC-13 | Usage vs Billing | **DECIDED** | Billing → TenantPlan only; never payment→permission shortcut |
| DEC-14 | Historical retention | **OPEN** | Suggest ≥13 months events; confirm compliance/cost |
| DEC-15 | HARD vs SOFT defaults | **OPEN** | Propose devices.max & storage.maxBytes HARD; bandwidth SOFT until product says |

## Device count semantics — **DECIDED**

**Canonical:** `PAIRED_NON_DISABLED`  
`tenant_id IS NOT NULL AND status != 'DISABLED'`

| Option | Verdict |
|--------|---------|
| A All rows with tenant_id | Rejected (includes DISABLED) |
| **B Non-DISABLED paired** | **Accepted** |
| C ACTIVE only | Rejected (under-counts OFFLINE) |
| D Operable only | Rejected (ambiguous vs presence) |

PENDING without tenant never counts. Closed in `docs/PLATFORM-IDENTITY-10-QUOTA-SEMANTICS.md`.
