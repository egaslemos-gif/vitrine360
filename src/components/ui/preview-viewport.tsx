import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PreviewAspect = "16/9" | "4/3" | "9/16" | "1/1";

const ASPECT_CLASS: Record<PreviewAspect, string> = {
  "16/9": "aspect-video",
  "4/3": "aspect-[4/3]",
  "9/16": "aspect-[9/16]",
  "1/1": "aspect-square",
};

/**
 * Fixed preview viewport — content fits inside; container size does not jump.
 */
export function PreviewViewport({
  aspectRatio = "16/9",
  children,
  className,
  label,
}: {
  aspectRatio?: PreviewAspect;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {label}
        </p>
      ) : null}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[#070b14]",
          ASPECT_CLASS[aspectRatio],
        )}
        data-preview-viewport={aspectRatio}
      >
        <div className="absolute inset-0 flex items-center justify-center [&_img]:max-h-full [&_img]:max-w-full [&_img]:object-contain [&_video]:max-h-full [&_video]:max-w-full [&_video]:object-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
