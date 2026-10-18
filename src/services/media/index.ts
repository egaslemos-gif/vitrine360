import { GoogleDriveProvider } from "./google-drive-provider";
import { LocalFsProvider } from "./local-fs-provider";
import { R2StorageProvider } from "./r2-provider";
import { resolveMediaRoot } from "./paths";
import type { MediaStorageProvider } from "./types";

const cache = new Map<string, MediaStorageProvider>();

function normalizeProviderName(storageProvider: string): string {
  return storageProvider.trim().toLowerCase();
}

function createProvider(name: string): MediaStorageProvider {
  if (name === "r2") return new R2StorageProvider();
  if (name === "google_drive") return new GoogleDriveProvider();
  if (name === "local") return new LocalFsProvider(resolveMediaRoot());
  throw new Error(`Unsupported storage provider: ${name}`);
}

/**
 * Resolve a storage provider by the asset's persisted `storage_provider` name.
 * Cached per name. Prefer {@link resolveMediaStorageForAsset} for device-media
 * so google_drive uses Tenant Drive OAuth instead of the SA factory.
 */
export function getMediaStorageFor(
  storageProvider: string,
): MediaStorageProvider {
  const name = normalizeProviderName(storageProvider);
  if (!name) {
    throw new Error("Unsupported storage provider: (empty)");
  }
  const key = name === "drive" ? "google_drive" : name;
  const cached = cache.get(key);
  if (cached) return cached;
  const created = createProvider(key);
  cache.set(key, created);
  return created;
}

/** Default upload/runtime provider from env (unchanged contract for callers). */
export function getMediaStorage(): MediaStorageProvider {
  const provider = process.env.MEDIA_STORAGE_PROVIDER ?? "local";
  return getMediaStorageFor(provider);
}

/** Test-only: clear provider cache between cases. */
export function clearMediaStorageCacheForTests(): void {
  cache.clear();
}

/**
 * Resolve storage for an existing media_assets row.
 * Never migrates bytes — uses asset.storageProvider as source of truth.
 *
 * google_drive → Tenant Drive OAuth (`tryTenantGoogleDriveProvider`).
 * Does NOT fall back to GOOGLE_DRIVE_* service account or to R2.
 */
export async function resolveMediaStorageForAsset(asset: {
  storageProvider: string;
  tenantId: string;
  storageKey?: string;
}): Promise<MediaStorageProvider> {
  const name = normalizeProviderName(asset.storageProvider);
  const key = name === "drive" ? "google_drive" : name;

  if (key === "google_drive") {
    const { tryTenantGoogleDriveProvider } = await import(
      "@/services/tenant-storage"
    );
    const tenantDrive = await tryTenantGoogleDriveProvider(asset.tenantId);
    if (tenantDrive) return tenantDrive;
    throw new Error(
      "Asset is on google_drive but tenant Drive is disconnected or TENANT_DRIVE_ENABLED is off",
    );
  }
  if (key === "r2") return getMediaStorageFor("r2");
  if (key === "local") return getMediaStorageFor("local");
  if (!key) {
    throw new Error("Unsupported storage provider: (empty)");
  }
  throw new Error(`Unsupported storage provider: ${key}`);
}

export type {
  MediaStorageProvider,
  ObjectHead,
  PresignedUpload,
  StoredObject,
  StoredObjectBytes,
} from "./types";
export { resolveMediaRoot, resolveUnderRoot, safeFileExtension, sniffMime } from "./paths";
