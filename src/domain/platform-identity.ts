/** PLATFORM-IDENTITY-04 — Platform Identity domain (Control Plane). No Billing/Entitlements. */

/** Distinct from tenant Membership roles (SUPER_ADMIN, ADMIN, …). */
export const PLATFORM_ROLES = ["PLATFORM_SUPER_ADMIN"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_IDENTITY_STATUSES = [
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
] as const;
export type PlatformIdentityStatus =
  (typeof PLATFORM_IDENTITY_STATUSES)[number];

export function isPlatformRole(value: unknown): value is PlatformRole {
  return (
    typeof value === "string" &&
    (PLATFORM_ROLES as readonly string[]).includes(value)
  );
}

export function isPlatformIdentityStatus(
  value: unknown,
): value is PlatformIdentityStatus {
  return (
    typeof value === "string" &&
    (PLATFORM_IDENTITY_STATUSES as readonly string[]).includes(value)
  );
}

/** Only ACTIVE can produce platform authority in future phases. */
export function isActivePlatformStatus(
  status: PlatformIdentityStatus,
): boolean {
  return status === "ACTIVE";
}

/**
 * Tenant Membership role SUPER_ADMIN must never be treated as a Platform role.
 */
export function tenantRoleIsNotPlatformRole(tenantRole: string): boolean {
  return !(PLATFORM_ROLES as readonly string[]).includes(tenantRole);
}

/** PI-05B/09 — Platform RBAC catalogue. Never mix into tenant PERMISSIONS. */
export const PLATFORM_PERMISSIONS = [
  "platform.tenants.read",
  "platform.tenants.suspend",
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly PlatformPermission[]
> = {
  PLATFORM_SUPER_ADMIN: [
    "platform.tenants.read",
    "platform.tenants.suspend",
  ],
};

export function isPlatformPermission(
  value: unknown,
): value is PlatformPermission {
  return (
    typeof value === "string" &&
    (PLATFORM_PERMISSIONS as readonly string[]).includes(value)
  );
}

export function hasPlatformPermission(
  roles: readonly PlatformRole[],
  permission: PlatformPermission,
): boolean {
  for (const role of roles) {
    const granted = PLATFORM_ROLE_PERMISSIONS[role];
    if (granted?.includes(permission)) return true;
  }
  return false;
}

/** Fail-closed: unknown DB role strings grant nothing. */
export function platformPermissionsForRoles(
  roles: readonly string[],
): PlatformPermission[] {
  const set = new Set<PlatformPermission>();
  for (const role of roles) {
    if (!isPlatformRole(role)) continue;
    for (const p of PLATFORM_ROLE_PERMISSIONS[role]) set.add(p);
  }
  return [...set];
}
