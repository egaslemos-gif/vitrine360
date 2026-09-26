/**
 * PLATFORM-IDENTITY-10I — Storage reservation domain (foundation only).
 * No upload enforcement. No TTL worker. DEC-STORAGE-07/08 remain OPEN.
 */

export const STORAGE_RESERVATION_STATUSES = [
  "RESERVED",
  "COMMITTED",
  "RELEASED",
  "EXPIRED",
] as const;

export type StorageReservationStatus =
  (typeof STORAGE_RESERVATION_STATUSES)[number];

export function isStorageReservationStatus(
  v: unknown,
): v is StorageReservationStatus {
  return (
    typeof v === "string" &&
    (STORAGE_RESERVATION_STATUSES as readonly string[]).includes(v)
  );
}

/** Statuses that hold capacity against a conceptual max. */
export const ACTIVE_RESERVATION_STATUSES: readonly StorageReservationStatus[] =
  ["RESERVED"];

export function isActiveReservationStatus(
  status: StorageReservationStatus,
): boolean {
  return status === "RESERVED";
}

export type StorageReservation = {
  id: string;
  tenantId: string;
  operationId: string;
  expectedBytes: number;
  status: StorageReservationStatus;
  createdAt: string;
  expiresAt: string | null;
  committedAt: string | null;
  releasedAt: string | null;
};

export type ReserveStorageInput = {
  tenantId: string;
  operationId: string;
  expectedBytes: number;
  /**
   * Conceptual HARD_LIMIT for foundation/tests only.
   * NOT loaded from PlanEntitlements in PI-10I (no enforcement wiring).
   */
  maxBytes: number;
  /** Optional structural expiry timestamp (ISO). No auto-expiry worker. */
  expiresAt?: string | null;
};

export function validateExpectedBytes(
  expectedBytes: unknown,
  maxUploadBytes: number,
): { ok: true; value: number } | { ok: false; code: string; message: string } {
  if (typeof expectedBytes !== "number" || !Number.isFinite(expectedBytes)) {
    return {
      ok: false,
      code: "INVALID_EXPECTED_BYTES",
      message: "expectedBytes must be a finite number",
    };
  }
  if (!Number.isInteger(expectedBytes)) {
    return {
      ok: false,
      code: "INVALID_EXPECTED_BYTES",
      message: "expectedBytes must be an integer",
    };
  }
  if (expectedBytes <= 0) {
    return {
      ok: false,
      code: "INVALID_EXPECTED_BYTES",
      message: "expectedBytes must be a positive integer",
    };
  }
  if (expectedBytes > maxUploadBytes) {
    return {
      ok: false,
      code: "EXPECTED_BYTES_EXCEEDS_UPLOAD_LIMIT",
      message: `expectedBytes exceeds MAX_UPLOAD_BYTES (${maxUploadBytes})`,
    };
  }
  return { ok: true, value: expectedBytes };
}

export function validateMaxBytes(
  maxBytes: unknown,
): { ok: true; value: number } | { ok: false; code: string; message: string } {
  if (typeof maxBytes !== "number" || !Number.isFinite(maxBytes)) {
    return {
      ok: false,
      code: "INVALID_MAX_BYTES",
      message: "maxBytes must be a finite number",
    };
  }
  if (!Number.isInteger(maxBytes) || maxBytes < 0) {
    return {
      ok: false,
      code: "INVALID_MAX_BYTES",
      message: "maxBytes must be a non-negative integer",
    };
  }
  return { ok: true, value: maxBytes };
}

/**
 * Pure check: actual must not exceed reserved (DEC-STORAGE-03).
 * Foundation helper — not wired to upload complete yet.
 */
export function assertActualWithinReservation(input: {
  reservedBytes: number;
  actualBytes: number;
}): { ok: true } | { ok: false; code: "ACTUAL_EXCEEDS_RESERVED" } {
  if (
    !Number.isFinite(input.actualBytes) ||
    !Number.isInteger(input.actualBytes) ||
    input.actualBytes < 0
  ) {
    return { ok: false, code: "ACTUAL_EXCEEDS_RESERVED" };
  }
  if (input.actualBytes > input.reservedBytes) {
    return { ok: false, code: "ACTUAL_EXCEEDS_RESERVED" };
  }
  return { ok: true };
}

export function canTransitionReservation(
  from: StorageReservationStatus,
  to: StorageReservationStatus,
): boolean {
  if (from === to) return true; // idempotent no-op
  switch (from) {
    case "RESERVED":
      return to === "COMMITTED" || to === "RELEASED" || to === "EXPIRED";
    case "EXPIRED":
      return to === "RELEASED";
    case "COMMITTED":
    case "RELEASED":
      return false;
    default:
      return false;
  }
}

/**
 * Dedupe + reservation interaction (model only — PI-10I).
 * Same tenant + checksum should yield one MediaAsset; concurrent first-time
 * uploads may briefly hold two reservations until one commits and the other
 * releases. Full dedupe-aware reserve is deferred to enforcement phase.
 */
export const DEDUPE_RESERVATION_NOTE =
  "Same checksum reuse should not permanently double-count; concurrent first uploads may reserve twice until one commits — release the loser. Not wired in upload yet.";
