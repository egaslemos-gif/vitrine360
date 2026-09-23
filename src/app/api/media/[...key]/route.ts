import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { enforceRateLimit, jsonError } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { authenticateDevice } from "@/services/devices";
import { resolveMediaRoot, resolveUnderRoot } from "@/services/media";

/**
 * Media GET requires either:
 * - Admin session whose tenant owns the asset, or
 * - Device Bearer token whose tenant owns the asset.
 * Unauthenticated public media access is denied.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> },
) {
  const limited = enforceRateLimit(req, "media-get", 300, 60_000);
  if (limited) return limited;

  const { key } = await ctx.params;
  const storageKey = key.map(decodeURIComponent).join("/");

  let allowedTenantId: string | null = null;
  const session = await getSession();
  if (session) {
    allowedTenantId = session.tenantId;
  } else {
    const device = await authenticateDevice(
      req.headers.get("authorization"),
    );
    if (device?.tenantId) allowedTenantId = device.tenantId;
  }
  if (!allowedTenantId) {
    return jsonError("Unauthorized", 401);
  }

  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.storageKey, storageKey),
        eq(mediaAssets.tenantId, allowedTenantId),
      ),
    )
    .limit(1);
  if (!asset) {
    return jsonError("Not found", 404);
  }

  try {
    const filePath = resolveUnderRoot(resolveMediaRoot(), storageKey);
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".png"
        ? "image/png"
        : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".webp"
            ? "image/webp"
            : ext === ".gif"
              ? "image/gif"
              : ext === ".mp4"
                ? "video/mp4"
                : ext === ".webm"
                  ? "video/webm"
                  : asset.mimeType || "application/octet-stream";
    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError("Not found", 404);
  }
}
