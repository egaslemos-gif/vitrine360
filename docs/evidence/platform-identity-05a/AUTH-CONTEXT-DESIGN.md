# PLATFORM-IDENTITY-05A — AuthContext Design

## Shape

```text
AuthContext
├── userId, email, name
├── tenant: null | { tenantId, role, permissions[] }
├── platform: null | { roles[], permissions[] }
└── flag.platformIdentityEnabled
```

## Resolve algorithm

1. Read session cookie → verify JWT.  
2. Extract `sub` + claimed tenant id.  
3. Load user; fail → null / 401.  
4. Tenant axis: ACTIVE membership for claimed tenant → map `ROLE_PERMISSIONS`.  
5. If flag OFF: `platform = null` (or empty permissions).  
6. If flag ON: ACTIVE `platform_assignments` → map `PLATFORM_ROLE_PERMISSIONS`.  
7. Return context. **Do not** embed platform data in a new JWT.

## Call-site guidance

| Need | Call |
|------|------|
| Existing admin page/API | Keep `getSession` / `requireSession` |
| Platform route | `getAuthContext` + `requirePlatformPermission` |
| “Am I platform staff?” UI hint (later) | Server-derived from AuthContext; not JWT |

## Intersection rule

Platform permission **does not** substitute for tenant permission on tenant resources.  
Tenant permission **does not** substitute for platform permission on platform routes.
