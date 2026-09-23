import { redirect } from "next/navigation";
import {
  getSession,
  requireSession,
  type SessionUser,
} from "@/lib/auth";
import {
  hasPermission,
  type Permission,
} from "@/domain/types";

/** Alias kept for call sites that read as permission-first. */
export async function requirePermission(
  permission: Permission,
): Promise<SessionUser> {
  return requireSession(permission);
}

/**
 * Page-level gate. Prefer this over bare getSession() on admin routes.
 * Unauthenticated → login redirect. Unauthorized → null (render AccessDenied).
 */
export async function requireAdminPage(
  permission?: Permission,
): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (permission && !hasPermission(session.role, permission)) {
    return null;
  }
  return session;
}
