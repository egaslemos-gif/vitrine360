# ADR-RUNTIME-PLAYBACK-007 — Device Command Model & Dispatch Foundation

## Status

Accepted — 2026-09-26

## Context

RP-01…06 established PlaybackController as SoT, media controls, and PlayerSession/observability. Remote console control needs a safe command domain before any network transport exists. Prior art had no DeviceCommand, no TTL/idempotency, and no Command → PlaybackAction mapping.

## Decision

1. Introduce pure **DeviceCommand** domain (identity, type, payload, tenant, device, session binding, TTL).
2. Keep **COMMAND ≠ TRANSPORT ≠ PLAYBACK ACTION**.
3. Route all accepted commands through **CommandDispatcher** → `mapCommandToPlaybackAction` → `PlaybackController.dispatch` only.
4. Prefer **SESSION_BOUND** playback commands to reject stale-session delivery after reload.
5. Enforce short TTL (1–60s, default 10s), fail-closed expiry, and bounded in-memory idempotency (not production durable).
6. Authorization boundary `authorizeDeviceCommand` maps to existing `manage_devices`; no new entitlement/RBAC role in this phase.
7. Provide **LocalCommandTransport** + DEV-only Command Lab; no SSE/WebSocket/remote APIs/DB.

## Consequences

- Console/remote control can be designed against a stable command contract without coupling to media elements.
- Duplicate/expired/cross-tenant/stale-session commands never apply twice or illegally.
- Future transport must re-validate server-side clock, auth, and delivery; local idempotency is lab/test only.
