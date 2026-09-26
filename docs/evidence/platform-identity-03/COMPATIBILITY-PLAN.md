# PLATFORM-IDENTITY-03 — Compatibility Plan

## 1. Compatibility modes

| Mode | Flag | Behaviour |
|------|------|-----------|
| **Legacy** | `PLATFORM_IDENTITY_ENABLED=false` (default) | Exact today’s membership RBAC |
| **Dual** | `true` | Platform routes use platform axis; tenant routes unchanged |
| **Strict** (later) | optional | Deny platform console if assignment missing; still no effect on tenant app |

## 2. Client / session compatibility

- Existing cookies remain valid.  
- Old JWTs without platform hints continue to work; server resolves platform from DB when flag on.  
- Workspace switcher unchanged.  
- Device Bearer protocols unchanged.

## 3. API compatibility

| API class | Compatibility |
|-----------|---------------|
| `/api/admin/**` | Stable contracts; still tenant-scoped |
| `/api/device/**` | Unchanged |
| `/api/platform/**` | New; 404 if flag off |
| `/api/workspaces/switch` | Unchanged |

## 4. UI compatibility

- Existing admin nav unchanged when flag off.  
- Platform nav appears only if user has platform assignment **and** flag on.  
- Membership role labels may later show “Workspace Owner” for SUPER_ADMIN without enum change.

## 5. Test compatibility

- Keep `test:rbac`, `test:saas`, `test:security`, tenant IDOR suites green in Legacy mode.  
- Add parallel PI suites that run only when flag on in CI matrix.

## 6. Break-glass

If platform authz misbehaves in production: set flag **off**, recycle app, investigate.  
Tenant operations continue on membership path.
