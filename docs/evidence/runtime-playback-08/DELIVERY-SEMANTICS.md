# RUNTIME-PLAYBACK-08 — Delivery Semantics

## Semantics

| Layer | Guarantee |
|-------|-----------|
| Transport | **AT-LEAST-ONCE** delivery (retries, reconnects, duplicate polls) |
| Command / Dispatcher | **IDEMPOTENT EXECUTION** via stable `commandId` |
| Exactly-once | **Not assumed** on the network |

Duplicate delivery → idempotency store → `DUPLICATE` → **no second PlaybackAction**.

## Lifecycle (logical)

```
CREATED → QUEUED → DELIVERING → RECEIVED → DISPATCHED → APPLIED → ACKED
```

Failures (non-exclusive): `EXPIRED` | `REJECTED` | `TIMEOUT` | `DISCONNECTED` | `DUPLICATE` | `STALE_SESSION`

Do not invent extra states without product need.

## ACK levels (must not be conflated)

| Level | Meaning |
|-------|---------|
| TRANSPORT_ACK | Envelope reached Device Runtime |
| DISPATCH_ACK | CommandDispatcher accepted (maps to RP-07 `CommandResult`) |
| PLAYBACK_OBSERVATION | PlaybackState changed (existing observation/telemetry) |

Flow: COMMAND → TRANSPORT_ACK → DISPATCH_ACK → PLAYBACK_OBSERVATION

**APPLIED ≠ media visually playing.** PlaybackState remains SoT.

## TTL / retention (architecture)

| Concern | Guidance |
|---------|----------|
| Command TTL | Short; align with RP-07 bounds (1–60s, default 10s) or **raise remote default** if poll interval > TTL |
| Queue retention | ≤ TTL + small grace; no eternal commands |
| ACK retention | Bounded window for correlating duplicates |
| Duplicate window | ≥ max(retry window, TTL + grace) |
| Cleanup | Time-based purge of expired / acked rows |

## Offline device + command created

| Policy | Fit |
|--------|-----|
| A. Discard immediately | Too aggressive for brief blips |
| B. Queue until reconnect | Risk of stale semantic (PAUSE 30s later) |
| C. Expire by TTL | **Preferred default** — fail-closed |
| D. Configurable per type | Future; keep TTL mandatory |

**Recommendation:** Queue while within TTL; on reconnect deliver only non-expired, session-valid commands; else `EXPIRED` / `STALE_SESSION`.

Stale after reconnect: expired **or** session mismatch **or** superseded → must not auto-execute.

## Ordering

| Scope | Rule |
|-------|------|
| Global | **Not required** |
| Device / session | FIFO best-effort for incompatible intents |
| Conflicting | Controller-state dependent; **no coalescing in architecture yet** |
| Supersede | Future optional (e.g. latest VOLUME) — not RP-08 |

Examples remain distinct commands: VOLUME 0.2 then 0.8.

## Retry

- Exponential backoff + jitter for transport reconnect
- Max retries bounded by **command TTL**, not infinite attempts
- **Retry MUST reuse the same `commandId`**

Reconnect states (future client): CONNECTED | DISCONNECTED | RECONNECTING — backoff 1s → 2s → 4s → 8s… + jitter (document only; not implemented).

## Timeouts (conceptual — not implemented)

| Timeout | Role |
|---------|------|
| Transport timeout | Single request / stream wait |
| Dispatch timeout | Local dispatcher bound (usually sync) |
| ACK timeout | Wait for DISPATCH_ACK / observation correlation |

Do not use one timeout for all three.
