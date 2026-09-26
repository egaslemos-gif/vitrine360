/**
 * RUNTIME-EXPERIENCE-05 — Dedicated Experience Origin model.
 *
 * Config + host/URL helpers. Does not execute packages or create iframes.
 */

export type ExperienceOriginConfig = {
  /**
   * Absolute origin for Experience serving, e.g. https://experience.example.com
   * Empty/null ⇒ origin not provisioned (serving may still work on app host under /x
   * for local/dev only — production SHOULD set a dedicated origin).
   */
  origin: string | null;
  /** Hostnames (no port) accepted as Experience origin. */
  hosts: string[];
};

export function parseExperienceOriginConfig(env: {
  EXPERIENCE_ORIGIN?: string | null;
  EXPERIENCE_ORIGIN_HOSTS?: string | null;
}): ExperienceOriginConfig {
  const raw = (env.EXPERIENCE_ORIGIN ?? "").trim().replace(/\/$/, "");
  let origin: string | null = null;
  const hosts = new Set<string>();

  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        throw new Error("unsupported protocol");
      }
      // Production guidance: https only; http allowed for localhost tests
      origin = u.origin;
      hosts.add(u.hostname.toLowerCase());
    } catch {
      origin = null;
    }
  }

  const extra = (env.EXPERIENCE_ORIGIN_HOSTS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const h of extra) hosts.add(h);

  return { origin, hosts: [...hosts] };
}

export function hostnameFromHostHeader(hostHeader: string | null): string {
  if (!hostHeader) return "";
  // strip port
  return hostHeader.split(":")[0]?.toLowerCase() ?? "";
}

export function isExperienceOriginHost(
  hostHeader: string | null,
  config: ExperienceOriginConfig,
): boolean {
  if (config.hosts.length === 0) return false;
  const host = hostnameFromHostHeader(hostHeader);
  return config.hosts.includes(host);
}

/**
 * On a dedicated Experience origin, only `/x/*` package routes are allowed.
 * App/admin/api routes must 404 on that host.
 */
export function isAllowedPathOnExperienceOrigin(pathname: string): boolean {
  if (pathname === "/x" || pathname.startsWith("/x/")) return true;
  // health-style probes optional — deny by default
  return false;
}

export type ExperienceServeLocator = {
  tenantId: string;
  experienceId: string;
  version: string;
  /** Relative path inside package; empty ⇒ entrypoint */
  assetPath: string;
};

/**
 * Build canonical serve path (app-relative).
 * /x/{tenantId}/{experienceId}/{version}[/{assetPath}]
 */
export function buildExperienceServePath(loc: ExperienceServeLocator): string {
  const base = `/x/${encodeURIComponent(loc.tenantId)}/${encodeURIComponent(loc.experienceId)}/${encodeURIComponent(loc.version)}`;
  const ap = loc.assetPath.replace(/^\/+/, "");
  if (!ap) return base;
  return `${base}/${ap.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Absolute URL on dedicated origin when configured; otherwise path-only on current host.
 */
export function buildExperienceServeUrl(
  loc: ExperienceServeLocator,
  config: ExperienceOriginConfig,
): string {
  const path = buildExperienceServePath(loc);
  if (config.origin) return `${config.origin}${path}`;
  return path;
}

/**
 * Parse `/x/:tenant/:exp/:version/...` — returns null if shape invalid.
 */
export function parseExperienceServePath(
  pathname: string,
): ExperienceServeLocator | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "x" || parts.length < 3) return null;
  const tenantId = decodeURIComponent(parts[1] ?? "");
  const experienceId = decodeURIComponent(parts[2] ?? "");
  const version = decodeURIComponent(parts[3] ?? "");
  if (!tenantId || !experienceId || !version) return null;
  const assetPath = parts
    .slice(4)
    .map((p) => decodeURIComponent(p))
    .join("/");
  return { tenantId, experienceId, version, assetPath };
}

/** True when EXPERIENCE_ORIGIN is set to a non-app privileged origin string. */
export function isDedicatedOriginConfigured(
  config: ExperienceOriginConfig,
  appOrigin?: string | null,
): boolean {
  if (!config.origin) return false;
  if (!appOrigin) return true;
  try {
    return new URL(config.origin).origin !== new URL(appOrigin).origin;
  } catch {
    return true;
  }
}
