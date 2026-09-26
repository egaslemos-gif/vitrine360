import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireSession, sessionFromUser, setSessionCookie } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { logActivity } from "@/services/activity-log";
import { getMembership } from "@/services/memberships";

const bodySchema = z.object({ tenantId: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = bodySchema.parse(await req.json());
    const membership = await getMembership(session.id, body.tenantId);
    if (!membership || membership.status !== "ACTIVE") {
      return jsonError("Workspace não autorizado", 403);
    }
    const { isTenantOperable } = await import("@/services/tenant-lifecycle");
    if (!(await isTenantOperable(body.tenantId))) {
      return jsonError("Workspace suspenso", 403);
    }
    const [user] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
    if (!user) return jsonError("Unauthorized", 401);
    const next = await sessionFromUser(user, body.tenantId);
    if (!next) return jsonError("Workspace não autorizado", 403);
    await setSessionCookie(next);
    await logActivity({
      userId: session.id,
      tenantId: next.activeTenantId,
      action: "WORKSPACE_SWITCH",
      resource: "tenant",
      resourceId: next.activeTenantId,
    });
    return jsonOk({ activeTenantId: next.activeTenantId, role: next.role });
  } catch (e) {
    return handleApiError(e);
  }
}
