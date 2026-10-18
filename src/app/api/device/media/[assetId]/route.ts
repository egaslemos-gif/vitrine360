import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { enforceRateLimit, jsonError } from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { resolveMediaStorageForAsset } from "@/services/media";
import { serveDeviceObject } from "@/services/media/serve-device-object";

/**
 * Device-scoped same-origin media proxy.
 *
 * Selects storage from `media_assets.storage_provider` + tenant:
 * - r2 / local → platform providers
 * - google_drive → Tenant Drive OAuth (`tryTenantGoogleDriveProvider`)
 *
 * HTTP Range: Tenant Drive implements native `getObjectRange`; R2 likewise.
 * Providers without range fall back to getObject + in-memory slice.
 */

const BASE_HEADERS = {
  "Cache-Control": "private, max-age=3600",
  "Accept-Ranges": "bytes",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const limited = enforceRateLimit(req, "device-media", 600, 60_000);
  if (limited) return limited;

  // Prefer Authorization header. Query `?token=` remains for HTML media
  // elements that cannot set headers (player `<video src>` / `<audio src>`).
  const authHeader = req.headers.get("authorization");
  const tokenParam = req.nextUrl.searchParams.get("token");
  const usedQueryToken = !authHeader && Boolean(tokenParam?.trim());
  const token =
    authHeader ??
    (tokenParam?.trim() ? `Bearer ${tokenParam.trim()}` : null);

  const device = await authenticateDevice(token);
  if (!device?.tenantId) return jsonError("Unauthorized", 401);

  const responseHeaders: Record<string, string> = {
    ...BASE_HEADERS,
    "X-V360-Device-Auth": usedQueryToken ? "query" : "header",
  };

  const { assetId } = await ctx.params;
  const decodedId = decodeURIComponent(assetId);
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.id, decodedId),
        eq(mediaAssets.tenantId, device.tenantId),
      ),
    )
    .limit(1);

  if (!asset) return jsonError("Not found", 404);

  const contentType = asset.mimeType || "application/octet-stream";

  try {
    let storage;
    try {
      // Asset row already constrained to device.tenantId — use asset.tenantId only.
      storage = await resolveMediaStorageForAsset({
        storageProvider: asset.storageProvider,
        tenantId: asset.tenantId,
        storageKey: asset.storageKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[device-media] storage resolve failed", {
        assetId: decodedId,
        storageProvider: asset.storageProvider,
        message: message.slice(0, 200),
      });
      return jsonError("Media unavailable", 502);
    }

    return await serveDeviceObject({
      storage,
      storageKey: asset.storageKey,
      contentType,
      fileSize: asset.fileSize,
      rangeHeader: req.headers.get("range"),
      baseHeaders: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[device-media] unexpected", {
      assetId: decodedId,
      storageProvider: asset.storageProvider,
      message: message.slice(0, 200),
    });
    return jsonError("Media unavailable", 502);
  }
}
