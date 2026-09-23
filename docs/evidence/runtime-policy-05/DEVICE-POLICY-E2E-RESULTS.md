# Device Policy Enrichment E2E

**Date:** 2026-09-22T21:29:11.924Z
**Base:** http://127.0.0.1:3004

## Scenario A — TV + PASSIVE + LANDSCAPE
```json
{
  "label": "TV+PASSIVE+LANDSCAPE",
  "snap": {
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
    "deviceId": "e2e-device-a",
    "tenantId": "e2e-tenant",
    "resolvedAt": "2026-09-22T21:29:12.939Z",
    "ok": true,
    "error": null,
    "fullscreenApiCalled": false,
    "orientationLockCalled": false
  }
}
```

## Scenario B — TOUCH_DISPLAY (Interactive Runtime NOT started)
```json
{
  "label": "TOUCH_DISPLAY + TOUCH",
  "requested": {
    "presentation": "AUTO",
    "cursor": "AUTO_HIDE",
    "input": [
      "KEYBOARD_LIKE",
      "MOUSE",
      "TOUCH"
    ],
    "interaction": "INTERACTIVE",
    "orientation": "LANDSCAPE"
  },
  "resolved": {
    "interaction": "INTERACTIVE",
    "presentation": "FULLSCREEN"
  },
  "diagnostics": [
    "policySource: DEVICE_CONFIG",
    "AUTO presentation resolved to FULLSCREEN from capabilities.fullscreen=true",
    "INTERACTIVE_NOT_IMPLEMENTED — Interactive Runtime not shipped; playback remains PASSIVE"
  ],
  "interactiveRuntimeStarted": false
}
```

## Scenario C — PORTRAIT
```json
{
  "label": "PORTRAIT",
  "snap": {
    "requested": {
      "presentation": "AUTO",
      "cursor": "AUTO_HIDE",
      "input": [
        "KEYBOARD_LIKE",
        "MOUSE",
        "TOUCH"
      ],
      "interaction": "PASSIVE",
      "orientation": "PORTRAIT"
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
      "orientation": "PORTRAIT"
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
    "deviceId": "e2e-device-c",
    "tenantId": "e2e-tenant",
    "resolvedAt": "2026-09-22T21:29:14.370Z",
    "ok": true,
    "error": null,
    "fullscreenApiCalled": false,
    "orientationLockCalled": false
  }
}
```

## Guarantees
- fullscreenApiCalled: false
- orientationLockCalled: false
- timezone not in policy snapshot

## Verdict
**IMPLEMENTATION VALIDATED**
