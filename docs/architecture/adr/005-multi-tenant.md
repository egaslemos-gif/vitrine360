# Multi-tenant foundation (MVP)

## In scope

- `tenants` table (id, name, slug, status)
- `tenant_id` required on org-scoped entities
- Session JWT carries `tenantId`
- All Admin list/create/update queries scoped by `tenantId`
- Device pairing inherits admin's tenant
- Device API remains token-scoped (device already belongs to one tenant)
- Isolation tests (tenant A ≠ tenant B data)

## Out of scope (MVP)

- Billing, subscriptions, commercial plans
- Tenant self-signup marketplace
- Cross-tenant super-admin console UI
- Workspace nesting / multiple workspaces per tenant
