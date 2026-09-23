import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";
import { MembershipError } from "@/services/members";
import { ZodError } from "zod";
import { clientIp, rateLimit, type RateLimitResult } from "@/lib/rate-limit";

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

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof MembershipError) {
    return jsonError(error.message, error.status);
  }
  if (error instanceof ZodError) {
    return jsonError(error.issues.map((i) => i.message).join("; "), 400);
  }
  if (error instanceof Error) {
    const msg = error.message;
    // Cross-tenant / missing resources: 404 (do not reveal existence via 403).
    if (/not found/i.test(msg)) {
      return jsonError(msg, 404);
    }
    // Dependency / in-use conflicts
    if (
      /utilizado|linked to content|cannot delete|storage delete failed|associado|não pode ser eliminado/i.test(
        msg,
      )
    ) {
      return jsonError(msg, 409);
    }
    if (/invalid|expired|already|required|not allowed|exceeds/i.test(msg)) {
      return jsonError(msg, 400);
    }
  }
  console.error(error);
  return jsonError("Internal server error", 500);
}
