/**
 * PLATFORM-IDENTITY-10J — storage.maxBytes HARD_LIMIT enforcement.
 *
 * Resolves entitlement centrally, then uses PI-10I reserveStorage atomicity.
 * Flag OFF → no-op (legacy upload). Not a parallel quota system.
 */
import {
  denyReasonFromResolveStatus,
  STORAGE_MAX_KEY,
  type EntitlementEnforceResult,
} from "@/domain/entitlements";
import { evaluateQuota } from "@/domain/usage";
import { isEntitlementsEnabled } from "@/lib/entitlements-flag";
import {
  EntitlementDeniedError,
  resolveEffectiveEntitlements,
} from "@/services/entitlements";
import {
  commitStorageReservation,
  getStorageReservationByOperation,
  releaseStorageReservation,
  reserveStorage,
  StorageReservationError,
  type StorageReservation,
} from "@/services/storage-reservation";

/** Align prepare reservation TTL with signed upload URL (900s). Not a background worker. */
export const MEDIA_PREPARE_RESERVATION_TTL_MS = 900_000;

export function mediaDirectOperationId(assetId: string): string {
  return `media.direct:${assetId}`;
}

export function mediaBufferOperationId(assetId: string): string {
  return `media.buffer:${assetId}`;
}

export function mediaHealOperationId(assetId: string): string {
  return `media.heal:${assetId}`;
}

/**
 * Resolve storage.maxBytes for tenant when entitlements are ON.
 * Fail-closed on missing/invalid. Flag OFF → null (no quota).
 */
export async function resolveStorageMaxBytes(
  tenantId: string,
  operation = "media.upload",
): Promise<{ maxBytes: number; result: EntitlementEnforceResult } | null> {
  if (!isEntitlementsEnabled()) {
    return null;
  }

  const resolved = await resolveEffectiveEntitlements(tenantId);
  if (resolved.status !== "RESOLVED") {
    throw new EntitlementDeniedError(
      STORAGE_MAX_KEY,
      denyReasonFromResolveStatus(resolved.status),
    );
  }

  const entry = resolved.entitlements.entitlements.find(
    (e) => e.key === STORAGE_MAX_KEY,
  );
  if (!entry) {
    throw new EntitlementDeniedError(
      STORAGE_MAX_KEY,
      "ENTITLEMENT_NOT_FOUND",
    );
  }
  if (
    (entry.valueType !== "BYTES" && entry.valueType !== "INTEGER") ||
    typeof entry.value !== "number"
  ) {
    throw new EntitlementDeniedError(
      STORAGE_MAX_KEY,
      "INVALID_VALUE_TYPE",
    );
  }
  if (!Number.isInteger(entry.value) || entry.value < 0) {
    throw new EntitlementDeniedError(
      STORAGE_MAX_KEY,
      "INVALID_ENTITLEMENT",
    );
  }
  if (entry.enforcementType === "SOFT_LIMIT") {
    // Soft limit does not block; treat as no hard reserve gate for PI-10J
    return null;
  }

  return {
    maxBytes: entry.value,
    result: {
      decision: "ALLOW",
      reason: "FEATURE_ENABLED",
      entitlementKey: STORAGE_MAX_KEY,
      tenantId,
      operation,
    },
  };
}

/**
 * Atomic reserve against storage.maxBytes.
 * Flag OFF / SOFT_LIMIT → null (caller proceeds without reservation).
 */
export async function reserveStorageForUpload(params: {
  tenantId: string;
  operationId: string;
  expectedBytes: number;
  operation?: string;
  expiresAt?: string | null;
}): Promise<StorageReservation | null> {
  const { assertTenantOperable } = await import("@/services/tenant-lifecycle");
  await assertTenantOperable(params.tenantId);

  const resolved = await resolveStorageMaxBytes(
    params.tenantId,
    params.operation ?? "media.upload",
  );
  if (!resolved) return null;

  // Pre-check with evaluateQuota using effective usage + request as single figure:
  // ALLOW iff (committed+reserved+requested) <= max  ⇔  usage < max+1
  // reserveStorage performs the authoritative atomic check.
  try {
    return await reserveStorage({
      tenantId: params.tenantId,
      operationId: params.operationId,
      expectedBytes: params.expectedBytes,
      maxBytes: resolved.maxBytes,
      expiresAt: params.expiresAt ?? null,
    });
  } catch (e) {
    if (e instanceof StorageReservationError && e.code === "QUOTA_EXCEEDED") {
      // Align with evaluateQuota semantics for observability
      evaluateQuota({
        usage: resolved.maxBytes,
        limit: resolved.maxBytes,
        enforcementType: "HARD_LIMIT",
      });
      throw new EntitlementDeniedError(
        STORAGE_MAX_KEY,
        "QUOTA_EXCEEDED",
        403,
        "QUOTA_EXCEEDED",
      );
    }
    if (e instanceof StorageReservationError && e.code === "VALIDATION") {
      throw new EntitlementDeniedError(
        STORAGE_MAX_KEY,
        "INVALID_ENTITLEMENT",
        403,
        "ENTITLEMENT_DENIED",
      );
    }
    if (e instanceof StorageReservationError && e.code === "CONFLICT") {
      throw new EntitlementDeniedError(
        STORAGE_MAX_KEY,
        "INVALID_ENTITLEMENT",
        409,
        "ENTITLEMENT_DENIED",
      );
    }
    throw e;
  }
}

export async function finishStorageReservation(params: {
  tenantId: string;
  operationId: string;
  actualBytes: number;
  outcome: "commit" | "release";
}): Promise<void> {
  const reservation = await getStorageReservationByOperation({
    tenantId: params.tenantId,
    operationId: params.operationId,
  });
  if (!reservation) return;
  if (reservation.status !== "RESERVED") return;

  if (params.outcome === "release") {
    await releaseStorageReservation({
      tenantId: params.tenantId,
      reservationId: reservation.id,
    });
    return;
  }

  try {
    await commitStorageReservation({
      tenantId: params.tenantId,
      reservationId: reservation.id,
      actualBytes: params.actualBytes,
    });
  } catch (e) {
    if (
      e instanceof StorageReservationError &&
      e.code === "VALIDATION"
    ) {
      await releaseStorageReservation({
        tenantId: params.tenantId,
        reservationId: reservation.id,
      }).catch(() => {});
      throw new EntitlementDeniedError(
        STORAGE_MAX_KEY,
        "QUOTA_EXCEEDED",
        403,
        "QUOTA_EXCEEDED",
      );
    }
    throw e;
  }
}

/** Whether a prepare/buffer reservation is still RESERVED for this operation. */
export async function hasActiveStorageReservation(params: {
  tenantId: string;
  operationId: string;
}): Promise<boolean> {
  const reservation = await getStorageReservationByOperation({
    tenantId: params.tenantId,
    operationId: params.operationId,
  });
  return reservation?.status === "RESERVED";
}
