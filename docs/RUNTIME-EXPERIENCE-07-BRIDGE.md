# Vitrine360 — RUNTIME-EXPERIENCE-07  
# Controlled Experience postMessage Bridge v1

**Date:** 2026-09-23  
**Status:** CONTROLLED BRIDGE VALIDATED (read-only v1 · no Player wire)  
**Depends on:** EXPERIENCE-01 … 06  
**ADR:** [ADR-EXPERIENCE-007](./adr/ADR-EXPERIENCE-007.md)

**Not claimed:** HTML_APP · Player integration · Fullscreen/Orientation bridge · Storage/Network bridge · PRODUCTION READY

---

## 1. Purpose

Provide a **fail-closed**, **allowlisted** `postMessage` bridge between the trusted host and an untrusted Experience iframe.

```text
TRUSTED VITRINE360
        │ controlled postMessage
        ▼
UNTRUSTED EXPERIENCE
```

`postMessage` is **transport only**. Security requires:

```text
source ∧ origin ∧ protocol ∧ schema ∧ method ∧ permission ∧ capability
```

Any failure → **DENY**.

---

## 2. Threat Model

| Threat | Mitigation |
|--------|------------|
| T3/T4 Token/cookie theft | No token/cookie methods or forwarding |
| T6 Arbitrary network | No network/proxy methods |
| T12 postMessage abuse | Exact source + origin; no `*` |
| T14 Cross-tenant | Per-instance tenant scope |
| Spoofed iframe | `event.source === iframe.contentWindow` |
| Generic RPC | Explicit method map / switch only |
| Exhaustion | Payload limit + rate limit |

---

## 3. Trust Boundary

| Zone | Role |
|------|------|
| Host / Bridge | TRUSTED |
| Experience | UNTRUSTED |

Published ≠ Trusted. Validated ≠ Trusted. Same tenant ≠ automatic trust for privileges beyond grant.

---

## 4. Message Transport

- Browser `window.postMessage` / `MessageEvent`  
- **No** MessageChannel / BroadcastChannel in v1  
- One listener per `ExperienceBridgeHost` instance  

---

## 5–6. Origin / Source Validation

Mandatory:

```text
event.source === stored iframe.contentWindow
AND
event.origin === expectedExperienceOrigin  (URL.origin equality)
```

Reject: `*`, substring/endsWith heuristics, experience-supplied origin fields.

Responses use:

```ts
iframe.contentWindow.postMessage(response, expectedOrigin) // NEVER "*"
```

---

## 7. Protocol

| Concept | Value |
|---------|-------|
| `protocolVersion` | `"1.0"` |
| Package `schemaVersion` | Separate (EXPERIENCE-02) |
| Experience semver | Separate |

Unsupported protocol → `BRIDGE_INVALID_PROTOCOL` (no silent fallback).

---

## 8. Envelope

**Request**

```json
{
  "type": "V360_BRIDGE_REQUEST",
  "protocolVersion": "1.0",
  "requestId": "…",
  "method": "runtime.getInfo",
  "params": {}
}
```

**Response**

```json
{
  "type": "V360_BRIDGE_RESPONSE",
  "protocolVersion": "1.0",
  "requestId": "…",
  "ok": true,
  "result": { }
}
```

Unexpected top-level fields → reject.  
`BRIDGE_MAX_MESSAGE_BYTES` = **8192**.

---

## 9. Request IDs

- Pattern: `[A-Za-z0-9_-]{8,128}`  
- Correlation only — not authentication  
- In-flight + completed sets block duplicates  

---

## 10. Method Registry (V1)

| Method | Permission | Side effect |
|--------|------------|-------------|
| `runtime.getInfo` | `RUNTIME_READ` | READ_ONLY |
| `runtime.getViewport` | `RUNTIME_READ` | READ_ONLY |
| `runtime.getOrientation` | `RUNTIME_READ` | READ_ONLY |
| `runtime.getTime` | `RUNTIME_READ` | READ_ONLY |

Handlers via **explicit `switch`** — never `handlers[method](params)` dynamic call from message string into arbitrary objects.

---

## 11–12. Permissions / Capabilities

- Missing permission ⇒ **DENIED** (no implicit allow)  
- No `ALLOW_ALL`  
- Capability gates optional per method; V1 reads use permission only  

Effective privilege model remains:

```text
Browser ∩ Requested ∩ Admin ∩ RuntimePolicy
```

(Bridge enforces the grant sets passed into the host instance.)

---

## 13. Lifecycle

```text
CREATED → WAITING → READY → ACTIVE → STOPPING → STOPPED
                              ↘ ERROR
```

Requests before READY/ACTIVE → `BRIDGE_NOT_READY`.  
`stop()` removes listener, clears pending/rate state, nulls window ref.

---

## 14–15. Rate limit / Timeout

| Knob | Default |
|------|---------|
| Rate | 40 req / 10s **per bridge instance** |
| Timeout | 3000 ms (infrastructure; V1 handlers sync) |
| Max pending tracked | 64 |

---

## 16–17. Errors / Logging

Stable codes: `BRIDGE_INVALID_*`, `BRIDGE_METHOD_NOT_ALLOWED`, `BRIDGE_PERMISSION_DENIED`, `BRIDGE_RATE_LIMITED`, `BRIDGE_STOPPED`, …  

Safe `error.message` only — no stacks/SQL/secrets.  

Logs/metrics: method, codes, counts — not raw payloads/tokens.

---

## 18. Supported vs Deferred

### Supported (V1)

`runtime.getInfo` | `getViewport` | `getOrientation` | `getTime`

### Deferred (explicit)

- `experience.requestFullscreen` / orientation control  
- storage.*, network.*, device.*, auth.*, content.*, playlist.*, schedule.*  
- generic `execute` / `rpc` / `proxy`  

---

## 19. Security Invariants (BRIDGE-SEC-001…020)

Automated in `npm run test:runtime-experience-07` (see checklist).

---

## 20. Non-goals

- Player playback integration  
- HTML_APP CONTENT_TYPE  
- Token/session bridge  
- DB / R2 / storage / HTTP proxy  

---

## Evidence

- ADR: `docs/adr/ADR-EXPERIENCE-007.md`  
- Checklist: `docs/evidence/runtime-experience-07/BRIDGE-CHECKLIST.md`  
- `npm run test:runtime-experience-07`
