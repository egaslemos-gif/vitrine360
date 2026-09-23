import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sessionFromUser, setSessionCookie } from "@/lib/auth";
import {
  GOOGLE_TOKEN,
  LINK_COOKIE,
  OAUTH_COOKIE,
  googleConfig,
  googleRedirectUri,
  readOAuthCookie,
  signLinkCookie,
  verifyGoogleIdToken,
} from "@/lib/google-oauth";
import { loginWithGoogleClaims } from "@/services/google-identity";

function fail(req: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/admin/login?error=${code}`, req.url));
  response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  if (url.searchParams.get("error")) {
    return fail(req, "oauth_cancelled");
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !cookie) return fail(req, "oauth_callback");
  const transaction = await readOAuthCookie(cookie);
  if (!transaction || transaction.state !== state) return fail(req, "oauth_state");

  const { clientId, clientSecret } = googleConfig();
  if (!clientId || !clientSecret) return fail(req, "config");

  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(url.origin),
      grant_type: "authorization_code",
      code_verifier: transaction.verifier,
    });
    const tokenRes = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!tokenRes.ok) return fail(req, "invalid_token");
    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) return fail(req, "invalid_token");
    const claims = await verifyGoogleIdToken(tokenJson.id_token, {
      clientId,
      nonce: transaction.nonce,
    });
    const result = await loginWithGoogleClaims(claims);
    if (result.kind === "link_required") {
      const link = await signLinkCookie(claims);
      const response = NextResponse.redirect(new URL("/admin/login?link=google", req.url));
      response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
      response.cookies.set(LINK_COOKIE, link, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 15,
      });
      return response;
    }
    const [user] = await db.select().from(users).where(eq(users.id, result.userId)).limit(1);
    if (!user) return fail(req, "membership");
    const session = await sessionFromUser(user);
    if (!session) return fail(req, "membership");
    await setSessionCookie(session);
    const response = NextResponse.redirect(new URL("/admin", req.url));
    response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "email_unverified") return fail(req, "email_unverified");
    return fail(req, "invalid_token");
  }
}
