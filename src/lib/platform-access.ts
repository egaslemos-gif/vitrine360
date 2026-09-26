/**
 * PLATFORM-IDENTITY-07 — Server page gate for Platform Console.
 * Uses platform axis only — never membership SUPER_ADMIN.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isPlatformIdentityEnabled } from "@/lib/platform-identity-flag";
import {
  contextHasPlatformPermission,
  getAuthContext,
  type AuthContext,
} from "@/lib/platform-authz";
import type { PlatformPermission } from "@/domain/platform-identity";

export type PlatformPageResult =
  | { kind: "ok"; ctx: AuthContext }
  | { kind: "forbidden" }
  | { kind: "disabled" };

/**
 * Unauthenticated → login redirect.
 * Flag OFF → disabled (caller renders unavailable state).
 * Missing platform permission → forbidden (caller renders AccessDenied).
 */
export async function requirePlatformPage(
  permission: PlatformPermission = "platform.tenants.read",
): Promise<PlatformPageResult> {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  if (!isPlatformIdentityEnabled()) {
    return { kind: "disabled" };
  }

  const ctx = await getAuthContext();
  if (!ctx || !contextHasPlatformPermission(ctx, permission)) {
    return { kind: "forbidden" };
  }
  return { kind: "ok", ctx };
}
