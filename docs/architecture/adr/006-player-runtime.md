# ADR-006 — Player Runtime (Passive vs Interactive)

## Status

Accepted (2026-09-16)

## Context

Vitrine360 Player is a Digital Signage appliance. Near-term hardware is Android TV Box → HDMI → Smart TV (no viewer interaction). Longer-term, Interactive Digital Signage (touch, QR, hybrid) must not require a rewrite of pairing, sync, or tenancy.

## Decision

Treat `/player` as a **Player Runtime** with a selectable flavour:

```text
Vitrine360 Runtime
       │
       ├── Passive Runtime   ← implemented now (autoplay, playlist, schedule)
       └── Interactive Runtime ← deferred (touch, navigation, search)
```

Device model carries:

- `display_type` — `TV` | `TOUCH_DISPLAY` | `LED` | `KIOSK` (default `TV`)
- `interaction_mode` — `PASSIVE` | `TOUCH` | `QR` | `HYBRID` (default `PASSIVE`)

MVP behaviour implements **PASSIVE** only. Interactive UI is out of scope and must not be assumed impossible by code structure.

Code boundary: `src/player/runtime/passive.ts` (+ future `interactive.ts`).

## Consequences

- Pairing, heartbeat, IndexedDB sync, and tenant isolation stay shared.
- Playback UI (`DisplayEngine`) remains Passive-specific.
- Future Interactive Runtime can read `interaction_mode` without changing device tokens.
