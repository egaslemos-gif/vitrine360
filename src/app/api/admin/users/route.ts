import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, requireSession } from "@/lib/auth";
import { handleApiError, jsonOk, jsonError } from "@/lib/api";
import { USER_ROLES } from "@/domain/types";
import { logActivity } from "@/services/activity-log";
import { createMembership } from "@/services/memberships";
import {
  changeMemberRole,
  listWorkspaceMembers,
  MembershipError,
  removeMember,
  setMemberStatus,
} from "@/services/members";

export async function GET() {
  try {
    const session = await requireSession("manage_users");
    const members = await listWorkspaceMembers(session.activeTenantId);
    return jsonOk({ members, users: members });
  } catch (e) {
    return handleApiError(e);
  }
}

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
  role: z.enum(USER_ROLES),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession("manage_users");
    const body = createSchema.parse(await req.json());
    if (body.role === "SUPER_ADMIN" && session.role !== "SUPER_ADMIN") {
      return jsonError("Apenas SUPER_ADMIN pode atribuir SUPER_ADMIN", 403);
    }
    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);
    await db.insert(users).values({
      id,
      email: body.email,
      name: body.name,
      passwordHash,
      role: body.role,
      tenantId: session.activeTenantId,
    });
    await createMembership({
      userId: id,
      tenantId: session.activeTenantId,
      role: body.role,
      status: "ACTIVE",
    });
    await logActivity({
      userId: session.id,
      tenantId: session.activeTenantId,
      action: "user.created",
      resource: "user",
      resourceId: id,
      metadata: { role: body.role },
    });
    return jsonOk({ id });
  } catch (e) {
    return handleApiError(e);
  }
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("role"),
    id: z.string().uuid(),
    role: z.enum(USER_ROLES),
  }),
  z.object({
    action: z.literal("suspend"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("activate"),
    id: z.string().uuid(),
  }),
  z.object({
    action: z.literal("remove"),
    id: z.string().uuid(),
  }),
]);

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession("manage_users");
    const body = patchSchema.parse(await req.json());
    try {
      if (body.action === "role") {
        await changeMemberRole({
          operatorId: session.id,
          operatorRole: session.role,
          tenantId: session.activeTenantId,
          targetUserId: body.id,
          role: body.role,
        });
      } else if (body.action === "suspend") {
        await setMemberStatus({
          operatorId: session.id,
          tenantId: session.activeTenantId,
          targetUserId: body.id,
          status: "SUSPENDED",
        });
      } else if (body.action === "activate") {
        await setMemberStatus({
          operatorId: session.id,
          tenantId: session.activeTenantId,
          targetUserId: body.id,
          status: "ACTIVE",
        });
      } else {
        await removeMember({
          operatorId: session.id,
          tenantId: session.activeTenantId,
          targetUserId: body.id,
        });
      }
    } catch (err) {
      if (err instanceof MembershipError) {
        return jsonError(err.message, err.status);
      }
      throw err;
    }
    return jsonOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
