# Runtime Policy Resolution E2E

**Date:** 2026-09-22T21:17:27.724Z
**Base:** http://127.0.0.1:3003

## Scenario A — Chromium /player
```json
{
  "label": "Chromium /player",
  "snap": {
    "requested": {
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
    "diagnostics": [],
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
    "deviceId": "unpaired",
    "tenantId": "local",
    "resolvedAt": "2026-09-22T21:17:27.958Z",
    "ok": true,
    "error": null,
    "fullscreenApiCalled": false,
    "orientationLockCalled": false
  }
}
```

## Scenario B — Simulated fragile environment
```json
{
  "label": "Simulated fragileSmartTv",
  "requested": {
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
  "resolved": {
    "presentation": "WINDOWED",
    "cursor": "AUTO_HIDE",
    "orientation": "AUTO"
  },
  "fallbacks": [
    {
      "field": "presentation",
      "requested": "FULLSCREEN",
      "resolved": "WINDOWED",
      "reason": "environment.fragileSmartTv — no Hisense-specific hack; treat as unsupported until evidenced"
    },
    {
      "field": "orientation",
      "requested": "LANDSCAPE",
      "resolved": "AUTO",
      "reason": "capabilities.orientation=false — do not call screen.orientation.lock"
    }
  ],
  "diagnostics": [
    "Requested FULLSCREEN resolved to WINDOWED (capability/environment). PWA display:fullscreen is a separate mechanism.",
    "Orientation lock LANDSCAPE unavailable; resolved AUTO"
  ],
  "environment": {
    "userAgent": "Mozilla/5.0 Hisense VIDAA Sraf simulated",
    "fragileSmartTv": true,
    "secureContext": true,
    "language": "pt"
  }
}
```

## Guarantees
- fullscreenApiCalled: false
- orientationLockCalled: false

## Verdict
**IMPLEMENTATION VALIDATED**
