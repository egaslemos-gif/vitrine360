# RUNTIME-EXPERIENCE-07 Bridge Checklist

**Date:** 2026-09-27T18:48:31.373Z
**Verdict:** CONTROLLED BRIDGE VALIDATED

## Acceptance

- [x] exact source validation
- [x] exact origin validation
- [x] targetOrigin explicit
- [x] no wildcard
- [x] protocol version
- [x] message envelope
- [x] requestId
- [x] schema validation
- [x] method allowlist
- [x] permission check
- [x] capability check (infrastructure)
- [x] deny-by-default
- [x] rate limit
- [x] timeout (documented; V1 sync)
- [x] cancellation/cleanup on stop
- [x] structured errors
- [x] no tokens / cookies / DB / storage / network proxy / RPC
- [x] no dynamic dispatch
- [x] tenant / multi-iframe isolation
- [x] lifecycle cleanup
- [x] browser E2E matrix
- [x] no playback mutation / Player integration
- [x] Fullscreen/Orientation CONTROL = DEFERRED

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-BR-001 | PASS | docs + ADR |
| TEST-A | PASS | runtime.getInfo PASS |
| TEST-B | PASS | runtime.getViewport PASS |
| TEST-C | PASS | unknown method DENY |
| TEST-D | PASS | malformed params DENY |
| TEST-E | PASS | wrong origin DENY |
| TEST-F | PASS | wrong source DENY |
| TEST-G | PASS | wrong protocol DENY |
| TEST-H | PASS | missing requestId DENY |
| TEST-I | PASS | oversized DENY |
| TEST-J | PASS | rate limit DENY |
| TEST-K | PASS | timeout policy documented (V1 sync handlers) |
| TEST-L | PASS | duplicate requestId DENY |
| TEST-M-P | PASS | HTTP/token/storage/device DENY |
| TEST-Q | PASS | cross-iframe/tenant DENY |
| TEST-R | PASS | second iframe spoof DENY |
| TEST-S | PASS | unload cleanup |
| TEST-T | PASS | no wildcard targetOrigin |
| BRIDGE-SEC-006 | PASS | permission deny-by-default |
| BRIDGE-SEC-lifecycle | PASS | CREATED denies |
| EXP-BR-absences | PASS | no Player/HTML_APP/secrets |
| EXP-BR-deferred-fs | PASS | Fullscreen/Orientation CONTROL DEFERRED |
| EXP-BR-E2E | PASS | playwright cross-origin postMessage + spoof matrix |
