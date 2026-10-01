import fs from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { enforceRateLimit, jsonError } from "@/lib/api";
import {
  MEDIA_RANGE_MAX_CHUNK,
  contentRangeHeader,
  parseRangeHeader,
} from "@/lib/http-range";
import { authenticateDevice } from "@/services/devices";
import { getMediaStorage, resolveMediaRoot, resolveUnderRoot } from "@/services/media";
import type { MediaStorageProvider } from "@/services/media";

/**
 * Device-scoped same-origin media proxy.
 *
 * External R2 URLs are suitable for direct playback but are not reliably
 * readable by legacy TV browsers for offline caching. The proxy keeps the
 * device Bearer check at the app boundary and reads bytes server-side
 * (SDK getObject / local FS), so Cache API/IndexedDB can persist the response.
 *
 * HTTP Range (RFC 9110): media elements on Smart TVs and browsers request
 * `Range: bytes=0-` and require `206 Partial Content` to start MP4 playback
 * (moov atom lookup) and to seek. Responses are served in chunks of at most
 * MEDIA_RANGE_MAX_CHUNK bytes, which also keeps each response below the
 * 4.5 MB Vercel Function body limit that made large videos fail.
 */

const BASE_HEADERS = {
  "Cache-Control": "private, max-age=3600",
  "Accept-Ranges": "bytes",
  "X-Content-Type-Options": "nosniff",
};

async function readSlice(
  storage: MediaStorageProvider,
  storageKey: string,
  start: number,
  end: number,
): Promise<Buffer> {
  if (typeof storage.getObjectRange === "function") {
    return storage.getObjectRange(storageKey, start, end);
  }
  const obj = await storage.getObject(storageKey);
  return obj.body.subarray(start, end + 1);
}

/** Sequential chunked stream: bounded memory, no single huge buffer. */
function chunkedStream(
  storage: MediaStorageProvider,
  storageKey: string,
  total: number,
): ReadableStream<Uint8Array> {
  let pos = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (pos >= total) {
        controller.close();
        return;
      }
      const end = Math.min(pos + MEDIA_RANGE_MAX_CHUNK - 1, total - 1);
      const buf = await readSlice(storage, storageKey, pos, end);
      if (buf.byteLength === 0) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(buf));
      pos += buf.byteLength;
    },
    cancel() {
      pos = total;
    },
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ assetId: string }> },
) {
  const limited = enforceRateLimit(req, "device-media", 600, 60_000);
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

  const contentType = asset.mimeType || "application/octet-stream";

  try {
    const storage = getMediaStorage();

    // ── Ranged / chunked path (preferred) ────────────────────────────────
    let total = Number(asset.fileSize) > 0 ? Number(asset.fileSize) : 0;
    if (!total && typeof storage.headObject === "function") {
      try {
        total = (await storage.headObject(asset.storageKey)).contentLength ?? 0;
      } catch {
        total = 0;
      }
    }
    const canSlice = typeof storage.getObjectRange === "function" && total > 0;

    if (canSlice) {
      const range = parseRangeHeader(req.headers.get("range"), total);

      if (range.type === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { ...BASE_HEADERS, "Content-Range": `bytes */${total}` },
        });
      }

      try {
        if (range.type === "range") {
          const buf = await readSlice(storage, asset.storageKey, range.start, range.end);
          const end = range.start + buf.byteLength - 1;
          return new Response(new Uint8Array(buf), {
            status: 206,
            headers: {
              ...BASE_HEADERS,
              "Content-Type": contentType,
              "Content-Range": contentRangeHeader(range.start, end, total),
              "Content-Length": String(buf.byteLength),
            },
          });
        }

        // No Range header. Small object → single 200. Large object → stream in chunks.
        if (total > MEDIA_RANGE_MAX_CHUNK) {
          return new Response(chunkedStream(storage, asset.storageKey, total), {
            status: 200,
            headers: {
              ...BASE_HEADERS,
              "Content-Type": contentType,
              "Content-Length": String(total),
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[device-media] range read failed", {
          assetId: decodedId,
          storageProvider: asset.storageProvider,
          message: message.slice(0, 200),
        });
        // fall through to the legacy whole-object path
      }
    }

    // ── Legacy whole-object paths (small objects / providers without ranges) ──
    if (typeof storage.getObject === "function") {
      try {
        const obj = await storage.getObject(asset.storageKey);
        const range = parseRangeHeader(req.headers.get("range"), obj.body.byteLength);
        if (range.type === "unsatisfiable") {
          return new Response(null, {
            status: 416,
            headers: { ...BASE_HEADERS, "Content-Range": `bytes */${obj.body.byteLength}` },
          });
        }
        if (range.type === "range") {
          const slice = obj.body.subarray(range.start, range.end + 1);
          return new Response(new Uint8Array(slice), {
            status: 206,
            headers: {
              ...BASE_HEADERS,
              "Content-Type": contentType,
              "Content-Range": contentRangeHeader(
                range.start,
                range.start + slice.byteLength - 1,
                range.total,
              ),
              "Content-Length": String(slice.byteLength),
            },
          });
        }
        return new Response(new Uint8Array(obj.body), {
          headers: {
            ...BASE_HEADERS,
            "Content-Type": asset.mimeType || obj.contentType || "application/octet-stream",
            "Content-Length": String(obj.contentLength),
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
        headers: { ...BASE_HEADERS, "Content-Type": contentType },
      });
    }

    const upstreamUrl = await storage.getUrl(asset.storageKey);
    const upstreamHeaders: Record<string, string> = {};
    const reqRange = req.headers.get("range");
    if (reqRange) upstreamHeaders.Range = reqRange;
    const upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: upstreamHeaders,
    });
    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
      console.error("[device-media] upstream fetch failed", {
        assetId: decodedId,
        storageKeySegments: asset.storageKey.split("/").length,
        upstreamStatus: upstream.status,
      });
      return jsonError("Media unavailable", 502);
    }

    const passthrough: Record<string, string> = {
      ...BASE_HEADERS,
      "Content-Type": asset.mimeType || upstream.headers.get("content-type") || "application/octet-stream",
    };
    const cr = upstream.headers.get("content-range");
    const cl = upstream.headers.get("content-length");
    if (cr) passthrough["Content-Range"] = cr;
    if (cl) passthrough["Content-Length"] = cl;
    return new Response(upstream.body, { status: upstream.status, headers: passthrough });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[device-media] unexpected", {
      assetId: decodedId,
      message: message.slice(0, 200),
    });
    return jsonError("Media unavailable", 502);
  }
}
