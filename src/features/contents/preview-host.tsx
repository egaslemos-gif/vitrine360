"use client";

import { ContentVisual } from "@/features/contents/content-visual";
import type { ContentPreviewModel } from "@/features/contents/content-preview-types";
import { isContentOutsideValidityWindow } from "@/features/contents/content-preview-types";
import { Badge } from "@/components/ui/badge";
import { isGifMime } from "@/features/contents/gif-support";

export function PreviewHost({
  content,
  previewNow,
}: {
  content: ContentPreviewModel;
  previewNow?: Date;
}) {
  const outside = isContentOutsideValidityWindow(
    content.validFrom,
    content.validTo,
    previewNow,
  );
  const gif =
    content.type === "IMAGE" &&
    !!content.mimeType &&
    isGifMime(content.mimeType);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          className="text-lg font-semibold text-[var(--color-foreground)]"
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          Pré-visualização
        </h3>
        {content.status === "INACTIVE" ? (
          <Badge variant="muted">INACTIVE</Badge>
        ) : (
          <Badge variant="success">ACTIVE</Badge>
        )}
        {gif ? (
          <Badge variant="muted" className="uppercase tracking-wide">
            GIF
          </Badge>
        ) : null}
        {content.type === "VIDEO" ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {content.durationMs === 0
              ? "Duração natural"
              : `Duração fixa · ${content.durationMs} ms`}
          </span>
        ) : null}
        {gif ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            Timer · {content.durationMs} ms
          </span>
        ) : null}
      </div>

      {outside ? (
        <p
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          Fora do período de validade
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm">
        <div className="relative aspect-video w-full bg-[#070b14] text-white">
          <ContentVisual content={content} previewNow={previewNow} />
        </div>
        <div className="flex items-center justify-between border-t border-[var(--color-border)] bg-white px-3 py-2 text-[11px] text-[var(--color-muted-foreground)]">
          <span className="uppercase tracking-wider">
            {content.type}
            {gif ? " · GIF" : ""}
          </span>
          <span className="truncate pl-4">{content.title}</span>
        </div>
      </div>
    </div>
  );
}
