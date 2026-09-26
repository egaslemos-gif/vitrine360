/**
 * PLATFORM-IDENTITY-10I — Storage reservation service (foundation).
 *
 * Atomic reserve/release/commit primitives. NOT wired to upload APIs.
 * NOT connected to storage.maxBytes entitlements / ENTITLEMENTS_ENABLED.
 */
import { and, eq, isNotNull, lt, sum } from "drizzle-orm";
import { db, withTenantAllocationLock, type AllocationTx } from "@/db";
import { mediaAssets, storageReservations, tenants } from "@/db/schema";
import {
  assertActualWithinReservation,
  canTransitionReservation,
  isStorageReservationStatus,
  type StorageReservation,
  type StorageReservationStatus,
  validateExpectedBytes,
  validateMaxBytes,
  type ReserveStorageInput,
} from "@/domain/storage-reservation";
import { getTenantStorageUsage } from "@/services/usage";

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 52_428_800);

export class StorageReservationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "VALIDATION"
      | "NOT_FOUND"
      | "CONFLICT"
      | "QUOTA_EXCEEDED"
      | "INVALID_TRANSITION"
      | "TENANT_REQUIRED"
      | "FORBIDDEN" = "VALIDATION",
  ) {
    super(message);
    this.name = "StorageReservationError";
  }
}

function requireTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== "string" || !tenantId.trim()) {
    throw new StorageReservationError("tenantId required", "TENANT_REQUIRED");
  }
  return tenantId.trim();
}

function requireOperationId(operationId: string): string {
  if (
    !operationId ||
    typeof operationId !== "string" ||
    !operationId.trim() ||
    operationId.length > 128
  ) {
    throw new StorageReservationError(
      "operationId required (1–128 chars)",
      "VALIDATION",
    );
  }
  return operationId.trim();
}

function rowToReservation(
  row: typeof storageReservations.$inferSelect,
): StorageReservation {
  if (!isStorageReservationStatus(row.status)) {
    throw new StorageReservationError("invalid status in DB", "VALIDATION");
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    operationId: row.operationId,
    expectedBytes: row.expectedBytes,
    status: row.status,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    committedAt: row.committedAt,
    releasedAt: row.releasedAt,
  };
}

type Executor = AllocationTx | typeof db;

async function tenantExists(tenantId: string, executor: Executor): Promise<boolean> {
  const [row] = await executor
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return Boolean(row);
}

