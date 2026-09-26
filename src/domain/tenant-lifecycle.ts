/** PLATFORM-IDENTITY-09 — Tenant lifecycle domain (Control Plane operable gate). */

export const TENANT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export function isTenantStatus(value: unknown): value is TenantStatus {
  return (
    typeof value === "string" &&
    (TENANT_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Only ACTIVE is operable. Unknown / missing / SUSPENDED → fail closed.
 */
export function isTenantOperableStatus(status: string | null | undefined): boolean {
  return status === "ACTIVE";
}
