# SCHED-02B E2E Evidence

**Date:** 2026-09-22  
**Command:** `npm run test:sched-mgmt`  
**Result:** PASS Phase SCHED-MGMT  

## Flow proven (service + Sync delta)

```text
DEFAULT playlist
  → create Schedule (DEVICE target) + bump
  → buildSyncDelta → playlist = scheduled · source SCHEDULE
  → update targets GROUP-A → GROUP-B (old ∪ new bump)
  → buildSyncDelta → new scheduled playlist
  → deactivate → resolve + sync → DEFAULT
  → delete → resolve + sync → DEFAULT
```

Also: windows half-open, overnight, timezone Device TZ, priority HIGH>NORMAL, RBAC matrix, cross-tenant rejects.

Secrets: none recorded.
