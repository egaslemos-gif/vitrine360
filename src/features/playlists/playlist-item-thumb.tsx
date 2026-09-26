"use client";

import { TypeBadge } from "@/components/ui/type-badge";
import { cn } from "@/lib/utils";
import { Music2, FileText, Clock, Sparkles } from "lucide-react";

type ThumbContent = {
  title: string;
  type: string;
  payload?: Record<string, unknown>;
  mediaUrl: string | null;
};

function payloadText(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "";
  const keys = ["body", "message", "description", "text"] as const;
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Compact visual thumbnail for playlist item rows — always shows a type-aware preview. */
export function PlaylistItemThumb({
  content,
  className,
}: {
  content: ThumbContent;
  className?: string;
}) {
  const type = content.type.toUpperCase();
  const url = content.mediaUrl;
  const body = payloadText(content.payload);

  return (
    <div
      className={cn(
        "relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--color-surface-muted)] ring-1 ring-[var(--color-border)]",
        className,
      )}
      aria-hidden
    >
      {type === "IMAGE" && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : type === "VIDEO" && url ? (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-hidden
        />
      ) : type === "AUDIO" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[linear-gradient(145deg,color-mix(in_oklab,var(--color-type-audio)_28%,#1a1520),#2a2030)] px-1">
          {url ? (
            <>
              <Music2 className="h-4 w-4 text-[var(--color-type-audio)]" />
              <span className="flex h-2 w-full items-end justify-center gap-px px-0.5">
                {[3, 5, 4, 6, 3, 5].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full bg-[var(--color-type-audio)]/80"
                    style={{ height: `${h * 2}px` }}
                  />
                ))}
              </span>
            </>
          ) : (
            <Music2 className="h-4 w-4 text-[var(--color-type-audio)]/70" />
          )}
        </div>
      ) : type === "CLOCK" ? (
        <div className="flex h-full w-full items-center justify-center bg-[#0b1220]">
          <Clock className="h-5 w-5 text-white/80" />
        </div>
      ) : type === "EXPERIENCE" ? (
        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(145deg,#4c1d95,#6d28d9)]">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      ) : type === "TEXT" ||
        type === "NOTICE" ||
        type === "NEWS" ||
        type === "EVENT" ||
        type === "QR_CODE" ? (
        <div className="flex h-full w-full flex-col justify-center gap-0.5 bg-[linear-gradient(160deg,#0b1220_0%,#132033_100%)] px-1.5 py-1 text-left">
          <FileText className="mb-0.5 h-2.5 w-2.5 text-white/45" />
          <span className="line-clamp-2 text-[7px] font-semibold leading-tight text-white/90">
            {content.title}
          </span>
          {body ? (
            <span className="line-clamp-1 text-[6px] leading-tight text-white/50">
              {body}
            </span>
          ) : null}
        </div>
      ) : url && (type === "IMAGE" || url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i)) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <TypeBadge contentType={content.type} className="scale-75" />
      )}
    </div>
  );
}
