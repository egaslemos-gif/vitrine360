import { and, asc, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { memberships, tenants, users, type Membership } from "@/db/schema";
import type { UserRole } from "@/domain/types";
import { USER_ROLES } from "@/domain/types";

export const MEMBERSHIP_STATUSES = ["ACTIVE", "INVITED", "SUSPENDED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

function isRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export async function listMemberships(userId: string) {
  await ensureSchema();
  return db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      tenantId: memberships.tenantId,
      role: memberships.role,
      status: memberships.status,
      createdAt: memberships.createdAt,
      updatedAt: memberships.updatedAt,
      tenantName: tenants.name,
      tenantSlug: tenants.slug,
    })
    .from(memberships)
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));
}

export async function getMembership(userId: string, tenantId: string) {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

/**
 * Active membership for a session. INVITED and SUSPENDED cannot authorize.
 * When several are active and none is preferred, the oldest row wins.
 */
export async function resolveActiveMembership(
  userId: string,
  preferredTenantId?: string | null,
): Promise<Membership | null> {
  const rows = await listMemberships(userId);
  const active = rows.filter((row) => row.status === "ACTIVE");
  if (!active.length) return null;
  if (preferredTenantId) {
    const preferred = active.find((row) => row.tenantId === preferredTenantId);
    if (!preferred) return null;
    return preferred;
  }
  return active[0];
}

export async function createMembership(params: {
  userId: string;
  tenantId: string;
  role: UserRole;
  status?: MembershipStatus;
}) {
  await ensureSchema();
  const existing = await getMembership(params.userId, params.tenantId);
  if (existing) {
    await db
      .update(memberships)
      .set({
        role: params.role,
        status: params.status ?? existing.status,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(memberships.id, existing.id));
    return existing.id;
  }
  const id = crypto.randomUUID();
  await db.insert(memberships).values({
    id,
    userId: params.userId,
    tenantId: params.tenantId,
    role: params.role,
    status: params.status ?? "ACTIVE",
  });
  return id;
}

export async function updateMembershipRole(
  userId: string,
  tenantId: string,
  role: UserRole,
) {
  await ensureSchema();
  await db
    .update(memberships)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(and(eq(memberships.userId, userId), eq(memberships.tenantId, tenantId)));
  const [user] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (user?.tenantId === tenantId) {
    await db
      .update(users)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));
  }
}

export function membershipRole(row: { role: string }): UserRole {
  if (!isRole(row.role)) {
    throw new Error("Invalid membership role");
  }
  return row.role;
}
