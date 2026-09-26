import { GoogleDriveProvider } from "./google-drive-provider";
import { LocalFsProvider } from "./local-fs-provider";
import { R2StorageProvider } from "./r2-provider";
import { resolveMediaRoot } from "./paths";
import type { MediaStorageProvider } from "./types";

let cached: MediaStorageProvider | null = null;

export function getMediaStorage(): MediaStorageProvider {
  if (cached) return cached;
  const provider = process.env.MEDIA_STORAGE_PROVIDER ?? "local";
  if (provider === "r2") {
    cached = new R2StorageProvider();
  } else if (provider === "google_drive") {
    cached = new GoogleDriveProvider();
  } else {
    cached = new LocalFsProvider(resolveMediaRoot());
  }
  return cached;
}

export type {
  MediaStorageProvider,
  ObjectHead,
  PresignedUpload,
  StoredObject,
  StoredObjectBytes,
} from "./types";
export { resolveMediaRoot, resolveUnderRoot, safeFileExtension, sniffMime } from "./paths";
