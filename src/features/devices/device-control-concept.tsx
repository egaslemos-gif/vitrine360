"use client";

/**
 * Visual concept for future Device Control (RUNTIME-PLAYBACK-01).
 * Soft Glass Media — floating glass bar; buttons disabled; no remote commands.
 */
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlayerGlassControlBar } from "@/components/ui/player-glass-controls";

export function DeviceControlConcept({
  deviceName,
  presence,
  currentTitle,
}: {
  deviceName: string;
  presence: string;
  currentTitle?: string | null;
}) {
  return (
    <div
      className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-elevated)] sm:p-5"
      aria-label="Device Control — conceito visual"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">
            Device Control
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
            {deviceName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">Coming soon</Badge>
          <StatusBadge status={presence} />
        </div>
      </div>

      <div
        className="ui-player-canvas relative flex aspect-video w-full flex-col justify-end overflow-hidden rounded-[var(--radius-xl)] p-3 sm:p-4"
        aria-hidden={false}
        aria-label="Área de preview do dispositivo"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-player-primary)_22%,transparent),transparent_65%)]" />
        <div className="absolute left-4 top-4 z-[1] max-w-[75%]">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-player-muted)]">
            Current media
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--color-player-text)] sm:text-base">
            {currentTitle?.trim() || "Sem conteúdo reportado"}
          </p>
          <p className="mt-1 text-xs text-[var(--color-player-muted)]">
            Preview visual — sem stream remoto nesta fase
          </p>
        </div>

        <div className="relative z-[2] mx-auto w-full max-w-lg pb-1">
          <PlayerGlassControlBar currentLabel="—" durationLabel="—" progress={0.28} />
        </div>
      </div>

      <div className="glass-card rounded-[var(--radius-lg)] p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          Playlist
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--color-text-primary)]">
          {["01 Introduction", "02 Mission", "03 Vision", "04 Values"].map(
            (item, i) => (
              <li
                key={item}
                className={`rounded-[var(--radius-sm)] px-2.5 py-2 ${
                  i === 1
                    ? "bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]/35"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                {item}
                {i === 1 ? (
                  <span className="ml-2 text-[10px] uppercase text-[var(--color-primary)]">
                    current
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ul>
      </div>

      <p className="border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-muted)]">
        Conceito visual apenas. Comandos remotos (Play / Pause / Next / Previous /
        Stop / Seek / Volume / Fullscreen) serão implementados em
        RUNTIME-PLAYBACK-01.
      </p>
    </div>
  );
}
