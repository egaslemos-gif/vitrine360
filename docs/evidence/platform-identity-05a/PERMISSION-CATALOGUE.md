# PLATFORM-IDENTITY-05A — Platform Permission Catalogue (PI-05 scope)

## In scope for PI-05B

| Permission | PLATFORM_SUPER_ADMIN |
|------------|:--------------------:|
| `platform.tenants.read` | ✓ |

## Explicitly out of scope (do not implement in PI-05B)

- `platform.tenants.manage` / `suspend`  
- `platform.staff.manage` (ops may use repository directly until gated)  
- `platform.support.session.start`  
- All `plans.*` / `pricing.*` / `subscriptions.*` / `billing.*` / `entitlements.*`  
- Any injection into tenant `PERMISSIONS`

## Mapping rule

```text
platform_assignments.role (ACTIVE)
        │
        ▼
PLATFORM_ROLE_PERMISSIONS[role]  // static
        │
        ▼
hasPlatformPermission(ctx, perm)
```

Invalid / unknown roles in DB must yield **no** permissions (fail closed).
