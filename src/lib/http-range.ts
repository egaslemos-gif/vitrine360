/**
 * HTTP Range parsing for the device media proxy.
 *
 * Media elements on Smart TVs (Sraf / Tizen / webOS / VIDAA) and browsers ask for
 * `Range: bytes=0-` and expect `206 Partial Content`. Responses are capped to
 * `maxChunk` bytes (a server may always return fewer bytes than requested), which
 * keeps every response below the 4.5 MB Vercel Function body limit.
 */

/** 4 MB — safely under the 4.5 MB serverless response limit. */
export const MEDIA_RANGE_MAX_CHUNK = 4_000_000;

export type RangeResult =
  | { type: "full" }
  | { type: "unsatisfiable" }
  | { type: "range"; start: number; end: number; total: number };

export function parseRangeHeader(
  header: string | null | undefined,
  total: number,
  maxChunk: number = MEDIA_RANGE_MAX_CHUNK,
): RangeResult {
  if (!header) return { type: "full" };
  if (!Number.isFinite(total) || total <= 0) return { type: "full" };

  // Only the first range of a multi-range request is honoured (allowed by RFC 9110).
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)/i.exec(header);
  if (!m) return { type: "full" };
  const [, startStr = "", endStr = ""] = m;
  if (startStr === "" && endStr === "") return { type: "full" };

  let start: number;
  let end: number;
  if (startStr === "") {
    // suffix range: last N bytes
    const suffix = Number(endStr);
    if (!(suffix > 0)) return { type: "unsatisfiable" };
    start = Math.max(total - suffix, 0);
    end = total - 1;
  } else {
    start = Number(startStr);
    end = endStr === "" ? total - 1 : Number(endStr);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return { type: "full" };
  if (start >= total || start > end) return { type: "unsatisfiable" };

  end = Math.min(end, total - 1, start + Math.max(1, maxChunk) - 1);
  return { type: "range", start, end, total };
}

/** `Content-Range` value for a satisfied range. */
export function contentRangeHeader(start: number, end: number, total: number): string {
  return `bytes ${start}-${end}/${total}`;
}
