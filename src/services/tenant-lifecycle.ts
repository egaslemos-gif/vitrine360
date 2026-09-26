/**
 * PLATFORM-IDENTITY-09 — Tenant suspend / reactivate + operable queries.
 * Hard delete is intentionally absent.
 */
import { and, eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { tenants } from "@/db/schema";
import {
  isTenantOperableStatus,
  isTenantStatus,
  type TenantStatus,
} from "@/domain/tenant-lifecycle";
import { logActivity } from "@/services/activity-log";

export class TenantLifecycleError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "INVALID_STATUS" | "NOT_OPERABLE",
    readonly status = 400,
  ) {
    super(message);
    this.name = "TenantLifecycleError";
  }
}

export async function getTenantLifecycleStatus(
  tenantId: string,
): Promise<string | null> {
  await ensureSchema();
  const [row] = await db
    .select({ status: tenants.status })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return row?.status ?? null;
}

export async function isTenantOperable(tenantId: string): Promise<boolean> {
  const status = await getTenantLifecycleStatus(tenantId);
  if (status === null) return false;
  return isTenantOperableStatus(status);
}

/** Fail closed when tenant missing or not ACTIVE. */
export async function assertTenantOperable(tenantId: string): Promise<void> {
  const ok = await isTenantOperable(tenantId);
  if (!ok) {
    throw new TenantLifecycleError("Tenant not operable", "NOT_OPERABLE", 403);
  }
}

async function setTenantStatus(params: {
  tenantId: string;
  to: TenantStatus;
  actorUserId: string;
  actorIp?: string | null;
  reason?: string | null;
  action: "platform.tenant.suspend" | "platform.tenant.reactivate";
}): Promise<{
  tenantId: string;
  status: TenantStatus;
  from: string;
  idempotent: boolean;
}> {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, params.tenantId))
    .limit(1);
  if (!row) {
    throw new TenantLifecycleError("Tenant not found", "NOT_FOUND", 404);
  }
  if (!isTenantStatus(params.to)) {
    throw new TenantLifecycleError("Invalid status", "INVALID_STATUS", 400);
  }

  const from = row.status;
  const idempotent = from === params.to;
  if (!idempotent) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db
      .update(tenants)
      .set({ status: params.to, updatedAt: now })
      .where(
        and(eq(tenants.id, params.tenantId), eq(tenants.status, from)),
      );
  }

  await logActivity({
    userId: params.actorUserId,
    tenantId: null,
    action: params.action,
    resource: "tenant",
    resourceId: params.tenantId,
    ip: params.actorIp ?? null,
    metadata: {
      from,
      to: params.to,
      reason: params.reason ?? null,
      idempotent,
    },
  });

  return {
    tenantId: params.tenantId,
    status: params.to,
    from,
    idempotent,
  };
}

export async function suspendTenant(params: {
  tenantId: string;
  actorUserId: string;
  actorIp?: string | null;
  reason?: string | null;
}) {
  return setTenantStatus({
    ...params,
    to: "SUSPENDED",
    action: "platform.tenant.suspend",
  });
}

export async function reactivateTenant(params: {
  tenantId: string;
  actorUserId: string;
  actorIp?: string | null;
  reason?: string | null;
}) {
  return setTenantStatus({
    ...params,
    to: "ACTIVE",
    action: "platform.tenant.reactivate",
  });
}
