# PI-10K Concurrency Results

| Test | Expected | Observed |
|------|----------|----------|
| Device max=1, 2 parallel pairs | 1 ok, 1 deny, usage=1 | PASS |
| Storage max=100MB, committed=80MB, 2×15MB | 1 ok, 1 deny, reserved=15MB | PASS |
| Same checksum parallel upload | 1 MediaAsset | PASS |
| Cross-tenant same operationId | independent rows | PASS |

See `TEST-RESULTS.md` for assertion log.
