/**
 * Pure helpers for atomic offline sync decisions (testable without IndexedDB).
 */

/** Activate NEXT only when every required asset id is present locally. */
export function canActivateAssetSet(
  requiredAssetIds: string[],
  presentAssetIds: Set<string>,
): boolean {
  return requiredAssetIds.every((id) => presentAssetIds.has(id));
}

/** Compare sha256:hex checksums; empty expected means skip validation. */
export function checksumMatches(
  expected: string,
  actualHex: string,
): boolean {
  if (!expected) return true;
  if (expected.startsWith("sha256:")) {
    return expected.slice("sha256:".length) === actualHex;
  }
  return expected === actualHex;
}

/** App media routes need Bearer; external signed R2/S3 URLs must not get Authorization. */
export function shouldAttachDeviceBearer(
  assetUrl: string,
  origin?: string,
): boolean {
  if (assetUrl.startsWith("/")) return true;
  if (origin && assetUrl.startsWith(`${origin}/`)) return true;
  return false;
}

export type AssetRef = { id: string; checksum: string };

/**
 * Assets that must be downloaded: missing locally or checksum mismatch.
 * Empty checksum still requires presence (caller decides skip via isPresent).
 */
export function assetsRequiringDownload<T extends AssetRef>(
  assets: T[],
  isPresent: (id: string, checksum: string) => boolean,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    if (!isPresent(asset.id, asset.checksum)) out.push(asset);
  }
  return out;
}

/**
 * True delta of asset ids whose checksum changed or that are new vs previous set.
 * Used by server/client to avoid treating the full playlist as "changed".
 */
export function diffChangedAssetIds(
  previous: AssetRef[],
  next: AssetRef[],
): string[] {
  const prevById = new Map<string, string>();
  for (const a of previous) prevById.set(a.id, a.checksum ?? "");
  const changed: string[] = [];
  const seen = new Set<string>();
  for (const a of next) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const prev = prevById.get(a.id);
    if (prev === undefined || prev !== (a.checksum ?? "")) {
      changed.push(a.id);
    }
  }
  return changed;
}
