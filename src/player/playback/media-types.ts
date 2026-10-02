/**
 * RUNTIME-PLAYBACK-05 — Media type helpers (no new domain model).
 */

export const MEDIA_ERROR_CODES = {
  MEDIA_LOAD_ERROR: "MEDIA_LOAD_ERROR",
  MEDIA_PLAY_ERROR: "MEDIA_PLAY_ERROR",
  MEDIA_DECODE_ERROR: "MEDIA_DECODE_ERROR",
  MEDIA_UNSUPPORTED: "MEDIA_UNSUPPORTED",
  MEDIA_TIMEOUT: "MEDIA_TIMEOUT",
  MEDIA_ERROR: "MEDIA_ERROR",
} as const;

export type MediaErrorCode =
  (typeof MEDIA_ERROR_CODES)[keyof typeof MEDIA_ERROR_CODES];

/** Still / presentation media — IMAGE path + GIF (type or mime). */
export function isStillMedia(item: {
  type: string;
  assets?: { mimeType?: string }[];
}): boolean {
  const t = item.type.toUpperCase();
  if (t === "IMAGE" || t === "GIF") return true;
  const mime = item.assets?.[0]?.mimeType?.toLowerCase() ?? "";
  return mime === "image/gif" || mime.startsWith("image/");
}

export function isGifMedia(item: {
  type: string;
  assets?: { mimeType?: string }[];
}): boolean {
  const t = item.type.toUpperCase();
  if (t === "GIF") return true;
  const mime = item.assets?.[0]?.mimeType?.toLowerCase() ?? "";
  return mime === "image/gif";
}

export function resolveObjectFit(
  fitMode?: string,
): "contain" | "cover" | "fill" {
  const m = (fitMode ?? "contain").toLowerCase();
  if (m === "cover" || m === "fill" || m === "contain") return m;
  return "contain";
}

export function userFacingMediaErrorMessage(code: string): string {
  switch (code) {
    case MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR:
      return "Media unavailable";
    case MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR:
      return "Playback could not start";
    case MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR:
      return "Media could not be decoded";
    case MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED:
      return "Unsupported media format";
    case MEDIA_ERROR_CODES.MEDIA_TIMEOUT:
      return "Media timed out";
    default:
      return "Media unavailable";
  }
}

/**
 * Classify a native media failure using only observable data (MediaError.code, connectivity).
 * Never returns URLs or messages from the browser (they may contain signed URLs / tokens).
 *   1 ABORTED · 2 NETWORK · 3 DECODE · 4 SRC_NOT_SUPPORTED
 */
export function classifyMediaError(input: {
  errorCode?: number | null;
  online?: boolean | null;
}): { code: MediaErrorCode; kind: "network" | "decode" | "unsupported" | "load" | "unknown" } {
  switch (input.errorCode) {
    case 2:
    case 1:
      return { code: MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR, kind: input.errorCode === 2 ? "network" : "load" };
    case 3:
      return { code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR, kind: "decode" };
    case 4:
      return { code: MEDIA_ERROR_CODES.MEDIA_UNSUPPORTED, kind: "unsupported" };
    default:
      if (input.online === false) {
        return { code: MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR, kind: "network" };
      }
      return { code: MEDIA_ERROR_CODES.MEDIA_ERROR, kind: "unknown" };
  }
}
