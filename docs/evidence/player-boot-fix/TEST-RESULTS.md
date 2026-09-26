# TEST-RESULTS — Player Boot Fix

**Date:** 2026-09-24

| Gate | Result |
|------|--------|
| `node scripts/diag-tv-es5-boot.mjs` (acorn ES5 + trailing call commas) | **PASS** |
| `tsc --noEmit` | **PASS** |
| `npm run lint` | **PASS** (0 errors; pre-existing warnings) |
| `npm run build` | **PASS** |
| `test:content-templates-01` (+ CLOCK-LEGACY parity) | **PASS** |
| `test:runtime-experience-11` | **PASS** |
| `test:runtime-policy-08b` | **PASS** |
| Production `tv.js?v=051` HTTP 200 + VERSION 0.1.23 | **PASS** |
| Production trailing call comma absent | **PASS** |
| Hisense physical A–E | **PENDING** (operator) |

## Assertions added

- Shell / SW / VERSION aligned on **v051** / **0.1.23-smarttv-static**
- No trailing comma in analog `setInterval(applyHands, …)` call

## Boot logic (static review)

| ID | Check | Evidence |
|----|-------|----------|
| BOOT-001 | Paired + token → playback, no pairing | `tv.js` boot: `existing.deviceToken` → `startPlayback` |
| BOOT-002 | Never paired → pairing | fallthrough `startPairing` |
| BOOT-003 | Explicit reset | reserved; not on normal boot |
| BOOT-004 | 401 → clear + reload | `handleUnauthorized` |
| BOOT-005/006 | Sync fail ≠ clear identity | sync errors reject; no `writeConfig(null)` on sync fail |
| BOOT-007 | SyntaxError | trailing call comma removed; acorn ES5 PASS |
