# PLATFORM-IDENTITY-04 — CHECKLIST

## Acceptance

- [x] feature flag exists
- [x] default = false
- [x] feature flag server-side
- [x] flag cannot be user-controlled
- [x] Platform Identity schema exists
- [x] Platform Role separate from Tenant Role
- [x] Platform Identity status exists
- [x] integrity constraints exist
- [x] migration is additive
- [x] no automatic SUPER_ADMIN promotion
- [x] existing SUPER_ADMIN semantics unchanged
- [x] existing Memberships unchanged
- [x] existing Tenants unchanged
- [x] Device identity unchanged
- [x] Device Bearer unchanged
- [x] JWT unchanged
- [x] session unchanged
- [x] auth behavior unchanged
- [x] no Platform UI
- [x] no Platform APIs
- [x] no Billing
- [x] no Entitlements
- [x] no Campaigns
- [x] no Live Media
- [x] fixture: tenant SUPER_ADMIN remains tenant-scoped
- [x] fixture: Platform identity is explicit
- [x] security tests PASS *(filled by runner)*
- [x] migration tests PASS
- [x] regression PASS
- [x] typecheck / lint / build PASS
- [x] documentation complete

## Residual risks (PI-03) — PI-04 impact

| Risk | Status | Impact on PI-04 | Blocker? | Mitigation |
|------|--------|-----------------|----------|------------|
| `tenants.status` | Open (pre-existing) | None — PI-04 does not read/write tenant status for authz | NO | Defer to tenant lifecycle phase |
| seed | Stable | Seed not promoted to Platform | NO | Keep seed tenant-only; separate test fixture |
| `/x/` | Open (pre-existing) | No PI-04 coupling | NO | Experience remains isolated |
| login home | Open (pre-existing) | Login/JWT unchanged | NO | No session wiring in PI-04 |

## Architecture-Future

Platform Identity = Control Plane only. Not Device Runtime / Manifest / Experience / Playback / Billing / Campaigns / Live Media. RBAC ≠ Entitlement.
