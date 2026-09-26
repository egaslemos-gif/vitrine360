"use client";

import type { MediaAssetItem } from "@/features/media/media-library";
import { Label } from "@/components/ui/label";
import { isGifMime } from "@/features/contents/gif-support";

export function MediaAssetPicker({
  assets,
  contentType,
  selectedId,
  onSelect,
}: {
  assets: MediaAssetItem[];
  contentType: "IMAGE" | "VIDEO" | "AUDIO";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const filtered = assets.filter((a) =>
    contentType === "IMAGE"
      ? a.mimeType.startsWith("image/")
      : contentType === "VIDEO"
        ? a.mimeType.startsWith("video/")
        : a.mimeType.startsWith("audio/"),
  );

  return (
    <div className="space-y-3">
      <Label>
        Seleccione da biblioteca ({filtered.length})
        {contentType === "IMAGE" ? (
          <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">
            · inclui GIF
          </span>
        ) : null}
      </Label>
      {filtered.length === 0 ? (
        <div className="rounded-md bg-[var(--color-secondary)] p-4 text-sm text-[var(--color-muted-foreground)]">
          Não há ficheiros deste tipo na biblioteca deste workspace.
        </div>
      ) : (
        <div className="grid max-h-60 grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-5">
          {filtered.map((asset) => {
            const gif = isGifMime(asset.mimeType);
            return (
              <button
                key={asset.id}
                type="button"
                title={`${asset.fileName} · ${asset.mimeType}`}
                aria-label={`Seleccionar ${asset.fileName}${gif ? " (GIF)" : ""}`}
                aria-pressed={selectedId === asset.id}
                className={`relative aspect-square cursor-pointer overflow-hidden rounded-md border-2 transition-all ${
                  selectedId === asset.id
                    ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)] ring-offset-1"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"
                }`}
                onClick={() => onSelect(asset.id)}
              >
                {contentType === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.url}
                    alt={asset.fileName}
                    className="h-full w-full object-cover"
                  />
                ) : contentType === "VIDEO" ? (
                  <div className="flex h-full w-full items-center justify-center bg-black">
                    <video
                      src={asset.url}
                      className="max-h-full w-full object-contain"
                      muted
                      preload="metadata"
                    />
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#0b1220] p-2 text-white">
                    <span className="text-[10px] uppercase tracking-wider text-white/50">
                      AUDIO
                    </span>
                    <span className="line-clamp-3 text-center text-[11px]">
                      {asset.fileName}
                    </span>
                  </div>
                )}
                {gif ? (
                  <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    GIF
                  </span>
                ) : null}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 p-1 text-[10px] text-white">
                  {asset.fileName}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
