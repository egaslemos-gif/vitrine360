# RUNTIME-PLAYBACK-07 — Security Evidence

| Control | Result |
|---------|--------|
| No Bearer/JWT/R2/tenant secret in Command | PASS (SEC-001…004) |
| Cross-tenant deny | PASS |
| Unknown / invalid / expired deny | PASS |
| Stale session deny | PASS |
| Star device (`*`) deny | PASS |
| Viewer role without manage_devices | DENY |
| ONLINE ≠ commandable | Documented; presence not used for admission |
| No production command API routes | PASS (MAP-008) |
| Safe error codes only | PASS |
| Fail closed | PASS |
| Dispatcher no HTMLMediaElement imports | PASS (FAIL-004) |
| Idempotency store not durable | Documented INFO |

Clock: domain uses issuer environment clock; client time is not security authority until server transport re-validates.
