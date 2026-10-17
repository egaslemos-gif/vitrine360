/**
 * Canonical app origin for OAuth redirect_uri construction.
 * Request origin wins only for an explicit allowlist (no *.vercel.app).
 * APP_URL / NEXT_PUBLIC_APP_URL remain the safe fallback.
 */

/** Explicit hosts only — never wildcard Vercel preview URLs. */
export const AUTHORIZED_OAUTH_HOSTS = [
  "vitrine360-tv.vercel.app",
  "vitrine360-staging.vercel.app",
  "vitrine360-psi.vercel.app",
  "localhost",
  "127.0.0.1",
] as const;

export type AuthorizedOAuthHost = (typeof AUTHORIZED_OAUTH_HOSTS)[number];

/**
 * Full public origins (HTTPS, default port only).
 * Compared as complete origins — not hostname-only.
 */
export const AUTHORIZED_PUBLIC_OAUTH_ORIGINS = [
  "https://vitrine360-tv.vercel.app",
  "https://vitrine360-staging.vercel.app",
  "https://vitrine360-psi.vercel.app",
] as const;

const PUBLIC_ORIGIN_SET = new Set<string>(AUTHORIZED_PUBLIC_OAUTH_ORIGINS);

function stripTrailingSlash(origin: string): string {
  return origin.replace(/\/$/, "");
}

/**
 * True when the full origin is an allowlisted public HTTPS origin
 * (default port only), or http://localhost|127.0.0.1[:port] for local dev.
 */
export function isAuthorizedOAuthOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  // Reject credentials / userinfo in the authority
  if (url.username || url.password) return false;

  // Full-origin match for deployed aliases (rejects :8443, http, spoof hosts)
  if (PUBLIC_ORIGIN_SET.has(url.origin)) {
    return true;
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    // Local dev: HTTP only (any port). HTTPS localhost is not accepted.
    return url.protocol === "http:";
  }
  return false;
}

function configuredAppOrigin(): string | null {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!raw || !raw.trim()) return null;
  return stripTrailingSlash(raw.trim());
}

/**
 * Resolve the public origin used in Google OAuth redirect_uri.
 * 1) Authorized request origin (e.g. TV alias)
 * 2) Authorized APP_URL / NEXT_PUBLIC_APP_URL (safe fallback)
 * Never returns an origin outside the allowlist (no insecure legacy passthrough).
 */
export function appOriginFrom(requestOrigin: string): string {
  const request = stripTrailingSlash((requestOrigin || "").trim());
  if (request && isAuthorizedOAuthOrigin(request)) {
    return request;
  }

  const configured = configuredAppOrigin();
  if (configured && isAuthorizedOAuthOrigin(configured)) {
    return configured;
  }
  throw new Error("OAuth app origin is not configured or not allowlisted");
}

/**
 * Build a same-origin redirect to an app-relative path only.
 * Rejects absolute URLs / protocol-relative / backslash tricks / open redirects.
 */
export function safeAppRelativeRedirect(
  requestUrl: string | URL,
  pathWithQuery: string,
): URL {
  if (
    !pathWithQuery.startsWith("/") ||
    pathWithQuery.startsWith("//") ||
    pathWithQuery.includes("://") ||
    pathWithQuery.includes("\\")
  ) {
    throw new Error("OAuth redirect path must be application-relative");
  }
  const base = new URL(requestUrl);
  const dest = new URL(pathWithQuery, base);
  if (dest.origin !== base.origin) {
    throw new Error("OAuth redirect must stay on the request origin");
  }
  return dest;
}
