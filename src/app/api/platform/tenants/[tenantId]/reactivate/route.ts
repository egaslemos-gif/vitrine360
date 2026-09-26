/**
 * PLATFORM-IDENTITY-09 — Reactivate tenant (SUSPENDED → ACTIVE).
 * Requires platform.tenants.suspend. Idempotent.
 */
import { z } from "zod";
import { isPlatformIdentityEnabled } from "@/lib/platform-identity-flag";
import { requirePlatformPermission } from "@/lib/platform-authz";
import {
  clientIp,
  enforceRateLimit,
  handleApiError,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { reactivateTenant } from "@/services/tenant-lifecycle";

type RouteContext = { params: Promise<{ tenantId: string }> };

const bodySchema = z
  .object({
    reason: z.string().max(500).optional().nullable(),
  })
  .optional();

export async function POST(req: Request, context: RouteContext) {
  try {
    if (!isPlatformIdentityEnabled()) {
      return jsonError("Not found", 404);
    }
    const limited = enforceRateLimit(req, "platform-tenants-lifecycle", 30, 60_000);
    if (limited) return limited;

    const { tenantId } = await context.params;
    if (!tenantId) return jsonError("Not found", 404);

    const ctx = await requirePlatformPermission(
      "platform.tenants.suspend",
      req,
    );
    const raw = await req.json().catch(() => ({}));
    const body = bodySchema.parse(raw) ?? {};

    const result = await reactivateTenant({
      tenantId,
      actorUserId: ctx.userId,
      actorIp: clientIp(req),
      reason: body.reason ?? null,
    });

    return jsonOk({
      tenant: {
        id: result.tenantId,
        status: result.status,
      },
      from: result.from,
      idempotent: result.idempotent,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
