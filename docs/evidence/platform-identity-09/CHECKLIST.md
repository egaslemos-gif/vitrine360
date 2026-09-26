# PLATFORM-IDENTITY-09 — Checklist

| Item | Status |
|------|--------|
| Domain `TENANT_STATUSES` + fail-closed operable | Done |
| `platform.tenants.suspend` permission | Done |
| `suspendTenant` / `reactivateTenant` + audit | Done |
| POST suspend / reactivate APIs (flag + rate limit) | Done |
| Console lifecycle actions | Done |
| Gate: `getSession` / `sessionFromUser` | Done |
| Gate: `resolveTenantAuthz` | Done |
| Gate: workspace switch | Done |
| Gate: `authenticateDevice` (sync/manifest/heartbeat/media/admit) | Done |
| Gate: `/x/` experience serve | Done |
| No hard delete API | Done |
| JWT unchanged (no status claims) | Done |
| Suite `test:platform-identity-09` TL-I* | PASS |
| Regressions PI-04 / 05B / 06B / 07 | PASS |
| `tsc --noEmit` | PASS |
