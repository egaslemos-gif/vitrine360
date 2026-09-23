import { and, asc, count, eq, inArray, ne } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { memberships, users } from "@/db/schema";
import type { UserRole } from "@/domain/types";
import { USER_ROLES } from "@/domain/types";
import type { MembershipStatus } from "@/services/memberships";
import { getMembership, membershipRole } from "@/services/memberships";
import { logActivity } from "@/services/activity-log";

const ADMIN_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

export class MembershipError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

function assertRole(role: string): UserRole {
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new MembershipError("Role inválida", 400);
  }
  return role as UserRole;
}

export async function listWorkspaceMembers(tenantId: string) {
  await ensureSchema();
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      status: memberships.status,
      membershipId: memberships.id,
      createdAt: memberships.createdAt,
      updatedAt: memberships.updatedAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.tenantId, tenantId))
    .orderBy(asc(memberships.createdAt), asc(memberships.id));
}

export async function countActiveAdmins(
  tenantId: string,
  exceptUserId?: string,
) {
  await ensureSchema();
  const conditions = [
    eq(memberships.tenantId, tenantId),
    eq(memberships.status, "ACTIVE"),
    inArray(memberships.role, ADMIN_ROLES),
  ];
  if (exceptUserId) {
    conditions.push(ne(memberships.userId, exceptUserId));
  }
  const [row] = await db
    .select({ value: count() })
    .from(memberships)
    .where(and(...conditions));
  return Number(row?.value ?? 0);
}

async function assertNotLastAdmin(
  tenantId: string,
  targetUserId: string,
  next: { role?: UserRole; status?: MembershipStatus; removing?: boolean },
) {
  const current = await getMembership(targetUserId, tenantId);
  if (!current) throw new MembershipError("Membro não encontrado", 404);
  const currentRole = membershipRole(current);
  const isActiveAdmin =
    current.status === "ACTIVE" && ADMIN_ROLES.includes(currentRole);
  if (!isActiveAdmin) return;

  const wouldLoseAdmin =
    next.removing === true ||
    (next.status !== undefined && next.status !== "ACTIVE") ||
    (next.role !== undefined && !ADMIN_ROLES.includes(next.role));

  if (!wouldLoseAdmin) return;

  const remaining = await countActiveAdmins(tenantId, targetUserId);
  if (remaining < 1) {
    throw new MembershipError(
      "O workspace precisa de pelo menos um ADMIN activo",
      409,
    );
  }
}

async function assertOperatorCanManage(
  operatorId: string,
  tenantId: string,
) {
  const op = await getMembership(operatorId, tenantId);
  if (!op || op.status !== "ACTIVE") {
    throw new MembershipError("Workspace não autorizado", 403);
  }
  const role = membershipRole(op);
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new MembershipError("Forbidden", 403);
  }
  return role;
}

export async function changeMemberRole(params: {
  operatorId: string;
  operatorRole: UserRole;
  tenantId: string;
  targetUserId: string;
  role: UserRole;
}) {
  await ensureSchema();
  const operatorRole = await assertOperatorCanManage(
    params.operatorId,
    params.tenantId,
  );
  if (params.operatorId === params.targetUserId) {
    throw new MembershipError("Não pode alterar a própria role", 403);
  }
  const role = assertRole(params.role);
  if (role === "SUPER_ADMIN" && operatorRole !== "SUPER_ADMIN") {
    throw new MembershipError(
      "Apenas SUPER_ADMIN pode atribuir SUPER_ADMIN",
      403,
    );
  }
  const target = await getMembership(params.targetUserId, params.tenantId);
  if (!target) throw new MembershipError("Membro não encontrado", 404);

  await assertNotLastAdmin(params.tenantId, params.targetUserId, { role });

  await db
    .update(memberships)
    .set({ role, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(memberships.userId, params.targetUserId),
        eq(memberships.tenantId, params.tenantId),
      ),
    );

  const [user] = await db
    .select({ tenantId: users.tenantId })
    .from(users)
    .where(eq(users.id, params.targetUserId))
    .limit(1);
  if (user?.tenantId === params.tenantId) {
    await db
      .update(users)
      .set({ role, updatedAt: new Date().toISOString() })
      .where(eq(users.id, params.targetUserId));
  }

  await logActivity({
    userId: params.operatorId,
    tenantId: params.tenantId,
    action: "MEMBER_ROLE_CHANGED",
    resource: "membership",
    resourceId: target.id,
    metadata: { targetUserId: params.targetUserId, role },
  });
}

export async function setMemberStatus(params: {
  operatorId: string;
  tenantId: string;
  targetUserId: string;
  status: Extract<MembershipStatus, "ACTIVE" | "SUSPENDED">;
}) {
  await ensureSchema();
  await assertOperatorCanManage(params.operatorId, params.tenantId);
  if (params.operatorId === params.targetUserId) {
    throw new MembershipError("Não pode suspender a própria membership", 403);
  }
  const target = await getMembership(params.targetUserId, params.tenantId);
  if (!target) throw new MembershipError("Membro não encontrado", 404);

  if (params.status === "SUSPENDED") {
    await assertNotLastAdmin(params.tenantId, params.targetUserId, {
      status: "SUSPENDED",
    });
  }

  await db
    .update(memberships)
    .set({ status: params.status, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(memberships.userId, params.targetUserId),
        eq(memberships.tenantId, params.tenantId),
      ),
    );

  await logActivity({
    userId: params.operatorId,
    tenantId: params.tenantId,
    action:
      params.status === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_ACTIVATED",
    resource: "membership",
    resourceId: target.id,
    metadata: { targetUserId: params.targetUserId },
  });
}

export async function removeMember(params: {
  operatorId: string;
  tenantId: string;
  targetUserId: string;
}) {
  await ensureSchema();
  await assertOperatorCanManage(params.operatorId, params.tenantId);
  if (params.operatorId === params.targetUserId) {
    throw new MembershipError("Não pode remover a própria membership", 403);
  }
  const target = await getMembership(params.targetUserId, params.tenantId);
  if (!target) throw new MembershipError("Membro não encontrado", 404);

  await assertNotLastAdmin(params.tenantId, params.targetUserId, {
    removing: true,
  });

  await db
    .delete(memberships)
    .where(
      and(
        eq(memberships.userId, params.targetUserId),
        eq(memberships.tenantId, params.tenantId),
      ),
    );

  await logActivity({
    userId: params.operatorId,
    tenantId: params.tenantId,
    action: "MEMBER_REMOVED",
    resource: "membership",
    resourceId: target.id,
    metadata: { targetUserId: params.targetUserId },
  });
}
