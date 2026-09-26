/**
 * PLATFORM-IDENTITY-10G — devices.max HARD_LIMIT allocation guard.
 *
 * Kept outside entitlements.ts so PI-10D FEATURE_GATE enforcement remains
 * Usage-free (source-scan invariant). Call inside withTenantAllocationLock
 * with the same drizzle `tx` as the mutation.
 */
import {
  denyReasonFromResolveStatus,
  DEVICES_MAX_KEY,
  type EntitlementEnforceResult,
} from "@/domain/entitlements";
import {
  DEVICE_COUNT_MODE_CANONICAL,
  evaluateQuota,
} from "@/domain/usage";
import { isEntitlementsEnabled } from "@/lib/entitlements-flag";
import {
  EntitlementDeniedError,
  resolveEffectiveEntitlements,
} from "@/services/entitlements";
import { countDevices } from "@/services/usage";

export async function assertDevicesMaxAllocation(
  tenantId: string,
  operation = "device.allocate",
  executor?: Parameters<typeof countDevices>[2],
): Promise<EntitlementEnforceResult> {
  if (!isEntitlementsEnabled()) {
    return {
      decision: "ALLOW",
      reason: "FLAG_OFF",
      entitlementKey: DEVICES_MAX_KEY,
      tenantId,
      operation,
    };
  }

  const resolved = await resolveEffectiveEntitlements(tenantId);
  if (resolved.status !== "RESOLVED") {
    throw new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      denyReasonFromResolveStatus(resolved.status),
    );
  }

  const entry = resolved.entitlements.entitlements.find(
    (e) => e.key === DEVICES_MAX_KEY,
  );
  if (!entry) {
    throw new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      "ENTITLEMENT_NOT_FOUND",
    );
  }
  if (entry.valueType !== "INTEGER" || typeof entry.value !== "number") {
    throw new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      "INVALID_VALUE_TYPE",
    );
  }
  if (!Number.isInteger(entry.value) || entry.value < 0) {
    throw new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      "INVALID_ENTITLEMENT",
    );
  }

  const usage = await countDevices(
    tenantId,
    DEVICE_COUNT_MODE_CANONICAL,
    executor,
  );
  const enforcementType =
    entry.enforcementType === "SOFT_LIMIT" ? "SOFT_LIMIT" : "HARD_LIMIT";
  const decision = evaluateQuota({
    usage,
    limit: entry.value,
    enforcementType,
  });

  if (decision.decision === "INVALID" || decision.blocksAllocation) {
    throw new EntitlementDeniedError(
      DEVICES_MAX_KEY,
      decision.decision === "INVALID" ? "INVALID_ENTITLEMENT" : "QUOTA_EXCEEDED",
      403,
      "QUOTA_EXCEEDED",
    );
  }

  return {
    decision: "ALLOW",
    reason: "FEATURE_ENABLED",
    entitlementKey: DEVICES_MAX_KEY,
    tenantId,
    operation,
  };
}
