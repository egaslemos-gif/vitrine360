/**
 * PLATFORM-IDENTITY-04 — Platform Identity persistence.
 *
 * Storage only. Does NOT wire into authorization, JWT, session, or APIs.
 * Creating an assignment does not grant runtime platform access (PI-05+).
 */
import { and, eq } from "drizzle-orm";
import { db, ensureSchema, schema } from "@/db";
import {
  isPlatformIdentityStatus,
  isPlatformRole,
  type PlatformIdentityStatus,
  type PlatformRole,
} from "@/domain/platform-identity";
import { isPlatformIdentityEnabled } from "@/lib/platform-identity-flag";

export class PlatformIdentityError extends Error {
  constructor(
    message: string,
    readonly code:
      | "DISABLED"
      | "INVALID_ROLE"
      | "INVALID_STATUS"
      | "MISSING_USER"
      | "DUPLICATE"
      | "NOT_FOUND"
      | "TENANT_SCOPE_FORBIDDEN",
  ) {
    super(message);
    this.name = "PlatformIdentityError";
  }
}

export type PlatformAssignmentRow = typeof schema.platformAssignments.$inferSelect;

function assertInfrastructureAvailable() {
  if (!isPlatformIdentityEnabled()) {
    throw new PlatformIdentityError(
      "Platform Identity infrastructure is disabled (PLATFORM_IDENTITY_ENABLED)",
      "DISABLED",
    );
  }
}

export async function findByUser(
  userId: string,
): Promise<PlatformAssignmentRow[]> {
  assertInfrastructureAvailable();
  await ensureSchema();
  return db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.userId, userId));
}

export async function findActiveByUser(
  userId: string,
): Promise<PlatformAssignmentRow[]> {
  assertInfrastructureAvailable();
  await ensureSchema();
  return db
    .select()
    .from(schema.platformAssignments)
    .where(
      and(
        eq(schema.platformAssignments.userId, userId),
        eq(schema.platformAssignments.status, "ACTIVE"),
      ),
    );
}

export async function createPlatformAssignment(params: {
  userId: string;
  role: PlatformRole;
  status?: PlatformIdentityStatus;
  createdByUserId?: string | null;
  /** Rejected: Platform scope must not be created from a tenant id. */
  tenantId?: unknown;
}): Promise<PlatformAssignmentRow> {
  assertInfrastructureAvailable();
  if (params.tenantId !== undefined && params.tenantId !== null) {
    throw new PlatformIdentityError(
      "Platform assignments are global; tenantId must not be supplied",
      "TENANT_SCOPE_FORBIDDEN",
    );
  }
  if (!isPlatformRole(params.role)) {
    throw new PlatformIdentityError("Invalid platform role", "INVALID_ROLE");
  }
  const status = params.status ?? "ACTIVE";
  if (!isPlatformIdentityStatus(status)) {
    throw new PlatformIdentityError(
      "Invalid platform identity status",
      "INVALID_STATUS",
    );
  }

  await ensureSchema();
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, params.userId))
    .limit(1);
  if (!user) {
    throw new PlatformIdentityError("User does not exist", "MISSING_USER");
  }

  const [existing] = await db
    .select({ id: schema.platformAssignments.id })
    .from(schema.platformAssignments)
    .where(
      and(
        eq(schema.platformAssignments.userId, params.userId),
        eq(schema.platformAssignments.role, params.role),
      ),
    )
    .limit(1);
  if (existing) {
    throw new PlatformIdentityError(
      "Duplicate platform assignment for user+role",
      "DUPLICATE",
    );
  }

  const id = crypto.randomUUID();
  try {
    await db.insert(schema.platformAssignments).values({
      id,
      userId: params.userId,
      role: params.role,
      status,
      createdByUserId: params.createdByUserId ?? null,
    });
  } catch (err) {
    const msg = `${String(err)} ${err instanceof Error && err.cause ? String(err.cause) : ""}`.toLowerCase();
    if (
      msg.includes("unique") ||
      msg.includes("constraint") ||
      msg.includes("platform_assignments_user_role")
    ) {
      throw new PlatformIdentityError(
        "Duplicate platform assignment for user+role",
        "DUPLICATE",
      );
    }
    throw err;
  }

  const [row] = await db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.id, id))
    .limit(1);
  if (!row) {
    throw new PlatformIdentityError("Assignment not found after create", "NOT_FOUND");
  }
  return row;
}

export async function setPlatformAssignmentStatus(
  id: string,
  status: PlatformIdentityStatus,
): Promise<PlatformAssignmentRow> {
  assertInfrastructureAvailable();
  if (!isPlatformIdentityStatus(status)) {
    throw new PlatformIdentityError(
      "Invalid platform identity status",
      "INVALID_STATUS",
    );
  }
  await ensureSchema();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.platformAssignments)
    .set({ status, updatedAt: now })
    .where(eq(schema.platformAssignments.id, id));
  const [row] = await db
    .select()
    .from(schema.platformAssignments)
    .where(eq(schema.platformAssignments.id, id))
    .limit(1);
  if (!row) {
    throw new PlatformIdentityError("Assignment not found", "NOT_FOUND");
  }
  return row;
}

export async function revokePlatformAssignment(id: string) {
  return setPlatformAssignmentStatus(id, "REVOKED");
}

export async function suspendPlatformAssignment(id: string) {
  return setPlatformAssignmentStatus(id, "SUSPENDED");
}

/** Test/helper: active rows only. Not an authorization grant. */
export async function hasActivePlatformAssignment(
  userId: string,
  role?: PlatformRole,
): Promise<boolean> {
  if (!isPlatformIdentityEnabled()) return false;
  const active = await findActiveByUser(userId);
  if (!role) return active.length > 0;
  return active.some((row) => row.role === role);
}
