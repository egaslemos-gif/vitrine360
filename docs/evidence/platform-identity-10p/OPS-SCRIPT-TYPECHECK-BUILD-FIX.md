# PI-10P — Ops Script Typecheck / Build Fix

**Date:** 2026-09-25  
**Verdict:** **HIGH BLOCKER RESOLVED**  
**Production deploy executed:** **no**

## Baseline (BEFORE)

| Command | Exit |
|---------|------|
| `npm run typecheck` | **1** |
| `npm run build` | **1** (Next TypeScript phase) |
| `npm run lint` | 0 (0 errors / 92 warnings) |

### Error class

**A. TypeScript type error** (identical for typecheck and build)

| File | Error |
|------|--------|
| `scripts/activate-pi10p-production-pilot.ts` | TS2367 host compare; TS2352 `Row[]` cast |
| `scripts/baseline-pi10p-production-pre-activation.ts` | TS2367 host compare |
| `scripts/smoke-pi10p-production-off.ts` | TS2367; TS2352 |
| `scripts/validate-pi10p-production-on.ts` | TS2367; TS2352 |
| `scripts/review-pi10p-production-cohort-expansion.ts` | TS2367; TS2352 |

Root cause:

1. After `host !== PRODUCTION_HOST`, TypeScript narrows `host` to the Production literal, so `host === PREVIEW_HOST` is flagged as impossible (TS2367).
2. `@libsql/client` `Row[]` is not assignable to concrete object arrays without `unknown` (TS2352).

`tsconfig.json` includes `**/*.ts`, so ops scripts are part of the project typecheck/build contract — fix types rather than exclude.

Category: **A** (not missing deps, not wrong exclusion, not runtime).

## Minimal fix

- Split Production vs Preview host guards (preview check uses `(host as string) === PREVIEW_HOST`).
- Cast query rows via `as unknown as Array<…>`.

No application/`src` changes. No schema, entitlements, quota, RBAC, JWT, R2, or Production data changes.

## AFTER

| Command | Exit |
|---------|------|
| `npm run typecheck` | **0** |
| `npm run lint` | **0** (0 errors / 92 warnings) |
| `npm run build` | **0** |

## PI-10P regression

All requested suites exit **0**: 10B–10D, 10I–10L, 10N, 10O, 04, 05B, 06B, 07, 09.

## Production integrity (read-only)

| Check | Result |
|-------|--------|
| Production `ENTITLEMENTS_ENABLED` env | **true** (Vercel) |
| Live deployment | `dpl_GSh3MXryZLeFWvDTMY5gRoV9SJd6` (unchanged) |
| Active TenantPlans | **1** (`egaslemos` / `pi10p_production_pilot`) |
| demo TenantPlans | **0** |
| Integrity script | **PASS** |
| Mutations this phase | **none** |

## Deployment

| Question | Answer |
|----------|--------|
| Fix is tooling/ops only? | **yes** (A) |
| Affects Production runtime bundle? | **no** (scripts not shipped as app routes) |
| Production deployment required? | **no** |
| Production deployment executed? | **no** |

## Findings

| Severity | Item |
|----------|------|
| INFO | Scripts remain in root `tsconfig` include — intentional contract |
| INFO | Lint still 92 warnings (pre-existing; 2 unused in review script non-blocking) |
| MEDIUM | R2 residual unchanged |

## Release gate

- [x] Root cause identified  
- [x] Minimal fix applied  
- [x] Typecheck PASS  
- [x] Lint PASS / 0 errors  
- [x] Build PASS  
- [x] PI-10P regressions PASS  
- [x] No schema / data / cohort / semantic changes  
- [x] Production integrity PASS  
- [x] Documentation updated  
