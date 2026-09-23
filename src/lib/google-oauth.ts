import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify, createRemoteJWKSet, createLocalJWKSet } from "jose";
import type { JWTPayload, JWTVerifyGetKey } from "jose";
import { getAuthSecretString } from "@/lib/auth";

export const GOOGLE_SCOPES = "openid email profile";
export const GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
export const OAUTH_COOKIE = "v360_oauth";
export const LINK_COOKIE = "v360_google_link";

const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export type OAuthTransaction = {
  state: string;
  nonce: string;
  verifier: string;
};

export type GoogleIdentityClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  nonce?: string;
};

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  return { clientId, clientSecret };
}

export function appOriginFrom(requestOrigin: string) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  return requestOrigin.replace(/\/$/, "");
}

export function googleRedirectUri(origin: string) {
  return `${appOriginFrom(origin)}/api/auth/google/callback`;
}

export function createOAuthTransaction(): OAuthTransaction {
  return {
    state: randomBytes(24).toString("base64url"),
    nonce: randomBytes(24).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
  };
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function googleAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  transaction: OAuthTransaction;
}) {
  const url = new URL(GOOGLE_AUTHORIZE);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("state", params.transaction.state);
  url.searchParams.set("nonce", params.transaction.nonce);
  url.searchParams.set("code_challenge", codeChallenge(params.transaction.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function signOAuthCookie(transaction: OAuthTransaction) {
  return new SignJWT(transaction)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(getAuthSecretString()));
}

export async function signLinkCookie(claims: GoogleIdentityClaims) {
  return new SignJWT({
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(getAuthSecretString()));
}

export async function readLinkCookie(token: string): Promise<GoogleIdentityClaims | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(getAuthSecretString()),
    );
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: true,
      name: typeof payload.name === "string" ? payload.name : payload.email,
    };
  } catch {
    return null;
  }
}

export async function readOAuthCookie(token: string): Promise<OAuthTransaction | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(getAuthSecretString()),
    );
    if (
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.verifier !== "string"
    ) {
      return null;
    }
    return {
      state: payload.state,
      nonce: payload.nonce,
      verifier: payload.verifier,
    };
  } catch {
    return null;
  }
}

export function assertGoogleIdentityClaims(
  payload: JWTPayload,
  expected: { clientId: string; nonce: string },
): GoogleIdentityClaims {
  const iss = typeof payload.iss === "string" ? payload.iss : "";
  if (!ISSUERS.has(iss)) {
    throw new Error("invalid_issuer");
  }
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(expected.clientId)) {
    throw new Error("invalid_audience");
  }
  if (payload.nonce !== expected.nonce) {
    throw new Error("invalid_nonce");
  }
  if (typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("invalid_subject");
  }
  const emailVerified = payload.email_verified === true;
  if (!emailVerified) {
    throw new Error("email_unverified");
  }
  if (typeof payload.email !== "string" || !payload.email.includes("@")) {
    throw new Error("invalid_email");
  }
  const name =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : payload.email.split("@")[0];
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name,
    nonce: expected.nonce,
  };
}

let remoteJwks: JWTVerifyGetKey | null = null;

export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
  getKey?: JWTVerifyGetKey,
) {
  const key = getKey ?? (remoteJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS)));
  const { payload } = await jwtVerify(idToken, key, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: expected.clientId,
    clockTolerance: 60,
  });
  return assertGoogleIdentityClaims(payload, expected);
}

export { createLocalJWKSet };
