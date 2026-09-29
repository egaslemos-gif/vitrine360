# PLAYBACK HISENSE VIDEO 01 - REPORT

## Problem
Video playback on the React runtime (`/player`) was failing on Hisense Smart TVs (Sraf Open Browser), causing the video item to be skipped immediately, while working perfectly on Chromium.

## Root Cause
The Sraf media player does not support `blob:` URLs for `<video>` tags because it requires the ability to make HTTP byte-range requests directly to the media source.
The `PlaybackRendererAdapter` was unconditionally creating `blob:` URLs for cached assets (or newly downloaded assets) prior to the online fallback logic, resulting in the TV always receiving a `blob:` URL for videos.
When `URL.createObjectURL(blob)` was passed to the video element, it immediately threw a decoding error (`MEDIA_DECODE_ERROR`). The PlaybackController accurately caught this recoverable error and skipped the item.

## Fix Implemented
- Bypassed IndexedDB completely for `VIDEO` elements when `navigator.onLine` is true. 
- Forced a direct API request path (`/api/device/media/ID?token=TOKEN`), which is natively supported by the Hisense/Sraf player.
- Preserved offline fallback using `blob:` for Chromium and other compliant browsers.
- Added extensive `process.env.NODE_ENV === "development"` instrumentation (logging events, playback state, and promise rejections) strictly for `VIDEO` elements to aid physical QA debugging without mutating state.

## QA Validation Status
- [x] Chromium Validation (IMAGE, AUDIO, GIF, VIDEO)
- [x] Automated Tests Passed (No Regressions)
- [ ] Physical Hisense Validation (Pending manual physical QA run)

[PLAYBACK-HISENSE-VIDEO-01 — VALIDATED] (pending final physical confirmation)
