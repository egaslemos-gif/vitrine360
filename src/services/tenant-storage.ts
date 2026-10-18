/**
 * Tenant Drive — read path for device-media / asset-aware storage resolve.
 * Connect/disconnect/OAuth callback are not ported on this branch; Preview
 * already persists CONNECTED rows in tenant_storage_configs.
 *
 * Origin: subset of Vitrine360 main `src/services/tenant-storage.ts`
 * (getTenantDriveAccessToken + tryTenantGoogleDriveProvider).
 */
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { tenantStorageConfigs } from "@/db/schema";
import { decryptDriveSecret } from "@/lib/drive-token-crypto";
import {
  isTenantDriveEnabled,
  refreshDriveAccessToken,
} from "@/lib/google-drive-oauth";
import { GoogleDriveTenantProvider } from "@/services/media/google-drive-tenant-provider";
import type { MediaStorageProvider } from "@/services/media/types";

/** Cap in-process access-token lifetime so revocation is detected sooner. */
const ACCESS_TOKEN_CACHE_MAX_MS = 5 * 60 * 1000;

const accessTokenCache = new Map<
  string,
  { accessToken: string; expiresAt: number }
>();

export function invalidateTenantDriveAccessCache(tenantId: string): void {
  accessTokenCache.delete(tenantId);
}

/** Test-only: clear access-token cache. */
export function clearTenantDriveAccessCacheForTests(): void {
  accessTokenCache.clear();
}

export async function getTenantStorageConfig(tenantId: string) {
  await ensureSchema();
  const [row] = await db
    .select()
    .from(tenantStorageConfigs)
    .where(eq(tenantStorageConfigs.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

async function markConfigError(
  tenantId: string,
  patch: Partial<typeof tenantStorageConfigs.$inferInsert>,
) {
  await ensureSchema();
  const existing = await getTenantStorageConfig(tenantId);
  if (!existing) return;
  const now = new Date().toISOString();
  await db
    .update(tenantStorageConfigs)
    .set({ ...patch, updatedAt: now })
    .where(eq(tenantStorageConfigs.tenantId, tenantId));
}

export async function getTenantDriveAccessToken(
  tenantId: string,
): Promise<string> {
  const cached = accessTokenCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }
  const row = await getTenantStorageConfig(tenantId);
  if (!row?.googleRefreshTokenEnc) {
    throw new Error("DRIVE_NOT_CONNECTED");
  }
  let refresh: string;
  try {
    refresh = decryptDriveSecret(row.googleRefreshTokenEnc);
  } catch {
    invalidateTenantDriveAccessCache(tenantId);
    await markConfigError(tenantId, {
      status: "ERROR",
      lastError: "Token decrypt failed — reconnect Drive",
      googleRefreshTokenEnc: null,
      provider: "platform",
    });
    throw new Error("DRIVE_TOKEN_CORRUPT");
  }
  try {
    const next = await refreshDriveAccessToken(refresh);
    const ttl = Math.min(
      next.expiresIn * 1000 - 60_000,
      ACCESS_TOKEN_CACHE_MAX_MS,
    );
    accessTokenCache.set(tenantId, {
      accessToken: next.accessToken,
      expiresAt: Date.now() + Math.max(30_000, ttl),
    });
    return next.accessToken;
  } catch (err) {
    const status = (err as Error & { status?: number; temporary?: boolean })
      .status;
    const temporary = (err as Error & { temporary?: boolean }).temporary;
    invalidateTenantDriveAccessCache(tenantId);
    if (temporary || (status != null && status >= 500)) {
      throw err;
    }
    if (status === 400 || status === 401) {
      await markConfigError(tenantId, {
        status: "REVOKED",
        lastError: "Refresh token revoked — reconnect Drive",
        provider: "platform",
        googleRefreshTokenEnc: null,
        googleFolderId: row.googleFolderId,
      });
    }
    throw err;
  }
}

/**
 * Connected tenant Drive provider, or null if disabled / disconnected.
 * Call only after asset+tenant authorization in the device-media route.
 */
export async function tryTenantGoogleDriveProvider(
  tenantId: string,
): Promise<MediaStorageProvider | null> {
  if (!isTenantDriveEnabled()) return null;
  const row = await getTenantStorageConfig(tenantId);
  if (
    !row ||
    row.status !== "CONNECTED" ||
    row.provider !== "google_drive" ||
    !row.googleFolderId ||
    !row.googleRefreshTokenEnc
  ) {
    return null;
  }
  return new GoogleDriveTenantProvider({
    folderId: row.googleFolderId,
    getAccessToken: async () => {
      try {
        return await getTenantDriveAccessToken(tenantId);
      } catch (err) {
        invalidateTenantDriveAccessCache(tenantId);
        throw err;
      }
    },
  });
}
