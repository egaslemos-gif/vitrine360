# ROLE AND PERMISSION AUDIT

## Evidência Encontrada

O sistema utiliza matrizes estáticas para definição de permissões baseadas no perfil do utilizador (RBAC). A autorização ao nível do Tenant e da Plataforma estão completamente separadas.

### 1. Tenant Memberships (`src/domain/types.ts`)

A lista oficial de roles para membros de um Workspace (Tenant) é:
- `SUPER_ADMIN`
- `ADMIN`
- `EDITOR`
- `OPERATOR`
- `VIEWER`

A lista de permissões disponíveis:
- `manage_users`
- `manage_devices`
- `manage_contents`
- `manage_playlists`
- `manage_schedules`
- `view_logs`
- `view_dashboard`

A matriz exacta declarada em `ROLE_PERMISSIONS` (`src/domain/types.ts:23`):

```typescript
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN: PERMISSIONS,
  EDITOR: [
    "manage_contents",
    "manage_playlists",
    "manage_schedules",
    "view_dashboard",
    "view_logs",
  ],
  OPERATOR: [
    "manage_devices",
    "manage_playlists",
    "manage_schedules",
    "view_dashboard",
    "view_logs",
  ],
  VIEWER: ["view_dashboard", "view_logs"],
};
```

### 2. Platform Identity (`src/domain/platform-identity.ts`)

Os papéis da Plataforma são independentes dos papéis de Tenant.

```typescript
export const PLATFORM_ROLES = ["PLATFORM_SUPER_ADMIN"] as const;

export const PLATFORM_ROLE_PERMISSIONS: Record<PlatformRole, readonly PlatformPermission[]> = {
  PLATFORM_SUPER_ADMIN: [
    "platform.tenants.read",
    "platform.tenants.suspend",
  ],
};
```

**Nota sobre `SUPER_ADMIN` vs `PLATFORM_SUPER_ADMIN`:**
Conforme documentado em `src/domain/platform-identity.ts:38`, o role `SUPER_ADMIN` é exclusivamente de Tenant (workspace) e não garante qualquer acesso ao Control Plane (Platform). A função `tenantRoleIsNotPlatformRole` reforça esta distinção.

### 3. Avaliação de Permissões (`src/lib/auth.ts`)

O guard primário das APIs é `requireSession(permission?)`.
Se uma permissão for passada, a função avalia:
```typescript
if (permission && !hasPermission(session.role, permission)) {
  throw new AuthError("Forbidden", 403);
}
```

A avaliação é puramente baseada no Role do utilizador activo no momento do acesso.
Nenhuma das verificações de permissões faz qualquer "bypass" ou excepção explícita para o perfil `SUPER_ADMIN` que não esteja declarada em `ROLE_PERMISSIONS`.
