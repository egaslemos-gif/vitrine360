# PI-10P Topology

## Current (BLOCKED)

```
Production
  database: Turso (target=production) SET
  storage:  R2 bucket (target=production) SET
  ENTITLEMENTS_ENABLED: UNSET

Preview (Vercel)
  database: NOT SET
  storage:  NOT SET on Vercel (Cloudflare bucket vitrine360-preview EXISTS)
  AUTH_SECRET: NOT SET
  ENTITLEMENTS_ENABLED: false (SET)
```

## Target (after unblock)

```
Preview
  database: Turso `vitrine360-preview` (dedicated)
  storage:  R2 `vitrine360-preview`
  AUTH_SECRET: Preview-only
  ENTITLEMENTS_ENABLED: false → true → false (cohort)
```
