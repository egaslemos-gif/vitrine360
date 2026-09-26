# ADR-EXPERIENCE-007 — Controlled Experience postMessage Bridge v1

**Status:** Accepted (read-only bridge v1) — 2026-09-23  
**Phase:** RUNTIME-EXPERIENCE-07  
**Depends on:** ADR-EXPERIENCE-001 … 006  
**Related:** `docs/RUNTIME-EXPERIENCE-07-BRIDGE.md`

---

## Context

EXPERIENCE-06 ships a sandboxed iframe host without a communication channel. EXPERIENCE-04 requires that any host↔Experience channel be an allowlisted, fail-closed bridge — never a general RPC or token pipe.

---

## Decision

1. Use **`postMessage` as the only v1 transport**.  
2. Mandate **`event.source` identity + exact `event.origin`** before any parsing trust.  
3. Mandate **exact `targetOrigin`** on responses — **never `"*"`**.  
4. Ship a **tiny READ_ONLY allowlist**: `runtime.getInfo|getViewport|getOrientation|getTime`.  
5. Dispatch via **explicit `switch`**, not dynamic property access.  
6. **Deny by default** on missing permission; no `ALLOW_ALL`.  
7. Enforce payload size + per-instance rate limits + lifecycle cleanup.  
8. **Defer** fullscreen/orientation control methods until policy/activation wiring is complete.  
9. Do **not** wire the bridge into Player playback or CONTENT_TYPES.

---

## Rejected alternatives

| Alternative | Why rejected |
|-------------|--------------|
| Wildcard origin / targetOrigin | T12 abuse |
| Generic RPC / `service[method]` | Arbitrary privilege |
| Token / auth forwarding | T3 |
| Network / storage proxy | T6 / T13 |
| Same-origin privileged bridge | Collapses isolation |
| Auto-trust handshake HELLO | Insufficient auth |
| Fullscreen bridge without controller gates | Unsafe CONTROL surface |

---

## Consequences

### Positive

- Auditable method registry  
- Multi-iframe / tenant isolation by instance  

### Risks

- Authors may request more methods early — resist expansion without security review  

### Deferred

- Fullscreen / orientation CONTROL methods  
- Events / subscriptions  
- Storage / network APIs  

---

## References

- `src/domain/experience-bridge.ts`  
- `src/features/experience-sandbox/bridge-host.ts`  
- `npm run test:runtime-experience-07`
