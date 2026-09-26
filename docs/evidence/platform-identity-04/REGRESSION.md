# PLATFORM-IDENTITY-04 — REGRESSION

**Date:** 2026-09-23

| Check | Result |
|-------|--------|
| `npm run test:platform-identity-04` | PASS (PI04-001…025 + SEC-PI04-001…010) |
| `npm test` (full suite incl. PI-04) | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 errors; pre-existing warnings only) |
| `npm run build` | PASS |
| auth / rbac (`test:rbac`, `test:security`) | PASS |
| tenant (`test:tenant`) | PASS |
| device (acceptance pairing + security device claims) | PASS |
| experience (`test:runtime-experience-01`…`11`) | PASS |

## Note

`test-runtime-experience-04` absences allowlist updated to recognise EX-11 player surfaces (`experience-slide.tsx`, `experience-controller.ts`) so the suite matches the already-validated EX-11 state. Not a Platform Identity behaviour change.

## Production

Development DB validated via `ensureSchema` + suite.  
Production deployment: **NOT PERFORMED**.
