/**
 * PLATFORM-IDENTITY-05B — Dual-axis authorization (Control Plane).
 *
 * getSession() remains tenant-only. JWT claims unchanged.
 * Platform authority = flag ON + ACTIVE platform_assignments + static catalogue.
 */
import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db, ensureSchema } from "@/db";
import { users } from "@/db/schema";
import {
  hasPlatformPermission as roleHasPlatformPermission,
  isPlatformRole,
  platformPermissionsForRoles,
  type PlatformPermission,
  type PlatformRole,
} from "@/domain/platform-identity";
import {
  ROLE_PERMISSIONS,
  type Permission,
  type UserRole,
} from "@/domain/types";
import {
  AuthError,
  SESSION_COOKIE,
  getAuthSecretString,
} from "@/lib/auth";
import { isPlatformIdentityEnabled } from "@/lib/platform-identity-flag";
import { membershipRole, resolveActiveMembership } from "@/services/memberships";
import { findActiveByUser } from "@/services/platform-identity";

export type TenantAuthz = {
  tenantId: string;
  role: UserRole;
  permissions: readonly Permission[];
};

export type PlatformAuthz = {
  roles: readonly PlatformRole[];
  permissions: readonly PlatformPermission[];
};

export type AuthContext = {
  userId: string;
  email: string;
  name: string;
  tenant: TenantAuthz | null;
  platform: PlatformAuthz | null;
  flag: { platformIdentityEnabled: boolean };
};

export async function resolvePlatformAuthz(
  userId: string,
): Promise<PlatformAuthz | null> {
  if (!isPlatformIdentityEnabled()) return null;
  const rows = await findActiveByUser(userId);
  const roles = rows
    .map((r) => r.role)
    .filter(isPlatformRole);
  if (!roles.length) {
    return { roles: [], permissions: [] };
  }
  return {
    roles,
    permissions: platformPermissionsForRoles(roles),
  };
}

export async function resolveTenantAuthz(
  userId: string,
  claimedTenantId?: string | null,
): Promise<TenantAuthz | null> {
  const membership = await resolveActiveMembership(userId, claimedTenantId);
  if (!membership || membership.status !== "ACTIVE") return null;
  const { isTenantOperable } = await import("@/services/tenant-lifecycle");
  if (!(await isTenantOperable(membership.tenantId))) return null;
  const role = membershipRole(membership);
  return {
    tenantId: membership.tenantId,
    role,
    permissions: ROLE_PERMISSIONS[role],
  };
}

/**
 * Build AuthContext from known user id (tests + server). JWT is not consulted.
 */
export async function buildAuthContext(params: {
  userId: string;
  claimedTenantId?: string | null;
}): Promise<AuthContext | null> {
  await ensureSchema();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);
  if (!user) return null;

  const enabled = isPlatformIdentityEnabled();
  const tenant = await resolveTenantAuthz(user.id, params.claimedTenantId);
  const platform = enabled ? await resolvePlatformAuthz(user.id) : null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenant,
    platform,
    flag: { platformIdentityEnabled: enabled },
  };
}

/**
 * Dual-axis context from session cookie. Does not mutate getSession().
 * Returns null when cookie/JWT/user invalid.
 *
 * When `req` is provided, the session token is read from the Cookie header
 * (supports HTTP tests and explicit request-scoped auth).
 * Otherwise falls back to Next `cookies()`.
 */
export async function getAuthContext(
  req?: Request,
): Promise<AuthContext | null> {
  const token = req
    ? readSessionTokenFromRequest(req)
    : await readSessionTokenFromCookieStore();
  if (!token) return null;
  return getAuthContextFromSessionToken(token);
}

function readSessionTokenFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(trimmed.slice(SESSION_COOKIE.length + 1));
    }
  }
  return null;
}

async function readSessionTokenFromCookieStore(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function getAuthContextFromSessionToken(
  token: string,
): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(getAuthSecretString()),
    );
    if (!payload.sub || typeof payload.email !== "string") return null;
    const claimedTenant =
      typeof payload.activeTenantId === "string"
        ? payload.activeTenantId
        : typeof payload.tenantId === "string"
          ? payload.tenantId
          : null;
    return buildAuthContext({
      userId: payload.sub,
      claimedTenantId: claimedTenant,
    });
  } catch {
    return null;
  }
}

export function contextHasPlatformPermission(
  ctx: AuthContext,
  permission: PlatformPermission,
): boolean {
  if (!ctx.flag.platformIdentityEnabled) return false;
  if (!ctx.platform) return false;
  return roleHasPlatformPermission(ctx.platform.roles, permission);
}

export function assertPlatformPermission(
  ctx: AuthContext,
  permission: PlatformPermission,
): void {
  if (!contextHasPlatformPermission(ctx, permission)) {
    throw new AuthError("Forbidden", 403);
  }
}

export async function requirePlatformPermission(
  permission: PlatformPermission,
  req?: Request,
): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (!ctx) throw new AuthError("Unauthorized", 401);
  assertPlatformPermission(ctx, permission);
  return ctx;
}
