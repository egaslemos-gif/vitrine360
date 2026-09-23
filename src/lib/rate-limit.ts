/**
 * Simple fixed-window rate limiter for single-node MVP.
 * Not distributed — document for multi-instance deployments.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = params.now ?? Date.now();
  const existing = buckets.get(params.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(params.key, {
      count: 1,
      resetAt: now + params.windowMs,
    });
    return {
      allowed: true,
      remaining: params.limit - 1,
      retryAfterSec: Math.ceil(params.windowMs / 1000),
    };
  }
  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: params.limit - existing.count,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/** Test / diagnostics helper */
export function clearRateLimitBuckets() {
  buckets.clear();
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
