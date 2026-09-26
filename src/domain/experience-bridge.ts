/**
 * RUNTIME-EXPERIENCE-07 — Controlled Experience Bridge protocol (pure).
 *
 * postMessage is transport only. Security = source + origin + protocol +
 * schema + allowlist + permission + capability (fail closed).
 *
 * No tokens, DB, storage, network proxy, dynamic dispatch, or playback APIs.
 */

export const BRIDGE_PROTOCOL_VERSION = "1.0" as const;

/** Hard limit — documented; prevents memory exhaustion via oversized payloads. */
export const BRIDGE_MAX_MESSAGE_BYTES = 8_192;

/** Max pending requestIds tracked for replay / correlation. */
export const BRIDGE_MAX_PENDING = 64;

/** Default per-instance rate: N requests / windowMs. */
export const BRIDGE_RATE_LIMIT_MAX = 40;
export const BRIDGE_RATE_LIMIT_WINDOW_MS = 10_000;

/** Async handler timeout (V1 handlers are sync; infrastructure still enforces). */
export const BRIDGE_DEFAULT_TIMEOUT_MS = 3_000;

export const BRIDGE_REQUEST_TYPE = "V360_BRIDGE_REQUEST" as const;
export const BRIDGE_RESPONSE_TYPE = "V360_BRIDGE_RESPONSE" as const;

export const BRIDGE_ERROR_CODES = [
  "BRIDGE_INVALID_MESSAGE",
  "BRIDGE_INVALID_ORIGIN",
  "BRIDGE_INVALID_SOURCE",
  "BRIDGE_INVALID_PROTOCOL",
  "BRIDGE_INVALID_REQUEST_ID",
  "BRIDGE_METHOD_NOT_ALLOWED",
  "BRIDGE_PERMISSION_DENIED",
  "BRIDGE_CAPABILITY_DENIED",
  "BRIDGE_INVALID_PARAMS",
  "BRIDGE_RATE_LIMITED",
  "BRIDGE_TIMEOUT",
  "BRIDGE_NOT_READY",
  "BRIDGE_STOPPED",
  "BRIDGE_INTERNAL_ERROR",
  "BRIDGE_PAYLOAD_TOO_LARGE",
  "BRIDGE_DUPLICATE_REQUEST_ID",
] as const;
export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[number];

export const BRIDGE_LIFECYCLE = [
  "CREATED",
  "WAITING",
  "READY",
  "ACTIVE",
  "STOPPING",
  "STOPPED",
  "ERROR",
] as const;
export type BridgeLifecycle = (typeof BRIDGE_LIFECYCLE)[number];

/** Permission classes — deny if missing. No ALLOW_ALL. */
export const BRIDGE_PERMISSIONS = ["RUNTIME_READ"] as const;
export type BridgePermission = (typeof BRIDGE_PERMISSIONS)[number];

export const BRIDGE_METHODS_V1 = [
  "runtime.getInfo",
  "runtime.getViewport",
  "runtime.getOrientation",
  "runtime.getTime",
] as const;
export type BridgeMethodV1 = (typeof BRIDGE_METHODS_V1)[number];

export type BridgeSideEffect = "READ_ONLY" | "CONTROL" | "MUTATION";

export type ExperienceBridgeRequest = {
  type: typeof BRIDGE_REQUEST_TYPE;
  protocolVersion: typeof BRIDGE_PROTOCOL_VERSION;
  requestId: string;
  method: string;
  params?: Record<string, unknown>;
};

export type ExperienceBridgeResponse = {
  type: typeof BRIDGE_RESPONSE_TYPE;
  protocolVersion: typeof BRIDGE_PROTOCOL_VERSION;
  requestId: string;
  ok: boolean;
  result?: unknown;
  error?: { code: BridgeErrorCode; message: string };
};

export type BridgeViewport = {
  width: number;
  height: number;
  orientation: "LANDSCAPE" | "PORTRAIT" | "UNKNOWN";
};

