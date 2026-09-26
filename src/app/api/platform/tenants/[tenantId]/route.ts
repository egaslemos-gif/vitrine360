/**
 * PLATFORM-IDENTITY-06B — Platform tenant by id (hardened).
 * READ-ONLY metadata. Flag OFF → 404. Permission: platform.tenants.read.
 */
import { isPlatformIdentityEnabled } from "@/lib/platform-identity-flag";
import { requirePlatformPermission } from "@/lib/platform-authz";
import {
  clientIp,
  enforceRateLimit,
  handleApiError,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { logActivity } from "@/services/activity-log";
import {
  getPlatformTenantMetadata,
  serializePlatformTenantMetadata,
} from "@/services/platform-tenants";

type RouteContext = { params: Promise<{ tenantId: string }> };

export async function GET(req: Request, context: RouteContext) {
  try {
    if (!isPlatformIdentityEnabled()) {
      return jsonError("Not found", 404);
    }

    const limited = enforceRateLimit(req, "platform-tenants", 60, 60_000);
    if (limited) return limited;

    const { tenantId } = await context.params;
    if (!tenantId || typeof tenantId !== "string") {
      return jsonError("Not found", 404);
    }

    const ctx = await requirePlatformPermission("platform.tenants.read", req);
    const row = await getPlatformTenantMetadata(tenantId);
    if (!row) {
      return jsonError("Not found", 404);
    }

    await logActivity({
      userId: ctx.userId,
      tenantId: ctx.tenant?.tenantId ?? null,
      action: "platform.tenants.read",
      resource: "platform.tenants",
      resourceId: row.id,
      ip: clientIp(req),
      metadata: { slug: row.slug },
    });

    return jsonOk({
      tenant: serializePlatformTenantMetadata(row),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
