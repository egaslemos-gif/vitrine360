# Runtime Capability Probe Contract

Status: conceptual contract only. No probes or persistence are implemented by this document.

## Purpose

The runtime must distinguish what was requested from what the current browser/device can actually support. A User-Agent match may select a compatibility path, but it is not proof of a capability.

## Probe record

Each probe conceptually produces:

```text
Capability
  -> Probe
  -> Result
  -> Timestamp
  -> Optional Telemetry
```

Suggested result shape:

```text
{
  capability: "serviceWorker",
  result: "SUPPORTED",
  observedAt: "ISO-8601 timestamp",
  source: "runtime",
  detail: "optional diagnostic detail"
}
```

`detail` must not contain tokens, credentials, media URLs, or sensitive browser data.

## Result vocabulary

- `SUPPORTED`: the probe completed and the feature was observed to work.
- `UNSUPPORTED`: the API or required behavior is absent or explicitly unavailable.
- `UNKNOWN`: the probe was not possible, was skipped, or the result cannot be trusted.
- `ERROR`: the probe ran but failed unexpectedly.

`UNKNOWN` must not be treated as `SUPPORTED`.

## Minimum capability set

| Capability | Probe intent | Persist/report guidance |
|---|---|---|
| `fullscreen` | API presence and user-activation request result | Report last result, not every request |
| `serviceWorker` | API presence, registration and controller state | Report once per runtime session |
| `indexedDB` | Open/read/write transaction with bounded timeout | Report support and failure class |
| `cacheApi` | Open, put, match, delete test entry | Report support and quota/error |
| `video` | Element creation, selected codec `canPlayType`, play outcome | Report codec-level summary |
| `audio` | Element capability and policy outcome | Report only if audio is requested |
| `touch` | `maxTouchPoints` plus touch/pointer evidence | Do not infer interaction mode |
| `pointer` | PointerEvent API and observed pointer event | Local runtime capability |
| `keyboard` | KeyboardEvent API and observed event | Does not imply remote control |
| `orientation` | Screen Orientation API and lock result | Keep desired vs actual separate |
| `network` | Online state and request/recovery result | Heartbeat remains authoritative |
| `storage` | Quota/estimate and write/read result | Report quota class, not content |
| `remoteInput` | Environment-specific evidence of remote events | Never infer from `keyboard` |

## Environment notes

- Hisense/VIDAA and other fragile Smart TV browsers require conservative fallbacks. A User-Agent match can select `tv.html`, but capability results should still be `UNKNOWN` until probed safely.
- Android TV Box + Chrome is the target for reliable Service Worker, IndexedDB, media blob, and offline reboot validation.
- Desktop Chrome/Edge is the development reference environment.

## Non-goals

This contract does not create a database table, API, migration, manifest field, sync behavior, or runtime implementation.
