import { cn } from "@/lib/utils";

export type MediaTypeKind =
  | "IMAGE"
  | "VIDEO"
  | "GIF"
  | "AUDIO"
  | "PDF"
  | "CLOCK"
  | "TEXT"
  | "NOTICE"
  | "EVENT"
  | "NEWS"
  | "QR_CODE"
  | "EXPERIENCE"
  | "OTHER";

/** Resolve media/content type badge from MIME or content type string. */
export function resolveMediaTypeKind(
  mimeOrType: string | null | undefined,
): MediaTypeKind {
  const raw = (mimeOrType ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "OTHER";
  if (raw === "EXPERIENCE" || lower === "experience") return "EXPERIENCE";
  if (raw === "CLOCK" || lower === "clock") return "CLOCK";
  if (raw === "TEXT" || lower === "text") return "TEXT";
  if (raw === "NOTICE" || lower === "notice") return "NOTICE";
  if (raw === "EVENT" || lower === "event") return "EVENT";
  if (raw === "NEWS" || lower === "news") return "NEWS";
  if (raw === "QR_CODE" || lower === "qr_code" || lower === "qr") return "QR_CODE";
  if (raw === "IMAGE" || (lower.startsWith("image/") && lower !== "image/gif"))
    return "IMAGE";
  if (raw === "VIDEO" || lower.startsWith("video/")) return "VIDEO";
  if (raw === "GIF" || lower === "image/gif") return "GIF";
  if (raw === "AUDIO" || lower.startsWith("audio/")) return "AUDIO";
  if (raw === "PDF" || lower === "application/pdf") return "PDF";
  return "OTHER";
}

const LABELS: Record<MediaTypeKind, string> = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  GIF: "GIF",
  AUDIO: "AUDIO",
  PDF: "PDF",
  CLOCK: "CLOCK",
  TEXT: "TEXT",
  NOTICE: "NOTICE",
  EVENT: "EVENT",
  NEWS: "NEWS",
  QR_CODE: "QR",
  EXPERIENCE: "EXPERIENCE",
  OTHER: "OTHER",
};

const KIND_CLASS: Record<MediaTypeKind, string> = {
  IMAGE: "bg-[var(--color-type-image)] text-white",
  VIDEO: "bg-[var(--color-type-video)] text-white",
  GIF: "bg-[var(--color-type-gif)] text-white",
  AUDIO: "bg-[var(--color-type-audio)] text-white",
  PDF: "bg-[var(--color-neutral)] text-white",
  CLOCK: "bg-[var(--color-type-clock)] text-white",
  TEXT: "bg-[var(--color-type-text)] text-white",
  NOTICE: "bg-[var(--color-type-notice)] text-white",
  EVENT: "bg-[var(--color-type-event)] text-white",
  NEWS: "bg-[var(--color-info)] text-white",
  QR_CODE: "bg-[var(--color-type-qr)] text-white",
  EXPERIENCE: "bg-[var(--color-type-experience)] text-white",
  OTHER: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

/** Type identification chip — media assets and content types. */
export function TypeBadge({
  kind,
  mimeType,
  contentType,
  className,
}: {
  kind?: MediaTypeKind;
  mimeType?: string | null;
  contentType?: string | null;
  className?: string;
}) {
  const finalKind =
    kind ??
    (mimeType
      ? resolveMediaTypeKind(mimeType)
      : resolveMediaTypeKind(contentType));

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        KIND_CLASS[finalKind],
        className,
      )}
    >
      {LABELS[finalKind]}
    </span>
  );
}
