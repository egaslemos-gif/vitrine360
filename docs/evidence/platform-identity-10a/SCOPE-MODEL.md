# PLATFORM-IDENTITY-10A — Scope Model

```text
┌────────────────────────────────────────────────────────────┐
│ PLATFORM SCOPE                                             │
│  Plans · EntitlementDefinitions · PlanEntitlements         │
│  Platform staff · platform.plans.* / entitlements.* (fut.) │
│  Tenant lifecycle suspend (PI-09)                          │
└───────────────────────────┬────────────────────────────────┘
                            │ assigns TenantPlan
┌───────────────────────────▼────────────────────────────────┐
│ TENANT SCOPE                                               │
│  TenantPlan binding · Overrides (read) · Usage meters      │
│  Membership RBAC · Devices/Content/…                       │
│  Consumes EffectiveEntitlements — does not author Plans    │
└────────────────────────────────────────────────────────────┘
```

| Object | Scope | Tenant-readable? | Tenant-writable? |
|--------|-------|------------------|------------------|
| Plan catalogue | PLATFORM | Optional summary later | No |
| Entitlement definitions | PLATFORM | No (consume effective only) | No |
| TenantPlan | TENANT | Own only | No (Platform/Billing) |
| Overrides | TENANT | Own effective view | No |
| Usage | TENANT | Own only | System write |
| RBAC membership | TENANT | Per membership rules | Per RBAC |
| Lifecycle status | TENANT row | Visible | Platform only |
