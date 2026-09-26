# ADR-PLATFORM-IDENTITY-010O — Preview Entitlements Operations

## Status

Accepted — VALIDATED WITH ENVIRONMENT LIMITATION

## Context

PI-10N proved non-production activation readiness and documented that `compatibility_default` lacks quantitative max bindings. PI-10O executes the controlled Preview ops pipeline without touching Production.

## Decision

1. Production `ENTITLEMENTS_ENABLED` remains UNSET/OFF for the entire phase.
2. Preview may set `ENTITLEMENTS_ENABLED=false` then (when fully isolated) `true` — never on Production.
3. Staging technical plans (`staging_entitlements_test`) must bind `devices.enabled`, `devices.max`, and `storage.maxBytes` for cohort tenants; Tenant C without quantitative max proves fail-closed.
4. If Preview DB/R2 cannot be proven isolated from Production, do **not** copy Production secrets to Preview and do **not** simulate a live Preview deployment ID — declare ENVIRONMENT LIMITATION and prove the pipeline on an isolated local DB.
5. Dedicated Cloudflare bucket `vitrine360-preview` is the Preview storage namespace; Production remains the existing `vitrine360` bucket.

## Consequences

- Full VALIDATED (no limitation) requires Preview `DATABASE_*` + Preview R2 env wired to non-Production resources, then real Preview deploys OFF→ON→OFF.
- Account-scoped R2 keys remain a residual risk until bucket-scoped credentials exist.
- Next phase should provision isolated Preview Turso before flag ON cohort on Vercel.
