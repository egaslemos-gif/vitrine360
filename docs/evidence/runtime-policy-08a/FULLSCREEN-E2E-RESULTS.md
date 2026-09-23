# Fullscreen E2E (RUNTIME-POLICY-08A)

**Date:** 2026-09-22T22:27:46.235Z
**Base:** http://127.0.0.1:3009
**Matrix:** ["Chromium desktop","Chromium viewport normal","Chromium null-API unavailable path"]
**Hisense:** NOT RUN — physical validation deferred

## Scenario A — Boot without activation
```json
{
  "label": "Boot FULLSCREEN without activation",
  "presentation": "FULLSCREEN",
  "fullscreenApiCalled": false,
  "policyApiCalled": false,
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
    "lastInputAt": null,
    "lastInputClass": null,
    "updatedAt": 1790116067184
  },
  "diagnostics": [
    {
      "code": "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
      "severity": "INFO",
      "message": "Resolved presentation FULLSCREEN but fullscreen is not active because user activation is required"
    },
    {
      "code": "FULLSCREEN_USER_ACTIVATION_REQUIRED",
      "severity": "INFO",
      "message": "fullscreen user activation required"
    }
  ],
  "ctl": {
    "status": "IDLE",
    "active": false,
    "apiAvailable": true,
    "capability": true,
    "lastDiagnosticCode": "FULLSCREEN_USER_ACTIVATION_REQUIRED",
    "requestInFlight": false,
    "requestCount": 0
  }
}
```

## Scenario B — Explicit enter
```json
{
  "label": "Explicit enter control",
  "requestCalled": true,
  "note": "Browser granted fullscreen",
  "snap": {
    "fullscreenApiCalled": true,
    "fullscreenActive": true,
    "ctl": {
      "status": "ACTIVE",
      "active": true,
      "apiAvailable": true,
      "capability": true,
      "lastDiagnosticCode": "FULLSCREEN_ACTIVE",
      "requestInFlight": false,
      "requestCount": 1
    }
  }
}
```

## Scenario C — Exit
```json
{
  "label": "Exit fullscreen",
  "fullscreenActive": false,
  "ctl": {
    "status": "IDLE",
    "active": false,
    "apiAvailable": true,
    "capability": true,
    "lastDiagnosticCode": "FULLSCREEN_EXITED",
    "requestInFlight": false,
    "requestCount": 1
  }
}
```

## Scenario D — Rejection / no crash
```json
{
  "label": "Rejection / player continues",
  "result": {
    "ok": false,
    "code": "FULLSCREEN_USER_ACTIVATION_REQUIRED"
  },
  "before": 1,
  "after": 2,
  "playingOk": true,
  "stillAlive": true,
  "note": "Controller binds API at construction; rejection covered in unit FULLSCREEN-012/013. Live asserts no crash."
}
```

## Scenario E — API unavailable
```json
{
  "label": "API unavailable (null API controller)",
  "installed": {
    "status": "UNAVAILABLE",
    "active": false,
    "apiAvailable": false,
    "capability": false,
    "lastDiagnosticCode": "FULLSCREEN_UNAVAILABLE",
    "requestInFlight": false,
    "requestCount": 0
  },
  "state": {
    "isPlaying": false,
    "currentContentId": null,
    "currentManifestVersion": null,
    "syncState": "IDLE",
    "networkState": "ONLINE",
    "cursorVisible": true,
    "fullscreenActive": false,
    "fullscreenStatus": "UNAVAILABLE",
    "fullscreenDiagnosticCode": "FULLSCREEN_UNAVAILABLE",
    "orientationActual": "LANDSCAPE",
    "lastInputAt": 1790116068213,
    "lastInputClass": "MOUSE",
    "updatedAt": 1790116068545
  },
  "diagnostics": [
    {
      "code": "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
      "severity": "INFO",
      "message": "Resolved presentation FULLSCREEN but fullscreen is not active because Fullscreen API is unavailable"
    },
    {
      "code": "FULLSCREEN_UNAVAILABLE",
      "severity": "WARNING",
      "message": "fullscreen unavailable"
    }
  ],
  "fullscreenApiCalled": false,
  "ctl": {
    "status": "UNAVAILABLE",
    "active": false,
    "apiAvailable": false,
    "capability": false,
    "lastDiagnosticCode": "FULLSCREEN_UNAVAILABLE",
    "requestInFlight": false,
    "requestCount": 0
  },
  "requestBlocked": {
    "before": 0,
    "after": 0,
    "result": {
      "ok": false,
      "code": "FULLSCREEN_UNAVAILABLE"
    }
  }
}
```

## Scenario F — WINDOWED
```json
{
  "label": "WINDOWED never requests",
  "before": 0,
  "after": 0,
  "result": {
    "ok": false,
    "code": "FULLSCREEN_POLICY_WINDOWED"
  }
}
```

## Verdict
**IMPLEMENTATION VALIDATED** (Chromium E2E)

- PHYSICAL DEVICE VALIDATED: no
- PRODUCTION VALIDATED: no
