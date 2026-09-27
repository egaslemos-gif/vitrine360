import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { enforceRateLimit, jsonError } from "@/lib/api";
import { authenticateDevice } from "@/services/devices";
import { getMediaStorage, resolveMediaRoot, resolveUnderRoot } from "@/services/media";

/**
 * Device-scoped same-origin media proxy.
 *
 * External R2 URLs are suitable for direct playback but are not reliably
 * readable by legacy TV browsers for offline caching. The proxy keeps the
 * device Bearer check at the app boundary and reads bytes server-side
 * (SDK getObject / local FS), so Cache API/IndexedDB can persist the response.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const limited = enforceRateLimit(req, "device-media", 300, 60_000);
  if (limited) return limited;

  const authHeader = req.headers.get("authorization");
  const tokenParam = req.nextUrl.searchParams.get("token");
  const token = authHeader ?? (tokenParam ? `Bearer ${tokenParam}` : null);

  const device = await authenticateDevice(token);
  if (!device?.tenantId) return jsonError("Unauthorized", 401);

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

  try {
    const storage = getMediaStorage();

    // Prefer provider getObject (R2 SDK / local FS / Drive API) over fetching
    // a presigned URL — Node fetch of signed R2 URLs was a common 502 source
    // when the DB row pointed at a missing key or signature edge cases.
    if (typeof storage.getObject === "function") {
      try {
        const obj = await storage.getObject(asset.storageKey);
        return new Response(new Uint8Array(obj.body), {
          headers: {
            "Content-Type":
              asset.mimeType || obj.contentType || "application/octet-stream",
            "Content-Length": String(obj.contentLength),
            "Cache-Control": "private, max-age=3600",
            "Accept-Ranges": "bytes",
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[device-media] getObject failed", {
          assetId: decodedId,
          storageProvider: asset.storageProvider,
          storageKeySegments: asset.storageKey.split("/").length,
          runtimeProvider: storage.name,
          message: message.slice(0, 200),
        });
        // fall through to legacy paths
      }
    }

    if (storage.name === "local") {
      const filePath = resolveUnderRoot(resolveMediaRoot(), asset.storageKey);
      const data = await fs.readFile(filePath);
      return new Response(data, {
        headers: {
          "Content-Type": asset.mimeType || "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
          "Accept-Ranges": "bytes",
        },
      });
    }

    const upstreamUrl = await storage.getUrl(asset.storageKey);
    const upstream = await fetch(upstreamUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      console.error("[device-media] upstream fetch failed", {
        assetId: decodedId,
        storageKeySegments: asset.storageKey.split("/").length,
        upstreamStatus: upstream.status,
      });
      return jsonError("Media unavailable", 502);
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type":
          asset.mimeType ||
          upstream.headers.get("content-type") ||
          "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[device-media] unexpected", {
      assetId: decodedId,
      message: message.slice(0, 200),
    });
    return jsonError("Media unavailable", 502);
  }
}
