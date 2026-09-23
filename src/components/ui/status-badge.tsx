import { cn } from "@/lib/utils";

export type StatusTone =
  | "ONLINE"
  | "AWAY"
  | "OFFLINE"
  | "PENDING"
  | "ACTIVE"
  | "INACTIVE"
  | "DISABLED"
  | "ERROR"
  | "READY"
  | "PLAYING"
  | "SYNCING"
  | "INSTABLE";

const LABELS: Record<StatusTone, string> = {
  ONLINE: "Online",
  AWAY: "Instável",
  OFFLINE: "Offline",
  PENDING: "Pendente",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  DISABLED: "Desactivado",
  ERROR: "Erro",
  READY: "Pronto",
  PLAYING: "A reproduzir",
  SYNCING: "A sincronizar",
  INSTABLE: "Instável",
};

const TONE_CLASS: Record<StatusTone, string> = {
  ONLINE:
    "bg-[var(--color-success)]/12 text-[var(--color-success)] ring-1 ring-[var(--color-success)]/25",
  AWAY: "bg-[var(--color-warning)]/15 text-[color-mix(in_oklab,var(--color-warning)_70%,black)] ring-1 ring-[var(--color-warning)]/30",
  OFFLINE:
    "bg-[var(--color-danger)]/10 text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/25",
  PENDING:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ring-1 ring-[var(--color-border)]",
  ACTIVE:
    "bg-[var(--color-success)]/12 text-[var(--color-success)] ring-1 ring-[var(--color-success)]/25",
  INACTIVE:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ring-1 ring-[var(--color-border)]",
  DISABLED:
    "bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ring-1 ring-[var(--color-border)]",
  ERROR:
    "bg-[var(--color-danger)]/10 text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/25",
  READY:
    "bg-[var(--color-info)]/10 text-[var(--color-info)] ring-1 ring-[var(--color-info)]/25",
  PLAYING:
    "bg-[var(--color-success)]/12 text-[var(--color-success)] ring-1 ring-[var(--color-success)]/25",
  SYNCING:
    "bg-[var(--color-warning)]/15 text-[color-mix(in_oklab,var(--color-warning)_70%,black)] ring-1 ring-[var(--color-warning)]/30",
  INSTABLE:
    "bg-[var(--color-warning)]/15 text-[color-mix(in_oklab,var(--color-warning)_70%,black)] ring-1 ring-[var(--color-warning)]/30",
};

const DOT_CLASS: Record<StatusTone, string> = {
  ONLINE: "bg-[var(--color-success)]",
  AWAY: "bg-[var(--color-warning)]",
  OFFLINE: "bg-[var(--color-danger)]",
  PENDING: "bg-[var(--color-muted-foreground)]",
  ACTIVE: "bg-[var(--color-success)]",
  INACTIVE: "bg-[var(--color-muted-foreground)]",
  DISABLED: "bg-[var(--color-muted-foreground)]",
  ERROR: "bg-[var(--color-danger)]",
  READY: "bg-[var(--color-info)]",
  PLAYING: "bg-[var(--color-success)]",
  SYNCING: "bg-[var(--color-warning)]",
  INSTABLE: "bg-[var(--color-warning)]",
};

function resolveTone(status: string): StatusTone {
  const upper = status.toUpperCase();
  return upper in LABELS ? (upper as StatusTone) : "PENDING";
}

/** Semantic status chip — presence / playback / lifecycle. */
export function StatusBadge({
  status,
  label,
  className,
  showDot = true,
}: {
  status: StatusTone | string;
  label?: string;
  className?: string;
  showDot?: boolean;
}) {
  const tone = resolveTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        TONE_CLASS[tone],
        className,
      )}
    >
      {showDot ? (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[tone])}
          aria-hidden
        />
      ) : null}
      {label ?? LABELS[tone] ?? status}
    </span>
  );
}
