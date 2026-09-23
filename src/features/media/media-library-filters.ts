/** Pure Media Library filter helpers — client + tests; MIME-based (not filename). */

export type MediaTypeFilter = "all" | "image" | "video" | "gif";
export type MediaUsageFilter = "all" | "used" | "unused";
export type MediaSortMode = "name" | "recent" | "size";

export type FilterableMediaAsset = {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  usageCount?: number;
};

export function isGifMime(mime: string): boolean {
  return mime === "image/gif";
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/") && !isGifMime(mime);
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith("video/");
}

export function matchesTypeFilter(
  mime: string,
  typeFilter: MediaTypeFilter,
): boolean {
  if (typeFilter === "all") return true;
  if (typeFilter === "gif") return isGifMime(mime);
  if (typeFilter === "image") return isImageMime(mime);
  if (typeFilter === "video") return isVideoMime(mime);
  return true;
}

export function matchesUsageFilter(
  usageCount: number | undefined,
  usageFilter: MediaUsageFilter,
): boolean {
  const used = (usageCount ?? 0) > 0;
  if (usageFilter === "all") return true;
  if (usageFilter === "used") return used;
  return !used;
}

export function filterMediaAssets<T extends FilterableMediaAsset>(
  assets: T[],
  opts: {
    query?: string;
    typeFilter?: MediaTypeFilter;
    usageFilter?: MediaUsageFilter;
  },
): T[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const typeFilter = opts.typeFilter ?? "all";
  const usageFilter = opts.usageFilter ?? "all";

  return assets.filter((a) => {
    if (q && !a.fileName.toLowerCase().includes(q)) return false;
    if (!matchesTypeFilter(a.mimeType, typeFilter)) return false;
    if (!matchesUsageFilter(a.usageCount, usageFilter)) return false;
    return true;
  });
}
