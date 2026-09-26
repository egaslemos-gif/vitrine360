# CONCURRENCY-RESULTS — PI-10G

## Test 1 — max=1, two concurrent pairs

| attempts | successes | denials | final usage |
|---:|---:|---:|---:|
| 2 | 1 | 1 | 1 |

## Test 2 — max=10, usage=9, 10 concurrent pairs

| attempts | successes | denials | final usage |
|---:|---:|---:|---:|
| 10 | 1 | 9 | 10 |

Strategy: per-tenant async mutex + SQLite `BEGIN IMMEDIATE`.
