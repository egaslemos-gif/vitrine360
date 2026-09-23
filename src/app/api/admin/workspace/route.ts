import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getTenantById } from "@/services/tenants";
import { logActivity } from "@/services/activity-log";

function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const session = await requireSession("manage_users");
    const tenant = await getTenantById(session.activeTenantId);
    if (!tenant) return jsonError("Workspace não encontrado", 404);
    return jsonOk({
      workspace: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        status: tenant.status,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(80).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireSession("manage_users");
    const body = updateSchema.parse(await req.json());
    if (!body.name && !body.timezone) {
      return jsonError("Nada para actualizar", 400);
    }
    if (body.timezone && !isValidTimezone(body.timezone)) {
      return jsonError("Timezone inválido", 400);
    }
    const tenant = await getTenantById(session.activeTenantId);
    if (!tenant) return jsonError("Workspace não encontrado", 404);

    await db
      .update(tenants)
      .set({
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tenants.id, session.activeTenantId));

    await logActivity({
      userId: session.id,
      tenantId: session.activeTenantId,
      action: "WORKSPACE_UPDATED",
      resource: "tenant",
      resourceId: session.activeTenantId,
      metadata: {
        name: body.name ?? tenant.name,
        timezone: body.timezone ?? tenant.timezone,
      },
    });

    const updated = await getTenantById(session.activeTenantId);
    return jsonOk({ workspace: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
