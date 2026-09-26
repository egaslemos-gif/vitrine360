# CONCURRENCY-RESULTS — PI-10I

## TEST A — max=100MB, committed=80MB, two concurrent 15MB

| attempts | successes | denials | reserved after |
|---:|---:|---:|---:|
| 2 | 1 | 1 | 15728640 |

## TEST B — reserved 20MB then 1MB

Second reservation QUOTA_EXCEEDED.

Strategy: `withTenantAllocationLock` + drizzle `db.transaction` (BEGIN IMMEDIATE).
