# CHECKLIST — PI-10D

- [x] Central `enforceEntitlement`
- [x] Consumes PI-10C resolve (no PlanEntitlement in APIs)
- [x] Typed ALLOW/DENY + reasons
- [x] Flag OFF legacy; ON fail-closed
- [x] Pilot: `devices.enabled` on `pairDevice` only
- [x] HTTP 403 ENTITLEMENT_DENIED
- [x] Compatibility seed `devices.enabled=true`
- [x] No devices.max / Usage / Billing / JWT / Device Bearer changes
- [x] Tests + docs + ADR

**ENTITLEMENTS_ENABLED remains OFF unless explicitly authorized for activation.**
