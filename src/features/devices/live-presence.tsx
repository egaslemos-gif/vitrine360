"use client";

import { Badge } from "@/components/ui/badge";
import { DeviceObservabilityPanel } from "@/features/devices/device-observability-panel";
import type { DeviceRuntimeObservability } from "@/domain/device-observability";
import type { Presence } from "@/domain/types";

/**
 * Presentational presence + compact observability.
 * Parent owns the single presence poll (no per-card timers).
 */
export function LivePresence({
  presence,
  version,
  lastSeenAt,
  observability = null,
}: {
  presence: Presence;
  version: number;
  lastSeenAt: string | null;
  observability?: DeviceRuntimeObservability | null;
}) {
  const isOnline = presence === "ONLINE";
  const isAway = presence === "AWAY";

  const getVariant = () => {
    if (isOnline) return "success";
    if (isAway) return "warning";
    return "muted";
  };

  const getTooltip = () => {
    if (isOnline) return "Comunicação normal (heartbeat).";
    if (isAway)
      return "Sem comunicação no intervalo normal, ainda na janela de tolerância (INSTÁVEL).";
    return "Sem comunicação há mais de 15 minutos.";
  };

  const label =
    observability?.presence.label ??
    (presence === "AWAY" ? "INSTAVEL" : presence);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-col items-end gap-1">
        <Badge
          variant={getVariant()}
          className="transition-colors duration-500 ease-in-out cursor-help"
          title={getTooltip()}
          aria-label={getTooltip()}
        >
          {isOnline && (
            <span className="mr-1.5 flex h-2 w-2 relative">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]"></span>
            </span>
          )}
          {label}
        </Badge>
        <span className="text-[10px] text-[var(--color-muted-foreground)]">
          {lastSeenAt
            ? `último contacto ${new Date(lastSeenAt).toLocaleString()}`
            : "sem heartbeat"}
          {" · "}manifest v{version}
        </span>
      </div>
      {observability ? (
        <DeviceObservabilityPanel obs={observability} compact />
      ) : null}
    </div>
  );
}
