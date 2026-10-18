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
 * Resolve a storage provider by the asset's persisted `storage_provider`.
 * Cached per name so device-media can mix R2 + Drive assets in one process.
 */
export function getMediaStorageFor(
  storageProvider: string,
): MediaStorageProvider {
  const name = normalizeProviderName(storageProvider);
  if (!name) {
    throw new Error("Unsupported storage provider: (empty)");
  }
  // Accept common alias
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

export type {
  MediaStorageProvider,
  ObjectHead,
  PresignedUpload,
  StoredObject,
  StoredObjectBytes,
} from "./types";
export { resolveMediaRoot, resolveUnderRoot, safeFileExtension, sniffMime } from "./paths";