async function sumCommittedBytes(
  tenantId: string,
  executor: Executor,
): Promise<number> {
  const [row] = await executor
    .select({ total: sum(mediaAssets.fileSize) })
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, tenantId));
  const raw = row?.total;
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function sumActiveReservedBytes(
  tenantId: string,
  executor: Executor,
): Promise<number> {
  const [row] = await executor
    .select({ total: sum(storageReservations.expectedBytes) })
    .from(storageReservations)
    .where(
      and(
        eq(storageReservations.tenantId, tenantId),
        eq(storageReservations.status, "RESERVED"),
      ),
    );
  const raw = row?.total;
  if (raw === null || raw === undefined) return 0;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

/** Active reserved bytes (status = RESERVED only). */
export async function getTenantReservedStorageUsage(
  tenantId: string,
): Promise<number> {
  const tid = requireTenantId(tenantId);
  return sumActiveReservedBytes(tid, db);
}

/**
 * committed + active reserved. Internal foundation helper — not a public API.
 * Does not enforce quotas.
 */
export async function getTenantEffectiveStorageUsage(
  tenantId: string,
): Promise<{ committed: number; reserved: number; effective: number }> {
  const tid = requireTenantId(tenantId);
  const committed = await getTenantStorageUsage(tid);
  const reserved = await getTenantReservedStorageUsage(tid);
  return { committed, reserved, effective: committed + reserved };
}

export async function getStorageReservation(params: {
  tenantId: string;
  reservationId: string;
}): Promise<StorageReservation | null> {
  const tid = requireTenantId(params.tenantId);
  const [row] = await db
    .select()
    .from(storageReservations)
    .where(
      and(
        eq(storageReservations.id, params.reservationId),
        eq(storageReservations.tenantId, tid),
      ),
    )
    .limit(1);
  return row ? rowToReservation(row) : null;
}

export async function getStorageReservationByOperation(params: {
  tenantId: string;
  operationId: string;
}): Promise<StorageReservation | null> {
  const tid = requireTenantId(params.tenantId);
  const operationId = requireOperationId(params.operationId);
  const [row] = await db
    .select()
    .from(storageReservations)
    .where(
      and(
        eq(storageReservations.tenantId, tid),
        eq(storageReservations.operationId, operationId),
      ),
    )
    .limit(1);
  return row ? rowToReservation(row) : null;
}

/**
 * Atomically reserve storage capacity against a conceptual maxBytes.
 * Uses drizzle BEGIN IMMEDIATE via withTenantAllocationLock (same as PI-10G).
 * Does NOT read PlanEntitlements / ENTITLEMENTS_ENABLED.
 */
export async function reserveStorage(
  input: ReserveStorageInput,
): Promise<StorageReservation> {
  const tenantId = requireTenantId(input.tenantId);
  const operationId = requireOperationId(input.operationId);

  const bytesCheck = validateExpectedBytes(input.expectedBytes, MAX_UPLOAD);
  if (!bytesCheck.ok) {
    throw new StorageReservationError(bytesCheck.message, "VALIDATION");
  }
  const maxCheck = validateMaxBytes(input.maxBytes);
  if (!maxCheck.ok) {
    throw new StorageReservationError(maxCheck.message, "VALIDATION");
  }
  const expectedBytes = bytesCheck.value;
  const maxBytes = maxCheck.value;

  return withTenantAllocationLock(tenantId, async (tx) => {
    if (!(await tenantExists(tenantId, tx))) {
      throw new StorageReservationError("Tenant not found", "NOT_FOUND");
    }

    // Lazy release of overdue RESERVED rows (PI-10K). Not a background TTL worker
    // (DEC-STORAGE-08 remains OPEN); frees stuck prepare quota on next allocation.
    const nowIso = new Date().toISOString();
    await tx
      .update(storageReservations)
      .set({ status: "RELEASED", releasedAt: nowIso })
      .where(
        and(
          eq(storageReservations.tenantId, tenantId),
          eq(storageReservations.status, "RESERVED"),
          isNotNull(storageReservations.expiresAt),
          lt(storageReservations.expiresAt, nowIso),
        ),
      );

    const [existing] = await tx
      .select()
      .from(storageReservations)
      .where(
        and(
          eq(storageReservations.tenantId, tenantId),
          eq(storageReservations.operationId, operationId),
        ),
      )
      .limit(1);

    if (existing) {
      const current = rowToReservation(existing);
      if (current.status === "RESERVED") {
        if (current.expectedBytes !== expectedBytes) {
          throw new StorageReservationError(
            "operationId already reserved with different expectedBytes",
            "CONFLICT",
          );
        }
        return current;
      }
      throw new StorageReservationError(
        `operationId already used (status=${current.status})`,
        "CONFLICT",
      );
    }

    const committed = await sumCommittedBytes(tenantId, tx);
    const reserved = await sumActiveReservedBytes(tenantId, tx);
    if (committed + reserved + expectedBytes > maxBytes) {
      throw new StorageReservationError(
        "storage reservation would exceed conceptual max",
        "QUOTA_EXCEEDED",
      );
    }

    const id = crypto.randomUUID();
    const now = nowIso;
    await tx.insert(storageReservations).values({
      id,
      tenantId,
      operationId,
      expectedBytes,
      status: "RESERVED",
      createdAt: now,
      expiresAt: input.expiresAt ?? null,
      committedAt: null,
      releasedAt: null,
    });

    const [created] = await tx
      .select()
      .from(storageReservations)
      .where(eq(storageReservations.id, id))
      .limit(1);
    if (!created) {
      throw new StorageReservationError("reservation insert failed", "CONFLICT");
    }
    return rowToReservation(created);
  });
}

/**
 * Mark reservation RELEASED. Idempotent for already-RELEASED.
 * Tenant-scoped. Does not mutate MediaAsset / committed usage.
 */
export async function releaseStorageReservation(params: {
  tenantId: string;
  reservationId: string;
}): Promise<StorageReservation> {
  const tenantId = requireTenantId(params.tenantId);
  return withTenantAllocationLock(tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(storageReservations)
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new StorageReservationError("Reservation not found", "NOT_FOUND");
    }
    const current = rowToReservation(row);
    if (current.status === "RELEASED") {
      return current;
    }
    if (!canTransitionReservation(current.status, "RELEASED")) {
      throw new StorageReservationError(
        `cannot release from status ${current.status}`,
        "INVALID_TRANSITION",
      );
    }
    const now = new Date().toISOString();
    await tx
      .update(storageReservations)
      .set({ status: "RELEASED", releasedAt: now })
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      );
    return {
      ...current,
      status: "RELEASED",
      releasedAt: now,
    };
  });
}

