# Device Observability E2E

**Date:** 2026-09-22T22:05:06.716Z
**Base:** http://127.0.0.1:3007

```json
{
  "date": "2026-09-22T22:05:06.716Z",
  "base": "http://127.0.0.1:3007",
  "scenarioA": {
    "presence": "ONLINE",
    "playing": true,
    "sync": "READY"
  },
  "scenarioB": {
    "presence": "ONLINE",
    "playing": false
  },
  "scenarioC": {
    "presence": "OFFLINE",
    "lastReportedPlaying": true,
    "isLastReported": true
  },
  "scenarioD": {
    "code": "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
    "severity": "INFO"
  },
  "scenarioE": {
    "code": "ORIENTATION_MISMATCH",
    "severity": "WARNING"
  },
  "scenarioF": {
    "tenantIsolation": "DENY cross-tenant"
  },
  "scenarioG": {
    "url": "http://127.0.0.1:3007/admin/login",
    "mobileBodyWidth": 390,
    "viewWidth": 390,
    "noExtremeHorizontalBleed": true,
    "presenceUnauthorized": 401
  },
  "verdict": "PASS"
}
```

## Verdict
**IMPLEMENTATION VALIDATED**
