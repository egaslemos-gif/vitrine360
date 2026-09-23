import { cn } from "@/lib/utils";

export type MediaTypeKind =
  | "IMAGE"
  | "VIDEO"
  | "GIF"
  | "AUDIO"
  | "PDF"
  | "EXPERIENCE"
  | "OTHER";

/** Resolve media type badge from MIME or content type string. */
export function resolveMediaTypeKind(
  mimeOrType: string | null | undefined,
): MediaTypeKind {
  const raw = (mimeOrType ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "OTHER";
  if (raw === "EXPERIENCE" || lower === "experience") return "EXPERIENCE";
  if (raw === "IMAGE" || (lower.startsWith("image/") && lower !== "image/gif"))
    return "IMAGE";
  if (raw === "VIDEO" || lower.startsWith("video/")) return "VIDEO";
  if (raw === "GIF" || lower === "image/gif") return "GIF";
  if (raw === "AUDIO" || lower.startsWith("audio/")) return "AUDIO";
  if (raw === "PDF" || lower === "application/pdf") return "PDF";
  if (
    ["TEXT", "NOTICE", "EVENT", "NEWS", "QR_CODE", "CLOCK"].includes(raw)
  ) {
    return "OTHER";
  }
  return "OTHER";
}

const LABELS: Record<MediaTypeKind, string> = {
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  GIF: "GIF",
  AUDIO: "AUDIO",
  PDF: "PDF",
  EXPERIENCE: "EXPERIENCE",
  OTHER: "OTHER",
};

/** Colour tokens aligned to the product UI template. */
const KIND_CLASS: Record<MediaTypeKind, string> = {
  IMAGE:
    "bg-[var(--color-type-image)] text-white shadow-sm",
  VIDEO:
    "bg-[var(--color-type-video)] text-white shadow-sm",
  GIF:
    "bg-[var(--color-type-gif)] text-[var(--color-foreground)] shadow-sm",
  AUDIO:
    "bg-[var(--color-type-audio)] text-white shadow-sm",
  PDF:
    "bg-[var(--color-neutral)] text-white shadow-sm",
  EXPERIENCE:
    "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm",
  OTHER:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
};

/** Type identification chip — used for media assets and content types. */
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
