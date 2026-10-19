import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SchemaNotReadyError, isUnpreparedSchemaError } from "@/lib/schema-readiness";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { logActivity } from "@/services/activity-log";
import {
  hasPermission,
  type Permission,
  type UserRole,
} from "@/domain/types";

const SESSION_COOKIE = "v360_session";
const SESSION_TTL = "12h";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Active workspace. Same value as activeTenantId. Existing callers keep using this. */
  tenantId: string;
  activeTenantId: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set (min 32 chars)");
  }
  return new TextEncoder().encode(secret);
}

export function getAuthSecretString() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set (min 32 chars)");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateDeviceToken() {
  return randomBytes(32).toString("base64url");
}

export function generatePairingSecret() {
  return randomBytes(24).toString("base64url");
}

export function generateActivationCode() {
  return String(randomInt(100000, 1000000));
}

export function normalizeSessionVersion(value: unknown): number | null {
  if (typeof value === "bigint") {
    if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/**
 * A missing `sv` claim is generation 0.
 * Any other missing, fractional, negative, or non-numeric claim is rejected.
 */
export function sessionClaimAccepted(claim: unknown, current: unknown): boolean {
  const version = normalizeSessionVersion(current);
  if (version === null) return false;
  if (claim === undefined) return version === 0;
  const presented = normalizeSessionVersion(claim);
  if (presented === null) return false;
  return presented === version;
}

export async function createSessionToken(user: SessionUser) {
  const activeTenantId = user.activeTenantId || user.tenantId;
  const [row] = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) throw new Error("session_version_unavailable");
  const sessionVersion = normalizeSessionVersion(row.sessionVersion);
  if (sessionVersion === null) throw new SchemaNotReadyError("schema_not_ready");
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: activeTenantId,
    activeTenantId,
    sv: sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function setSessionCookie(user: SessionUser) {
  const token = await createSessionToken(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * Audit and session revocation commit together.
 * The caller clears the cookie only after this resolves.
 * `session.id` must come from a validated session, never from the request body.
 */
export async function completeLogout(session: SessionUser): Promise<void> {
  await db.transaction(async (tx) => {
    await logActivity(
      {
        userId: session.id,
        tenantId: session.activeTenantId,
        action: "LOGOUT",
        resource: "user",
        resourceId: session.id,
      },
      tx,
    );
    const updated = await tx
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, session.id))
      .returning({ sessionVersion: users.sessionVersion });
    if (updated.length !== 1 || normalizeSessionVersion(updated[0]?.sessionVersion) === null) {
      throw new Error("session_revoke_failed");
    }
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return readSessionFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** Cookie-free session read. A missing schema is thrown, not treated as anonymous. */
export async function readSessionFromToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    const claimedTenant =
      typeof payload.activeTenantId === "string"
        ? payload.activeTenantId
        : typeof payload.tenantId === "string"
          ? payload.tenantId
          : null;
    if (!claimedTenant) return null;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) return null;
    if (!sessionClaimAccepted(payload.sv, user.sessionVersion)) return null;
    const { membershipRole, resolveActiveMembership } = await import(
      "@/services/memberships"
    );
    const membership = await resolveActiveMembership(user.id, claimedTenant);
    if (!membership || membership.status !== "ACTIVE") return null;
    const { isTenantOperable } = await import("@/services/tenant-lifecycle");
    if (!(await isTenantOperable(membership.tenantId))) return null;
    const role = membershipRole(membership);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role,
      tenantId: membership.tenantId,
      activeTenantId: membership.tenantId,
    };
  } catch (error) {
    if (isUnpreparedSchemaError(error)) throw error;
    return null;
  }
}

export async function requireRole(roles: readonly UserRole[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export async function requireSession(
  permission?: Permission,
): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Unauthorized", 401);
  if (!session.tenantId) throw new AuthError("Tenant required", 403);
  if (permission && !hasPermission(session.role, permission)) {
    throw new AuthError("Forbidden", 403);
  }
  return session;
}

export async function authenticateUser(
  email: string,
  password: string,
  tenantSlug?: string,
): Promise<User | null> {
  let candidates: User[];
  if (tenantSlug) {
    const { getTenantBySlug } = await import("@/services/tenants");
    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return null;
    candidates = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.tenantId, tenant.id)))
      .limit(1);
  } else {
    candidates = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(5);
    if (candidates.length > 1) {
      throw new AuthError("tenantSlug required for this account", 400);
    }
  }
  for (const user of candidates) {
    const ok = await verifyPassword(password, user.passwordHash);
    if (ok) return user;
  }
  return null;
}

export async function sessionFromUser(
  user: User,
  preferredTenantId?: string | null,
): Promise<SessionUser | null> {
  const { membershipRole, resolveActiveMembership } = await import(
    "@/services/memberships"
  );
  const membership = await resolveActiveMembership(user.id, preferredTenantId);
  if (!membership) return null;
  const { isTenantOperable } = await import("@/services/tenant-lifecycle");
  if (!(await isTenantOperable(membership.tenantId))) return null;
  const role = membershipRole(membership);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    tenantId: membership.tenantId,
    activeTenantId: membership.tenantId,
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export { SESSION_COOKIE };
