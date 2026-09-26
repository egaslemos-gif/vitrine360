# CHECKLIST — PI-10C

- [x] EffectiveEntitlements DTO (not raw DB rows)
- [x] `resolveEffectiveEntitlements` read-only
- [x] Typed statuses + diagnostics
- [x] Active plan only; no silent default fallback
- [x] Inactive definitions ignored
- [x] PI-10B value parser reused
- [x] Deterministic key ordering
- [x] Tenant isolation
- [x] No overrides / usage / billing / cache
- [x] No resource API wiring / enforcement
- [x] Tests `test:platform-identity-10c`
- [x] Docs + ADR + evidence

**PI-10C RESOLVE — PI-10D ENFORCES.**