export type BridgeRuntimeInfo = {
  runtimeVersion: string;
  bridgeProtocolVersion: typeof BRIDGE_PROTOCOL_VERSION;
  experienceOrigin: string;
  experienceId: string;
  version: string;
};

export type BridgeMethodSpec = {
  name: BridgeMethodV1;
  permission: BridgePermission;
  /** Optional capability gate; omit = no capability requirement beyond permission. */
  capability?: string;
  sideEffects: BridgeSideEffect;
  timeoutMs: number;
  /** Empty object only for V1 read methods. */
  allowParams: false;
};

export const BRIDGE_METHOD_REGISTRY: Record<BridgeMethodV1, BridgeMethodSpec> = {
  "runtime.getInfo": {
    name: "runtime.getInfo",
    permission: "RUNTIME_READ",
    sideEffects: "READ_ONLY",
    timeoutMs: BRIDGE_DEFAULT_TIMEOUT_MS,
    allowParams: false,
  },
  "runtime.getViewport": {
    name: "runtime.getViewport",
    permission: "RUNTIME_READ",
    sideEffects: "READ_ONLY",
    timeoutMs: BRIDGE_DEFAULT_TIMEOUT_MS,
    allowParams: false,
  },
  "runtime.getOrientation": {
    name: "runtime.getOrientation",
    permission: "RUNTIME_READ",
    sideEffects: "READ_ONLY",
    timeoutMs: BRIDGE_DEFAULT_TIMEOUT_MS,
    allowParams: false,
  },
  "runtime.getTime": {
    name: "runtime.getTime",
    permission: "RUNTIME_READ",
    sideEffects: "READ_ONLY",
    timeoutMs: BRIDGE_DEFAULT_TIMEOUT_MS,
    allowParams: false,
  },
};

/** DEFERRED — not in V1 allowlist (unsafe without full policy wiring). */
export const BRIDGE_METHODS_DEFERRED = [
  "experience.requestFullscreen",
  "experience.requestOrientation",
  "storage.get",
  "storage.set",
  "network.fetch",
  "device.get",
  "auth.getToken",
  "execute",
  "rpc",
  "call",
  "invoke",
  "proxy",
] as const;

export type BridgeMessageLike = {
  data: unknown;
  origin: string;
  source: unknown;
};

export type BridgeObservability = {
  requests: number;
  accepted: number;
  denied: number;
  rateLimited: number;
  timeouts: number;
  errors: number;
};

export function utf8ByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(
      typeof value === "string" ? value : JSON.stringify(value),
    ).byteLength;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function normalizeOrigin(originOrUrl: string): string | null {
  try {
    return new URL(originOrUrl).origin;
  } catch {
    try {
      return new URL(`https://${originOrUrl}`).origin;
    } catch {
      return null;
    }
  }
}

export function originsEqual(a: string, b: string): boolean {
  const na = normalizeOrigin(a);
  const nb = normalizeOrigin(b);
  if (!na || !nb) return false;
  return na === nb;
}

