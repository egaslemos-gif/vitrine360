/**
 * PLATFORM-IDENTITY-06B — Platform tenants list (hardened).
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
  listPlatformTenantsMetadata,
  parsePlatformTenantsListQuery,
  serializePlatformTenantMetadata,
} from "@/services/platform-tenants";

export async function GET(req: Request) {
  try {
    if (!isPlatformIdentityEnabled()) {
      return jsonError("Not found", 404);
    }

    const limited = enforceRateLimit(req, "platform-tenants", 60, 60_000);
    if (limited) return limited;

    const parsed = parsePlatformTenantsListQuery(new URL(req.url));
    if (!parsed.ok) {
      return jsonError(parsed.error, parsed.status);
    }

    const ctx = await requirePlatformPermission("platform.tenants.read", req);
    const page = await listPlatformTenantsMetadata({
      limit: parsed.limit,
      cursor: parsed.cursor,
    });

    await logActivity({
      userId: ctx.userId,
      tenantId: ctx.tenant?.tenantId ?? null,
      action: "platform.tenants.list",
      resource: "platform.tenants",
      ip: clientIp(req),
      metadata: {
        limit: page.page.limit,
        count: page.tenants.length,
        hasMore: page.page.hasMore,
      },
    });

    return jsonOk({
      tenants: page.tenants.map(serializePlatformTenantMetadata),
      page: {
        limit: page.page.limit,
        nextCursor: page.page.nextCursor,
        hasMore: page.page.hasMore,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
