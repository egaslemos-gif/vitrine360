/**
 * Tenant Drive OAuth helpers — read path (token refresh + feature flag).
 * Connect/PKCE/cookie flows live on branches that ship admin Drive UI;
 * device-media only needs refresh + isTenantDriveEnabled.
 *
 * Origin: adapted from Vitrine360 main `src/lib/google-drive-oauth.ts`
 * (subset for media read; no connect UI).
 */
import { GOOGLE_TOKEN, googleConfig } from "@/lib/google-oauth";

export function isTenantDriveEnabled(): boolean {
  const v = (process.env.TENANT_DRIVE_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Exchange a stored refresh token for a short-lived access token.
 * Uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (OAuth client), not SA keys.
 * Never log the refresh or access token.
 */
export async function refreshDriveAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; status: number }> {
  const { clientId, clientSecret } = googleConfig();
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured");
  }
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Drive token refresh failed: ${body}`) as Error & {
      status?: number;
      temporary?: boolean;
    };
    err.status = res.status;
    err.temporary = res.status >= 500 || res.status === 429;
    throw err;
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    status: res.status,
  };
}
