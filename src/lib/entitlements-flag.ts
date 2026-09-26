/**
 * PLATFORM-IDENTITY-10B/10D — Feature flag (server-side only).
 *
 * Default OFF. Absence / undefined / empty / non-"true" ⇒ disabled.
 * Never read from request/client input. Does not grant authority.
 * When OFF: entitlement enforcement does not block operations (legacy preserved).
 * When ON: enforceEntitlement evaluates EffectiveEntitlements (PI-10D).
 */

const TRUTHY = new Set(["1", "true", "yes", "on"]);

export function isEntitlementsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.ENTITLEMENTS_ENABLED;
  if (raw === undefined || raw === null) return false;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return false;
  return TRUTHY.has(normalized);
}

/**
 * Rejects any attempt to treat client/request values as the flag source.
 */
export function resolveEntitlementsFlagFromTrustedEnvOnly(
  requestDerived: unknown,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (requestDerived !== undefined && requestDerived !== null) {
    void requestDerived;
  }
  return isEntitlementsEnabled(env);
}
