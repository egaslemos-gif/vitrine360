"use client";

/**
 * Visual-only glass media control bar (UI/UX-02C).
 * No remote command execution — controls disabled / Coming soon.
 */
import {
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ControlKey =
  | "previous"
  | "play"
  | "pause"
  | "stop"
  | "next"
  | "restart"
  | "mute"
  | "volume"
  | "fullscreen";

const CONTROLS: {
  key: ControlKey;
  label: string;
  icon: typeof Play;
  primary?: boolean;
}[] = [
  { key: "previous", label: "Anterior", icon: SkipBack },
  { key: "play", label: "Play", icon: Play, primary: true },
  { key: "pause", label: "Pause", icon: Pause },
  { key: "stop", label: "Stop", icon: Square },
  { key: "next", label: "Seguinte", icon: SkipForward },
  { key: "restart", label: "Reiniciar", icon: RotateCcw },
  { key: "mute", label: "Mute", icon: VolumeX },
  { key: "volume", label: "Volume", icon: Volume2 },
  { key: "fullscreen", label: "Fullscreen", icon: Maximize2 },
];

export function PlayerGlassControlBar({
  className,
  progress = 0.28,
  currentLabel = "—",
  durationLabel = "—",
}: {
  className?: string;
  /** Decorative fill 0–1; not interactive seek. */
  progress?: number;
  currentLabel?: string;
  durationLabel?: string;
}) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;

  return (
    <div
      className={cn(
        "glass-player-controls w-full max-w-md px-2.5 py-1.5 sm:max-w-lg sm:px-3 sm:py-2",
        className,
      )}
      role="group"
      aria-label="Comandos de reprodução (indisponíveis)"
    >
      <div className="flex flex-nowrap items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CONTROLS.map(({ key, label, icon: Icon, primary }) => (
          <button
            key={key}
            type="button"
            disabled
            aria-label={`${label} — Coming soon`}
            title="Coming soon — remote commands not implemented"
            className={cn("ui-icon-btn", primary && "ui-icon-btn-primary")}
          >
            <Icon className={primary ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex items-center gap-2 px-0.5">
        <span className="ui-mono shrink-0 text-[10px] tabular-nums text-[var(--color-player-muted)]">
          {currentLabel}
        </span>
        <div
          className="ui-player-timeline min-w-0 flex-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Progresso de reprodução indisponível"
        >
          <div className="ui-player-timeline-fill" style={{ width: `${pct}%` }} />
          <span
            className="ui-player-timeline-thumb"
            style={{ left: `${pct}%` }}
            aria-hidden
          />
        </div>
        <span className="ui-mono shrink-0 text-[10px] tabular-nums text-[var(--color-player-muted)]">
          {durationLabel}
        </span>
      </div>
    </div>
  );
}
