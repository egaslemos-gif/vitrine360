# CHECKLIST — PI-10B

- [x] EntitlementDefinition schema
- [x] Plan schema (no tenant_id / price)
- [x] PlanEntitlement schema + unique
- [x] TenantPlan schema + one ACTIVE per tenant (service)
- [x] Domain types + value parser
- [x] ENTITLEMENTS_ENABLED flag
- [x] Compatibility default plan seed
- [x] Migration `0007_entitlements.sql` + ensureSchema
- [x] Tests `test:platform-identity-10b`
- [x] Docs + ADR + evidence
- [x] No enforcement / billing / RBAC / JWT / playback changes

PI-10B NÃO implementa enforcement.
