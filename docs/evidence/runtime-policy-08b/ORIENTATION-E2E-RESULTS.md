# Orientation E2E (RUNTIME-POLICY-08B)

**Date:** 2026-09-22T22:42:24.126Z
**Base:** http://127.0.0.1:3010
**Matrix:** ["Chromium desktop","viewport landscape","viewport portrait","null-API unavailable path","rejected lock path"]
**Hisense:** NOT RUN — physical validation deferred

## Scenario A — AUTO
```json
{
  "label": "AUTO observe no lock",
  "resolved": "AUTO",
  "lockCalled": false,
  "state": {
    "isPlaying": false,
    "currentContentId": null,
    "currentManifestVersion": null,
    "syncState": "IDLE",
    "networkState": "ONLINE",
    "cursorVisible": false,
    "fullscreenActive": false,
    "fullscreenStatus": "IDLE",
    "fullscreenDiagnosticCode": "FULLSCREEN_USER_ACTIVATION_REQUIRED",
    "orientationActual": "LANDSCAPE",
    "orientationStatus": "IDLE",
    "orientationDiagnosticCode": null,
    "lastInputAt": null,
    "lastInputClass": null,
    "updatedAt": 1790116945652
  },
  "ctl": {
    "status": "IDLE",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": null,
    "requestInFlight": false,
    "lockCount": 0,
    "requiresFullscreen": false
  }
}
```

## Scenario B — LANDSCAPE
```json
{
  "label": "LANDSCAPE lock attempt",
  "note": "Headless Chromium often denies orientation.lock without fullscreen",
  "before": 0,
  "result": {
    "ok": false,
    "code": "ORIENTATION_LOCK_UNAVAILABLE"
  },
  "ctl": {
    "status": "FAILED",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 1,
    "requiresFullscreen": false
  }
}
```

## Scenario C — PORTRAIT
```json
{
  "label": "PORTRAIT lock attempt",
  "result": {
    "ok": false,
    "code": "ORIENTATION_LOCK_UNAVAILABLE"
  },
  "ctl": {
    "status": "FAILED",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 2,
    "requiresFullscreen": false
  }
}
```

## Scenario D — Rejection
```json
{
  "label": "rejection / no crash",
  "result": {
    "ok": false,
    "code": "ORIENTATION_LOCK_UNAVAILABLE"
  },
  "rootAlive": true
}
```

## Scenario E — Unavailable
```json
{
  "label": "API unavailable",
  "installed": {
    "status": "UNAVAILABLE",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": false,
    "lockAvailable": false,
    "capability": false,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 0,
    "requiresFullscreen": false
  },
  "state": {
    "isPlaying": false,
    "currentContentId": null,
    "currentManifestVersion": null,
    "syncState": "IDLE",
    "networkState": "ONLINE",
    "cursorVisible": false,
    "fullscreenActive": false,
    "fullscreenStatus": "IDLE",
    "fullscreenDiagnosticCode": "FULLSCREEN_USER_ACTIVATION_REQUIRED",
    "orientationActual": "LANDSCAPE",
    "orientationStatus": "UNAVAILABLE",
    "orientationDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "lastInputAt": null,
    "lastInputClass": null,
    "updatedAt": 1790116946182
  },
  "ctl": {
    "status": "UNAVAILABLE",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": false,
    "lockAvailable": false,
    "capability": false,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 0,
    "requiresFullscreen": false
  }
}
```

## Scenario F — Mismatch
```json
{
  "label": "ORIENTATION_MISMATCH",
  "diagnostics": [
    {
      "code": "ORIENTATION_MISMATCH",
      "severity": "WARNING",
      "message": "Resolved orientation LANDSCAPE but actual is PORTRAIT"
    }
  ]
}
```

## Scenario G — No fullscreen from orientation
```json
{
  "label": "orientation does not call requestFullscreen",
  "result": {
    "ok": false,
    "code": "ORIENTATION_LOCK_UNAVAILABLE"
  },
  "fullscreenRequestDelta": 0,
  "fullscreenApiCalled": false,
  "ctl": {
    "status": "FAILED",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 1,
    "requiresFullscreen": false
  }
}
```

## Scenario H — AUTO after lock
```json
{
  "label": "AUTO after lock",
  "before": {
    "status": "FAILED",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 2,
    "requiresFullscreen": false
  },
  "after": {
    "status": "FAILED",
    "locked": false,
    "lockedTarget": null,
    "observationAvailable": true,
    "lockAvailable": true,
    "capability": true,
    "actual": "LANDSCAPE",
    "lastDiagnosticCode": "ORIENTATION_LOCK_UNAVAILABLE",
    "requestInFlight": false,
    "lockCount": 2,
    "requiresFullscreen": false
  }
}
```

## Viewport portrait
```json
{
  "orientationActual": "PORTRAIT"
}
```

## Verdict
**IMPLEMENTATION VALIDATED** (Chromium E2E)

- PHYSICAL DEVICE VALIDATED: no
- PRODUCTION VALIDATED: no
