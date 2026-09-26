# TENANT-ISOLATION — PI-10C

Queries for ACTIVE TenantPlan always filter `tenant_id = :tenantId`.

Plan catalogue is global; association Tenant→Plan is tenant-scoped.

Test: Tenant A → Plan A entitlements; Tenant B → Plan B; `resolve(A)` does not contain B’s values (`PI10C-RESOLVER-13`).