/**
 * Mark reservation COMMITTED (foundation). Does NOT create MediaAsset.
 * Future upload integration must commit asset + reservation consistently.
 */
export async function commitStorageReservation(params: {
  tenantId: string;
  reservationId: string;
  /** Optional actual size check (DEC-STORAGE-03). */
  actualBytes?: number;
}): Promise<StorageReservation> {
  const tenantId = requireTenantId(params.tenantId);
  return withTenantAllocationLock(tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(storageReservations)
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new StorageReservationError("Reservation not found", "NOT_FOUND");
    }
    const current = rowToReservation(row);
    if (current.status === "COMMITTED") {
      return current;
    }
    if (!canTransitionReservation(current.status, "COMMITTED")) {
      throw new StorageReservationError(
        `cannot commit from status ${current.status}`,
        "INVALID_TRANSITION",
      );
    }
    if (params.actualBytes !== undefined) {
      const check = assertActualWithinReservation({
        reservedBytes: current.expectedBytes,
        actualBytes: params.actualBytes,
      });
      if (!check.ok) {
        throw new StorageReservationError(
          "actualBytes exceeds reserved expectedBytes",
          "VALIDATION",
        );
      }
    }
    const now = new Date().toISOString();
    await tx
      .update(storageReservations)
      .set({ status: "COMMITTED", committedAt: now })
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      );
    return {
      ...current,
      status: "COMMITTED",
      committedAt: now,
    };
  });
}

/**
 * Structural mark EXPIRED only (no TTL worker). Does not auto-release.
 * Active reserved usage excludes EXPIRED.
 */
export async function markStorageReservationExpired(params: {
  tenantId: string;
  reservationId: string;
}): Promise<StorageReservation> {
  const tenantId = requireTenantId(params.tenantId);
  return withTenantAllocationLock(tenantId, async (tx) => {
    const [row] = await tx
      .select()
      .from(storageReservations)
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      )
      .limit(1);
    if (!row) {
      throw new StorageReservationError("Reservation not found", "NOT_FOUND");
    }
    const current = rowToReservation(row);
    if (current.status === "EXPIRED") return current;
    if (!canTransitionReservation(current.status, "EXPIRED")) {
      throw new StorageReservationError(
        `cannot expire from status ${current.status}`,
        "INVALID_TRANSITION",
      );
    }
    await tx
      .update(storageReservations)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(storageReservations.id, params.reservationId),
          eq(storageReservations.tenantId, tenantId),
        ),
      );
    return { ...current, status: "EXPIRED" };
  });
}

/** Re-export for tests / foundation callers. */
export { assertActualWithinReservation, isStorageReservationStatus };
export type { StorageReservation, StorageReservationStatus };
