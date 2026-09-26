# PI-10N Activation Procedure

## Pre-flight

1. Confirm Production `ENTITLEMENTS_ENABLED` unset/false.
2. Confirm Preview/Staging env target exists (separate from Production).
3. Run plan integrity SQL (one ACTIVE TenantPlan; valid definitions).
4. For each cohort tenant: bind plan with `devices.enabled`, `devices.max`, `storage.maxBytes`.
5. Capture baseline usage CSV (devices PAIRED_NON_DISABLED; storage committed/reserved).

## Activate (Preview only)

1. Set `ENTITLEMENTS_ENABLED=true` on Preview/Staging only.
2. Redeploy Preview (not Production).
3. Smoke: pair under max; pair at max DENY; upload under max; over DENY; suspended DENY.
4. Confirm baseline resources unchanged.

## Rollback

1. Set `ENTITLEMENTS_ENABLED=false` (or delete) on Preview.
2. Redeploy Preview.
3. Confirm legacy pair/upload without plan.

## Never

- Edit Production env for this flag in PI-10N
- Auto-backfill commercial limits
- Delete/disable existing devices or MediaAssets on activation