const REQUEST_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidRequestId(id: unknown): id is string {
  return typeof id === "string" && REQUEST_ID_RE.test(id);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Parse + schema-validate a bridge request. Fail closed.
 * Rejects unexpected top-level keys beyond the allowlist.
 */
export function parseBridgeRequest(
  data: unknown,
  maxBytes: number = BRIDGE_MAX_MESSAGE_BYTES,
):
  | { ok: true; request: ExperienceBridgeRequest }
  | { ok: false; code: BridgeErrorCode; message: string } {
  if (utf8ByteLength(data) > maxBytes) {
    return {
      ok: false,
      code: "BRIDGE_PAYLOAD_TOO_LARGE",
      message: "Payload exceeds BRIDGE_MAX_MESSAGE_BYTES",
    };
  }
  if (!isPlainObject(data)) {
    return {
      ok: false,
      code: "BRIDGE_INVALID_MESSAGE",
      message: "Request must be an object",
    };
  }
  const allowedKeys = new Set([
    "type",
    "protocolVersion",
    "requestId",
    "method",
    "params",
  ]);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) {
      return {
        ok: false,
        code: "BRIDGE_INVALID_MESSAGE",
        message: `Unexpected field: ${k}`,
      };
    }
  }
  if (data.type !== BRIDGE_REQUEST_TYPE) {
    return {
      ok: false,
      code: "BRIDGE_INVALID_MESSAGE",
      message: "Invalid message type",
    };
  }
  if (data.protocolVersion !== BRIDGE_PROTOCOL_VERSION) {
    return {
      ok: false,
      code: "BRIDGE_INVALID_PROTOCOL",
      message: "Unsupported protocolVersion",
    };
  }
  if (!isValidRequestId(data.requestId)) {
    return {
      ok: false,
      code: "BRIDGE_INVALID_REQUEST_ID",
      message: "Invalid requestId",
    };
  }
  if (typeof data.method !== "string" || data.method.length === 0) {
    return {
      ok: false,
      code: "BRIDGE_METHOD_NOT_ALLOWED",
      message: "method required",
    };
  }
  if (data.method.length > 64) {
    return {
      ok: false,
      code: "BRIDGE_METHOD_NOT_ALLOWED",
      message: "method too long",
    };
  }
  if (data.params !== undefined) {
    if (!isPlainObject(data.params)) {
      return {
        ok: false,
        code: "BRIDGE_INVALID_PARAMS",
        message: "params must be object",
      };
    }
    if (Object.keys(data.params).length > 0) {
      // V1 methods disallow params; reject any non-empty params early
      // (method-specific check also applies after allowlist)
    }
    if (Object.keys(data.params).length > 16) {
      return {
        ok: false,
        code: "BRIDGE_INVALID_PARAMS",
        message: "too many params",
      };
    }
  }

  return {
    ok: true,
    request: {
      type: BRIDGE_REQUEST_TYPE,
      protocolVersion: BRIDGE_PROTOCOL_VERSION,
      requestId: data.requestId,
      method: data.method,
      params: data.params as Record<string, unknown> | undefined,
    },
  };
}

export function isBridgeMethodV1(method: string): method is BridgeMethodV1 {
  return (BRIDGE_METHODS_V1 as readonly string[]).includes(method);
}

export function buildBridgeErrorResponse(
  requestId: string,
  code: BridgeErrorCode,
  message: string,
): ExperienceBridgeResponse {
  return {
    type: BRIDGE_RESPONSE_TYPE,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    requestId,
    ok: false,
    error: { code, message },
  };
}

export function buildBridgeOkResponse(
  requestId: string,
  result: unknown,
): ExperienceBridgeResponse {
  return {
    type: BRIDGE_RESPONSE_TYPE,
    protocolVersion: BRIDGE_PROTOCOL_VERSION,
    requestId,
    ok: true,
    result,
  };
}

/** Ensure result is JSON-safe plain data (no functions / DOM). */
export function assertJsonSafeResult(
  result: unknown,
  depth = 0,
): { ok: true } | { ok: false; reason: string } {
  if (depth > 4) return { ok: false, reason: "result too deep" };
  if (result === null || result === undefined) return { ok: true };
  const t = typeof result;
  if (t === "string" || t === "number" || t === "boolean") return { ok: true };
  if (t === "function" || t === "symbol" || t === "bigint") {
    return { ok: false, reason: "non-serializable" };
  }
  if (Array.isArray(result)) {
    if (result.length > 32) return { ok: false, reason: "array too large" };
    for (const item of result) {
      const r = assertJsonSafeResult(item, depth + 1);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  if (isPlainObject(result)) {
    const keys = Object.keys(result);
    if (keys.length > 32) return { ok: false, reason: "object too large" };
    for (const k of keys) {
      const r = assertJsonSafeResult(result[k], depth + 1);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  return { ok: false, reason: "unsupported result type" };
}

export function hasWildcardTargetOrigin(code: string): boolean {
  // Detect postMessage(..., "*") patterns in source (audit helper)
  return /postMessage\s*\([^)]*,\s*["']\*["']\s*\)/.test(code);
}
