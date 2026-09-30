# RUNTIME-EXPERIENCE-10 Runtime Core Checklist

**Date:** 2026-09-29T22:07:19.072Z
**Verdict:** RUNTIME CORE VALIDATED

## Acceptance

- [x] Admission grant required to start
- [x] Entrypoint from Dedicated Origin /x/
- [x] Src safety enforced
- [x] Lifecycle LOAD→ACTIVE→STOP
- [x] Load timeout fail-closed
- [x] Kill switch without Experience cooperation
- [x] Privilege matrix DENY/DEFERRED
- [x] Bridge RUNTIME_READ only (via plan)
- [x] No Player / playlist / schedule / CONTENT_TYPES
- [x] No secrets in snapshot
- [x] Safe fallback when not mounting

## Automated checks

| ID | Result | Detail |
|----|--------|--------|
| EXP-RT-001 | PASS | docs + ADR |
| TEST-A | PASS | plan entrypoint + bridge READ |
| TEST-B | PASS | evil host DENY |
| TEST-C | PASS | LOAD→ACTIVE→STOP |
| TEST-D | PASS | LOAD_TIMEOUT |
| TEST-E | PASS | KILL without cooperation |
| TEST-F | PASS | double start DENY |
| TEST-G | PASS | privilege matrix DENY |
| TEST-H | PASS | transition table |
| TEST-I | PASS | summary no secrets |
| TEST-J | PASS | LOAD_FAILED |
| EXP-RT-absences | PASS | no Player/HTML_APP/secrets; EX-09 absent |
| EXP-RT-prior | PASS | EX-06/07/08 intact |
