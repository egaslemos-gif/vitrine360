import {
  MEDIA_RANGE_MAX_CHUNK,
  contentRangeHeader,
  parseRangeHeader,
} from "@/lib/http-range";
import type { MediaStorageProvider } from "./types";

/**
 * C1 — Map a ranged-read buffer to exactly `[start, end]` (inclusive).
 *
 * - Exact/short bodies: trusted as the slice beginning at `start` (RFC allows
 *   shorter-than-requested responses).
 * - Oversized bodies that cover `end` when treated as file offset 0: extract
 *   `subarray(start, end+1)` (providers that ignore Range and return a full object).
 * - Otherwise fail closed — never emit a 206 with bytes outside the window.
 *
 * Does not change well-behaved providers (R2) that already return the exact slice.
 */
export function normalizeRangedBody(
  buf: Buffer,
  start: number,
  end: number,
): Buffer {
  const expected = end - start + 1;
  if (!(expected > 0) || !Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error("Invalid range bounds");
  }
  if (buf.byteLength <= expected) {
    return buf;
  }
  if (buf.byteLength > end) {
    return buf.subarray(start, end + 1);
  }
  throw new Error(
    `Ranged body length ${buf.byteLength} exceeds requested ${expected} without covering offset ${end}`,
  );
}

async function readSlice(
  storage: MediaStorageProvider,
  storageKey: string,
  start: number,
  end: number,
): Promise<Buffer> {
  if (typeof storage.getObjectRange === "function") {
    const raw = await storage.getObjectRange(storageKey, start, end);
    return normalizeRangedBody(raw, start, end);
  }
  const obj = await storage.getObject(storageKey);
  return obj.body.subarray(start, end + 1);
}

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

export type ServeDeviceObjectParams = {
  storage: MediaStorageProvider;
  storageKey: string;
  contentType: string;
  /** Declared size from media_assets.file_size when known. */
  fileSize: number;
  rangeHeader: string | null;
  baseHeaders: Record<string, string>;
};

/**
 * Serve bytes from an already-selected storage provider.
 * Prefer getObjectRange when available; otherwise whole getObject + in-memory slice.
 * Ranged responses pass through {@link normalizeRangedBody} (C1) so ignored-Range
 * full-object bodies cannot produce misleading 206 windows.
 */
export async function serveDeviceObject(
  params: ServeDeviceObjectParams,
): Promise<Response> {
  const {
    storage,
    storageKey,
    contentType,
    fileSize,
    rangeHeader,
    baseHeaders,
  } = params;

  let total = Number(fileSize) > 0 ? Number(fileSize) : 0;
  if (!total && typeof storage.headObject === "function") {
    try {
      total = (await storage.headObject(storageKey)).contentLength ?? 0;
    } catch {
      total = 0;
    }
  }
  const canSlice = typeof storage.getObjectRange === "function" && total > 0;

  if (canSlice) {
    const range = parseRangeHeader(rangeHeader, total);

    if (range.type === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${total}` },
      });
    }

    try {
      if (range.type === "range") {
        const buf = await readSlice(
          storage,
          storageKey,
          range.start,
          range.end,
        );
        const end = range.start + buf.byteLength - 1;
        return new Response(new Uint8Array(buf), {
          status: 206,
          headers: {
            ...baseHeaders,
            "Content-Type": contentType,
            "Content-Range": contentRangeHeader(range.start, end, total),
            "Content-Length": String(buf.byteLength),
          },
        });
      }

      if (total > MEDIA_RANGE_MAX_CHUNK) {
        return new Response(chunkedStream(storage, storageKey, total), {
          status: 200,
          headers: {
            ...baseHeaders,
            "Content-Type": contentType,
            "Content-Length": String(total),
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[device-media] range read failed", {
        storageProvider: storage.name,
        message: message.slice(0, 200),
      });
      // fall through to whole-object path
    }
  }

  if (typeof storage.getObject === "function") {
    const obj = await storage.getObject(storageKey);
    const range = parseRangeHeader(rangeHeader, obj.body.byteLength);
    if (range.type === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes */${obj.body.byteLength}`,
        },
      });
    }
    if (range.type === "range") {
      const slice = obj.body.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...baseHeaders,
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
      status: 200,
      headers: {
        ...baseHeaders,
        "Content-Type": contentType || obj.contentType || "application/octet-stream",
        "Content-Length": String(obj.contentLength),
      },
    });
  }

  // Last resort: signed/public URL fetch (R2 getUrl, Drive uc link)
  const upstreamUrl = await storage.getUrl(storageKey);
  const upstreamHeaders: Record<string, string> = {};
  if (rangeHeader) upstreamHeaders.Range = rangeHeader;
  const upstream = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: upstreamHeaders,
  });
  if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
    const err = new Error(`upstream ${upstream.status}`);
    (err as Error & { upstreamStatus?: number }).upstreamStatus =
      upstream.status;
    throw err;
  }
  const passthrough: Record<string, string> = {
    ...baseHeaders,
    "Content-Type":
      contentType ||
      upstream.headers.get("content-type") ||
      "application/octet-stream",
  };
  const cr = upstream.headers.get("content-range");
  const cl = upstream.headers.get("content-length");
  if (cr) passthrough["Content-Range"] = cr;
  if (cl) passthrough["Content-Length"] = cl;
  return new Response(upstream.body, {
    status: upstream.status,
    headers: passthrough,
  });
}
