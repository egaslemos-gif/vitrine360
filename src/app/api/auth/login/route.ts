import { NextRequest } from "next/server";
import { z } from "zod";
import {
  authenticateUser,
  clearSessionCookie,
  getSession,
  sessionFromUser,
  setSessionCookie,
} from "@/lib/auth";
import { enforceRateLimit, handleApiError, jsonOk, jsonError } from "@/lib/api";
import { LINK_COOKIE, readLinkCookie } from "@/lib/google-oauth";
import { logActivity } from "@/services/activity-log";
import { linkGoogleIdentity } from "@/services/google-identity";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, "auth-login", 20, 60_000);
    if (limited) return limited;
    const body = loginSchema.parse(await req.json());
    const user = await authenticateUser(
      body.email,
      body.password,
      body.tenantSlug,
    );
    if (!user) {
      console.warn("[auth] login failed", { email: body.email });
      return jsonError("Invalid credentials", 401);
    }
    const session = await sessionFromUser(user);
    if (!session) return jsonError("Sem workspace activo", 403);
    const linkToken = req.cookies.get(LINK_COOKIE)?.value;
    if (linkToken) {
      const pending = await readLinkCookie(linkToken);
      if (pending && pending.email.toLowerCase() === user.email.toLowerCase()) {
        try {
          await linkGoogleIdentity({ userId: user.id, claims: pending });
        } catch {
          const conflict = jsonError(
            "Esta conta Google já está ligada a outro utilizador",
            409,
          );
          conflict.cookies.set(LINK_COOKIE, "", { path: "/", maxAge: 0 });
          return conflict;
        }
      }
    }
    await setSessionCookie(session);
    await logActivity({
      userId: session.id,
      tenantId: session.activeTenantId,
      action: "LOGIN_PASSWORD",
      resource: "user",
      resourceId: session.id,
    });
    const response = jsonOk({
      user: {
        id: session.id,
        email: session.email,
        name: session.name,
        role: session.role,
        tenantId: session.activeTenantId,
        activeTenantId: session.activeTenantId,
      },
    });
    if (linkToken) {
      response.cookies.set(LINK_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return response;
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE() {
  const session = await getSession();
  if (session) {
    await logActivity({
      userId: session.id,
      tenantId: session.activeTenantId,
      action: "LOGOUT",
      resource: "user",
      resourceId: session.id,
    });
  }
  await clearSessionCookie();
  return jsonOk({ ok: true });
}
