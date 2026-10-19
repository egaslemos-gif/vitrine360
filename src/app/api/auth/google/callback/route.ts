import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logAuthTiming, sessionFromUser, setSessionCookie } from "@/lib/auth";
import {
  GOOGLE_TOKEN,
  LINK_COOKIE,
  OAUTH_COOKIE,
  googleConfig,
  googleRedirectUri,
  isAuthorizedOAuthOrigin,
  readOAuthCookie,
  safeAppRelativeRedirect,
  signLinkCookie,
  verifyGoogleIdToken,
} from "@/lib/google-oauth";
import { loginWithGoogleClaims } from "@/services/google-identity";

function fail(req: NextRequest, code: string) {
  const response = NextResponse.redirect(
    safeAppRelativeRedirect(req.url, `/admin/login?error=${code}`),
  );
  response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET(req: NextRequest) {
  const started = performance.now();
  const finish = (result: string) => logAuthTiming("google_handler", started, result);
  const url = req.nextUrl;
  // Reject before any token exchange. Do not redirect to an unallowlisted host
  // (would turn Host-header abuse into an open redirect).
  if (!isAuthorizedOAuthOrigin(url.origin)) {
    const response = new NextResponse("OAuth callback host not allowed", {
      status: 400,
    });
    response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
    finish("rejected");
    return response;
  }
  if (url.searchParams.get("error")) {
    finish("cancelled");
    return fail(req, "oauth_cancelled");
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !cookie) {
    finish("rejected");
    return fail(req, "oauth_callback");
  }
  const transaction = await readOAuthCookie(cookie);
  if (!transaction || transaction.state !== state) {
    finish("rejected");
    return fail(req, "oauth_state");
  }

  const { clientId, clientSecret } = googleConfig();
  if (!clientId || !clientSecret) {
    finish("config");
    return fail(req, "config");
  }

  try {
    // Must match the redirect_uri used at /api/auth/google start (same allowlist).
    const tokenStarted = performance.now();
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
    logAuthTiming("google_token", tokenStarted, tokenRes.ok ? "ok" : "fail");
    if (!tokenRes.ok) {
      finish("invalid_token");
      return fail(req, "invalid_token");
    }
    const tokenJson = (await tokenRes.json()) as { id_token?: string };
    if (!tokenJson.id_token) {
      finish("invalid_token");
      return fail(req, "invalid_token");
    }
    const verifyStarted = performance.now();
    const claims = await verifyGoogleIdToken(tokenJson.id_token, {
      clientId,
      nonce: transaction.nonce,
    });
    logAuthTiming("google_jwks", verifyStarted, "ok");
    const identityStarted = performance.now();
    const result = await loginWithGoogleClaims(claims);
    logAuthTiming("google_identity", identityStarted, result.kind);
    if (result.kind === "link_required") {
      const link = await signLinkCookie(claims);
      const response = NextResponse.redirect(
        safeAppRelativeRedirect(req.url, "/admin/login?link=google"),
      );
      response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
      response.cookies.set(LINK_COOKIE, link, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 15,
      });
      finish("link_required");
      return response;
    }
    const userStarted = performance.now();
    const [user] = await db.select().from(users).where(eq(users.id, result.userId)).limit(1);
    logAuthTiming("google_user", userStarted, user ? "ok" : "miss");
    if (!user) {
      finish("membership");
      return fail(req, "membership");
    }
    const membershipStarted = performance.now();
    const session = await sessionFromUser(user);
    logAuthTiming("membership_tenant", membershipStarted, session ? "ok" : "miss");
    if (!session) {
      finish("membership");
      return fail(req, "membership");
    }
    const sessionStarted = performance.now();
    await setSessionCookie(session);
    logAuthTiming("session", sessionStarted, "ok");
    const response = NextResponse.redirect(
      safeAppRelativeRedirect(req.url, "/admin"),
    );
    response.cookies.set(OAUTH_COOKIE, "", { path: "/", maxAge: 0 });
    finish("ok");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    finish(message === "email_unverified" ? "email_unverified" : "error");
    if (message === "email_unverified") return fail(req, "email_unverified");
    return fail(req, "invalid_token");
  }
}
