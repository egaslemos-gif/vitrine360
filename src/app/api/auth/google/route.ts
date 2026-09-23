import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_COOKIE,
  createOAuthTransaction,
  googleAuthorizeUrl,
  googleConfig,
  googleRedirectUri,
  signOAuthCookie,
} from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  const { clientId } = googleConfig();
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/admin/login?error=config", req.url));
  }
  const transaction = createOAuthTransaction();
  const token = await signOAuthCookie(transaction);
  const destination = googleAuthorizeUrl({
    clientId,
    redirectUri: googleRedirectUri(req.nextUrl.origin),
    transaction,
  });
  const response = NextResponse.redirect(destination);
  response.cookies.set(OAUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
