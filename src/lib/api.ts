import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { MembershipError } from "@/services/members";
import { TenantLifecycleError } from "@/services/tenant-lifecycle";
import { EntitlementDeniedError } from "@/services/entitlements";
import { ZodError } from "zod";
import { clientIp, rateLimit, type RateLimitResult } from "@/lib/rate-limit";

export { clientIp };

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

/** Apply fixed-window limit; returns a 429 Response when exceeded, else null. */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  limit: number,
  windowMs: number,
) {
  const ip = clientIp(req);
  const result = rateLimit({
    key: `${bucket}:${ip}`,
    limit,
    windowMs,
  });
  if (!result.allowed) return rateLimitResponse(result);
  return null;
}

/**
 * Legacy-compatible error body. `error` keeps the human-readable text that
 * existing consumers display or pattern-match (e.g. direct-upload.ts matches
 * /direct upload not supported/); `code` carries the structured category.
 */
function legacyError(code: string, message: string, status: number) {
  return NextResponse.json({ error: message, code, message }, { status });
}

/** Structured error body: `error` === `code` (consumed by the code mapper). */
function codedError(
  code: string,
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ error: code, code, message, ...extra }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    if (error.status === 401) {
      return codedError("AUTHENTICATION_REQUIRED", error.message, 401);
    }
    if (error.status === 403) {
      return codedError("PERMISSION_DENIED", error.message, 403);
    }
    return legacyError("VALIDATION_ERROR", error.message, error.status);
  }
  if (error instanceof MembershipError) {
    return legacyError("MEMBERSHIP_ERROR", error.message, error.status);
  }
  if (error instanceof TenantLifecycleError) {
    const code =
      error.code === "NOT_OPERABLE" ? "TENANT_SUSPENDED" : "TENANT_ERROR";
    return legacyError(code, error.message, error.status);
  }
  if (error instanceof EntitlementDeniedError) {
    return NextResponse.json(
      {
        error: error.code,
        code: error.code,
        entitlement: error.entitlementKey,
        reason: error.reason,
      },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return legacyError(
      "VALIDATION_ERROR",
      error.issues.map((i) => i.message).join("; "),
      400,
    );
  }
  if (error instanceof Error) {
    const msg = error.message;
    // Cross-tenant / missing resources: 404 (do not reveal existence via 403).
    if (/not found/i.test(msg)) {
      return legacyError("NOT_FOUND", msg, 404);
    }
    // Dependency / in-use conflicts
    if (
      /utilizado|linked to content|cannot delete|storage delete failed|associado|não pode ser eliminado/i.test(
        msg,
      )
    ) {
      return legacyError("CONFLICT", msg, 409);
    }
    // Device-specific domain errors
    if (/invalid or expired activation code/i.test(msg)) {
      return codedError("ACTIVATION_CODE_INVALID", msg, 400);
    }
    if (/device code already in use|device already paired/i.test(msg)) {
      return codedError("DEVICE_ALREADY_REGISTERED", msg, 400);
    }
    if (/invalid|expired|already|required|not allowed|not supported|exceeds|mismatch/i.test(msg)) {
      return legacyError("VALIDATION_ERROR", msg, 400);
    }
  }
  console.error(error);
  return legacyError("INTERNAL_ERROR", "Internal server error", 500);
}
