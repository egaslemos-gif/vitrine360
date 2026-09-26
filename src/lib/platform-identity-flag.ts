/**
 * PLATFORM-IDENTITY-04 — Feature flag (server-side only).
 *
 * Default OFF. Absence / undefined / empty / non-"true" ⇒ disabled.
 * Never read from request/client input. Does not grant authority.
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * Returns whether Platform Identity infrastructure may be used.
 * Authorization grants are a later phase (PI-05+); this flag only
 * gates capability infrastructure availability.
 */
export function isPlatformIdentityEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.PLATFORM_IDENTITY_ENABLED;
  if (raw === undefined || raw === null) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return false;
  return TRUTHY.has(normalized);
}

/**
 * Rejects any attempt to treat client/request values as the flag source.
 * Call sites that accidentally pass request-derived values should fail closed.
 */
export function resolvePlatformIdentityFlagFromTrustedEnvOnly(
  requestDerived: unknown,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (requestDerived !== undefined && requestDerived !== null) {
    // Explicitly ignore; never honour body/query/header overrides.
    void requestDerived;
  }
  return isPlatformIdentityEnabled(env);
}
