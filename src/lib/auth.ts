import { createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
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

export async function createSessionToken(user: SessionUser) {
  const activeTenantId = user.activeTenantId || user.tenantId;
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: activeTenantId,
    activeTenantId,
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

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
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
    const { ensureSchema } = await import("@/db");
    await ensureSchema();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) return null;
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
  } catch {
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
