# Runtime State E2E

**Date:** 2026-09-22T21:42:33.105Z
**Base:** http://127.0.0.1:3006

## Scenario A
```json
{
  "label": "TV+PASSIVE+LANDSCAPE state",
  "snap": {
    "policy": {
      "requested": {
        "presentation": "AUTO",
        "cursor": "AUTO_HIDE",
        "input": [
          "KEYBOARD_LIKE",
          "MOUSE",
          "TOUCH"
        ],
        "interaction": "PASSIVE",
        "orientation": "LANDSCAPE"
      },
      "resolved": {
        "presentation": "FULLSCREEN",
        "cursor": "AUTO_HIDE",
        "input": [
          "KEYBOARD_LIKE",
          "MOUSE",
          "TOUCH"
        ],
        "interaction": "PASSIVE",
        "orientation": "LANDSCAPE"
      },
      "fallbacks": [],
      "diagnostics": [
        "policySource: DEVICE_CONFIG",
        "AUTO presentation resolved to FULLSCREEN from capabilities.fullscreen=true"
      ],
      "policySource": "DEVICE_CONFIG",
      "capabilities": {
        "video": true,
        "image": true,
        "gif": true,
        "touch": false,
        "pointer": true,
        "keyboard": true,
        "remote": false,
        "fullscreen": true,
        "orientation": true,
        "network": true,
        "serviceWorker": true,
        "indexedDB": true
      },
      "environment": {
        "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.6778.33 Safari/537.36",
        "fragileSmartTv": false,
        "secureContext": true,
        "language": "en-US"
      },
      "deviceId": "e2e-rs-a",
      "tenantId": "e2e-tenant",
      "resolvedAt": "2026-09-22T21:42:34.261Z",
      "ok": true,
      "error": null,
      "fullscreenApiCalled": false,
      "orientationLockCalled": false
    },
    "state": {
      "state": {
        "isPlaying": false,
        "currentContentId": null,
        "currentManifestVersion": null,
        "syncState": "IDLE",
        "networkState": "ONLINE",
        "cursorVisible": false,
        "fullscreenActive": false,
        "orientationActual": "LANDSCAPE",
        "lastInputAt": null,
        "lastInputClass": null,
        "updatedAt": 1790113354261
      },
      "policy": {
        "requested": {
          "presentation": "AUTO",
          "cursor": "AUTO_HIDE",
          "input": [
            "KEYBOARD_LIKE",
            "MOUSE",
            "TOUCH"
          ],
          "interaction": "PASSIVE",
          "orientation": "LANDSCAPE"
        },
        "resolved": {
          "presentation": "FULLSCREEN",
          "cursor": "AUTO_HIDE",
          "input": [
            "KEYBOARD_LIKE",
            "MOUSE",
            "TOUCH"
          ],
          "interaction": "PASSIVE",
          "orientation": "LANDSCAPE"
        },
        "policySource": "DEVICE_CONFIG"
      },
      "actual": {
        "fullscreenActive": false,
        "cursorVisible": false,
        "orientation": "LANDSCAPE",
        "isPlaying": false
      },
      "capabilities": {
        "video": true,
        "image": true,
        "gif": true,
        "touch": false,
        "pointer": true,
        "keyboard": true,
        "remote": false,
        "fullscreen": true,
        "orientation": true,
        "network": true,
        "serviceWorker": true,
        "indexedDB": true
      },
      "fallbacks": [],
      "diagnostics": [
        "policySource: DEVICE_CONFIG",
        "AUTO presentation resolved to FULLSCREEN from capabilities.fullscreen=true"
      ],
      "policyActualDiagnostics": [
        {
          "code": "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
          "severity": "INFO",
          "message": "Resolved presentation FULLSCREEN but document.fullscreenElement is null (observational; Fullscreen API not called by policy)"
        }
      ],
      "heartbeat": {
        "isPlaying": false,
        "currentContentId": null,
        "currentManifestVersion": null,
        "syncState": "IDLE",
        "networkState": "ONLINE",
        "cursorVisible": false,
        "fullscreenActive": false,
        "orientationActual": "LANDSCAPE",
        "lastInputAt": null,
        "lastInputClass": null
      },
      "tenantId": "e2e-tenant",
      "deviceId": "e2e-rs-a",
      "updatedAt": 1790113354261,
      "fullscreenApiCalled": false,
      "orientationLockCalled": false
    }
  }
}
```

## Scenario B — Offline
```json
{
  "label": "network offline",
  "networkState": "OFFLINE"
}
```

## Scenario C — Input
```json
{
  "label": "input",
  "input": {
    "isPlaying": false,
    "currentContentId": null,
    "currentManifestVersion": null,
    "syncState": "IDLE",
    "networkState": "ONLINE",
    "cursorVisible": true,
    "fullscreenActive": false,
    "orientationActual": "LANDSCAPE",
    "lastInputAt": 1790113354918,
    "lastInputClass": "KEYBOARD_LIKE",
    "updatedAt": 1790113354918
  }
}
```

## Scenario D — Orientation
```json
{
  "label": "orientation portrait",
  "orientationActual": "PORTRAIT"
}
```

## Scenario E — Fullscreen observational
```json
{
  "label": "fullscreen observational",
  "fullscreenApiCalled": false,
  "fullscreenActive": false
}
```

## Scenario F — Mismatch
```json
{
  "label": "mismatch",
  "diagnostics": [
    {
      "code": "PRESENTATION_NOT_ACTUALLY_FULLSCREEN",
      "severity": "INFO",
      "message": "Resolved presentation FULLSCREEN but document.fullscreenElement is null (observational; Fullscreen API not called by policy)"
    },
    {
      "code": "ORIENTATION_MISMATCH",
      "severity": "WARNING",
      "message": "Resolved orientation LANDSCAPE but actual is PORTRAIT"
    }
  ]
}
```

## Notes
- isPlaying at first snapshot: false
- Unpaired E2E may have isPlaying=false without manifest; store + globals still required.

## Verdict
**IMPLEMENTATION VALIDATED**
