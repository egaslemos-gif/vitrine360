import { Badge } from "@/components/ui/badge";
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

const VARIANTS: Record<
  StatusTone,
  "success" | "warning" | "danger" | "muted" | "default"
> = {
  ONLINE: "success",
  AWAY: "warning",
  OFFLINE: "danger",
  PENDING: "muted",
  ACTIVE: "success",
  INACTIVE: "muted",
  DISABLED: "muted",
  ERROR: "danger",
  READY: "default",
  PLAYING: "success",
  SYNCING: "warning",
  INSTABLE: "warning",
};

/** Semantic status chip — single mapping for presence / playback / content. */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusTone | string;
  label?: string;
  className?: string;
}) {
  const key = (status.toUpperCase() in LABELS
    ? status.toUpperCase()
    : "PENDING") as StatusTone;
  const tone = (status.toUpperCase() in VARIANTS
    ? status.toUpperCase()
    : "PENDING") as StatusTone;
  return (
    <Badge
      variant={VARIANTS[tone]}
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        className,
      )}
    >
      {label ?? LABELS[key] ?? status}
    </Badge>
  );
}
