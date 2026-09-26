# PLATFORM-IDENTITY-10O — Preview Entitlements Operations

**Status:** **VALIDATED WITH ENVIRONMENT LIMITATION** / superseded by PI-10P Preview validation  
**Scope:** Controlled Preview activation pipeline for `ENTITLEMENTS_ENABLED`  
**Production:** `ENTITLEMENTS_ENABLED` = **UNSET / OFF** (never modified in this phase)

## 1. Verdict summary

Operational pipeline logic (baseline OFF → ON → quota/concurrency/dedupe/downgrade/suspend/fail-closed → OFF rollback) is proven on an **isolated local Preview DB** (`data/pi10o-preview.db`) with local media.

Live Vercel Preview deploy with full isolated stack was **not** executed: Preview lacked `DATABASE_URL` / auth / R2 env (only `ENTITLEMENTS_ENABLED=false` was set on Preview). Copying Production DB/R2 into Preview would violate isolation STOP rules.

## 2. Preview topology (Phase A)

| Item | Value |
|------|--------|
| Project | `vitrine360` / `prj_fcQMbXzU4QF9VmhuTi9aRWMnX032` |
| Team | `team_zlb5wVNBDSFfaw25G2WS5Z7c` |
| Custom environments | none |
| Production deployment | READY (latest `dpl_ApP66evgkpos6VhKkUjHh2wctwwW`) |
| Preview mechanism | git branch Preview deployments (no recent Preview deploys in listing) |

```
Production
    ↓
database: Turso (DATABASE_URL / TURSO_* target=production) — SET
storage:  R2 bucket (R2_* target=production) — SET
ENTITLEMENTS_ENABLED: UNSET → OFF

Preview (Vercel env)
    ↓
database: NOT SET (no Preview DATABASE_URL)
storage:  NOT SET on Vercel Preview (dedicated bucket exists in Cloudflare)
ENTITLEMENTS_ENABLED: false (SET, target=preview only)
```

## 3. Isolation decisions

| Concern | Decision |
|---------|----------|
| Preview DB | Prefer separate DB. **Not wired on Vercel** — suite uses file DB `pi10o-preview.db` |
| Preview R2 | Bucket `vitrine360-preview` **created**; PUT/HEAD/DELETE probe OK |
| Production | No env/DB/R2/tenant mutations |

Residual: R2 API keys are account-scoped; app isolation depends on `R2_BUCKET_NAME`. Preview Vercel must never receive Production DB URL.

## 4. Staging plans (Phase E)

Technical plan key pattern: `staging_entitlements_test_*` (not a commercial SKU).

Bindings:

| Key | Type | Enforcement | Value (TENANT-A) |
|-----|------|-------------|------------------|
| `devices.enabled` | BOOLEAN | FEATURE_GATE | true |
| `devices.max` | INTEGER | HARD_LIMIT | 2 |
| `storage.maxBytes` | BYTES | HARD_LIMIT | 1MB |

TENANT-B: different limits (5 devices / 2MB).  
TENANT-C: `devices.enabled` only → quantitative fail-closed under flag ON.

## 5. Pipeline evidence

Executed in `npm run test:platform-identity-10o` (isolated):

OFF baseline → ON → device/storage cohorts → dedupe → concurrency → downgrade → suspend → Tenant-C fail-closed → OFF rollback → integrity + SEC-001..010.

Live Preview deploy OFF/ON: **not executed** (ENVIRONMENT LIMITATION).

## 6. Production safety

| Check | Result |
|-------|--------|
| Production `ENTITLEMENTS_ENABLED` | UNSET |
| Production env mutated | No |
| Production DB written by suite | No (Turso aliases cleared) |
| Production R2 written by suite | No (local media; probe used `vitrine360-preview` only) |
| Auto-promote Preview→Production | No |

## 7. Evidence

`docs/evidence/platform-identity-10o/` · ADR `docs/adr/ADR-PLATFORM-IDENTITY-010O.md`

## Next

**PI-10P (proposed):** Provision isolated Preview Turso + Preview-only secrets (never Production URLs) → real Preview deploy OFF→ON→cohort→OFF with production-safety re-audit. Commercial Billing remains out of scope.
