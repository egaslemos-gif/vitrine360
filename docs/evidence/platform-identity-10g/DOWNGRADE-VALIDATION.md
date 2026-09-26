# DOWNGRADE-VALIDATION — PI-10G

Policy: **BLOCK NEW + ALLOW EXISTING** (DEC-08). No grace period. No auto-disable/delete/suspend.

Verified in `scripts/test-platform-identity-10g.ts`:

- Plan max 5 → usage 5, then ACTIVE TenantPlan swapped to max 2
- Usage remains 5; tenant stays ACTIVE; devices retained
- New `pairDevice` → `QUOTA_EXCEEDED`
- DELETE / DISABLE still ALLOW
- Reactivate while over → DENY
- After frees bring usage below max → reactivate/pair ALLOW
