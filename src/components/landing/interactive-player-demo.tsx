"use client";

/**
 * Local interactive Landing Page player demo (UI/UX-02D).
 * Isolated from Device / Manifest / Playback APIs — no remote commands.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Maximize2,
  Minimize2,
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
import {
  DEMO_PLAYLIST,
  formatDemoTime,
  type DemoPlaybackStatus,
  type DemoPlaylistItem,
} from "./demo-playlist";

const PREV_RESTART_THRESHOLD_MS = 3000;
const TICK_MS = 100;

type Props = {
  className?: string;
  /** Larger layout for dedicated showcase section */
  size?: "hero" | "showcase";
  showPlaylist?: boolean;
};

export function InteractivePlayerDemo({
  className,
  size = "hero",
  showPlaylist = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const seekTrackRef = useRef<HTMLDivElement>(null);
  const volumeBeforeMute = useRef(72);
  const seekingRef = useRef(false);
  const labelId = useId();

  const [status, setStatus] = useState<DemoPlaybackStatus>("PAUSED");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [volume, setVolume] = useState(72);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);

  const item = DEMO_PLAYLIST[currentIndex] ?? DEMO_PLAYLIST[0];
  const durationMs = item.duration * 1000;
  const progress = durationMs > 0 ? Math.min(1, positionMs / durationMs) : 0;

  const goToIndex = useCallback(
    (index: number, opts?: { play?: boolean; restart?: boolean }) => {
      const len = DEMO_PLAYLIST.length;
      const next = ((index % len) + len) % len;
      setCurrentIndex(next);
      setPositionMs(0);
      setMediaKey((k) => k + 1);
      if (opts?.play) setStatus("PLAYING");
      else if (opts?.restart === false) {
        /* keep status */
      }
    },
    [],
  );

  const statusRef = useRef(status);
  const durationRef = useRef(durationMs);
  const seekingLatest = seekingRef;

  useEffect(() => {
    statusRef.current = status;
    durationRef.current = durationMs;
  }, [status, durationMs]);

  useEffect(() => {
    if (status !== "PLAYING") return;
    const id = window.setInterval(() => {
      if (statusRef.current !== "PLAYING" || seekingLatest.current) return;
      setPositionMs((prev) => {
        const dur = durationRef.current;
        const next = prev + TICK_MS;
        if (next < dur) return next;
        return dur;
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, seekingLatest]);

  const advanceLock = useRef(false);
  useEffect(() => {
    if (status !== "PLAYING") {
      advanceLock.current = false;
      return;
    }
    if (positionMs < durationMs) {
      advanceLock.current = false;
      return;
    }
    if (advanceLock.current) return;
    advanceLock.current = true;
    setCurrentIndex((i) => (i + 1) % DEMO_PLAYLIST.length);
    setPositionMs(0);
    setMediaKey((k) => k + 1);
  }, [status, positionMs, durationMs]);

  useEffect(() => {
    const onFs = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function play() {
    if (status === "STOPPED") setPositionMs(0);
    setStatus("PLAYING");
  }

  function pause() {
    setStatus("PAUSED");
  }

  function togglePlayPause() {
    if (status === "PLAYING") pause();
    else play();
  }

  function stop() {
    setStatus("STOPPED");
    setPositionMs(0);
  }

  function next() {
    const wasPlaying = status === "PLAYING";
    goToIndex(currentIndex + 1, { play: wasPlaying });
    if (!wasPlaying && status === "STOPPED") setStatus("PAUSED");
  }

  function previous() {
    const wasPlaying = status === "PLAYING";
    if (positionMs > PREV_RESTART_THRESHOLD_MS) {
      setPositionMs(0);
      setMediaKey((k) => k + 1);
      return;
    }
    goToIndex(currentIndex - 1, { play: wasPlaying });
    if (!wasPlaying && status === "STOPPED") setStatus("PAUSED");
  }

  function restart() {
    setPositionMs(0);
    setMediaKey((k) => k + 1);
  }

  function selectItem(index: number) {
    goToIndex(index, { play: status === "PLAYING" });
    if (status === "STOPPED") setStatus("PAUSED");
  }

  function seekToRatio(ratio: number) {
    const clamped = Math.max(0, Math.min(1, ratio));
    setPositionMs(Math.round(clamped * durationMs));
    if (status === "STOPPED") setStatus("PAUSED");
  }

  function onSeekPointer(clientX: number) {
    const el = seekTrackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    seekToRatio(ratio);
  }

  function toggleMute() {
    if (muted) {
      setMuted(false);
      setVolume(volumeBeforeMute.current || 72);
    } else {
      volumeBeforeMute.current = volume > 0 ? volume : volumeBeforeMute.current;
      setMuted(true);
    }
  }

  function onVolumeChange(v: number) {
    const next = Math.max(0, Math.min(100, v));
    setVolume(next);
    if (next === 0) setMuted(true);
    else {
      setMuted(false);
      volumeBeforeMute.current = next;
    }
  }

  async function toggleFullscreen() {
    const root = rootRef.current;
    if (!root) return;
    try {
      if (!document.fullscreenElement) {
        if (root.requestFullscreen) await root.requestFullscreen();
        else setIsFullscreen(true);
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((f) => !f);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      t?.isContentEditable
    ) {
      return;
    }
    // Let focused controls keep native Space/Enter activation.
    if (t?.closest("button") && (e.key === " " || e.key === "Enter")) {
      return;
    }

    switch (e.key) {
      case " ":
      case "k":
      case "K":
        e.preventDefault();
        togglePlayPause();
        break;
      case "ArrowRight":
        e.preventDefault();
        if (e.shiftKey) seekToRatio(Math.min(1, progress + 0.05));
        else next();
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (e.shiftKey) seekToRatio(Math.max(0, progress - 0.05));
        else previous();
        break;
      case "m":
      case "M":
        e.preventDefault();
        toggleMute();
        break;
      case "f":
      case "F":
        e.preventDefault();
        void toggleFullscreen();
        break;
      default:
        break;
    }
  }

  const showcase = size === "showcase";
  const effectiveVolume = muted ? 0 : volume;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-labelledby={labelId}
      className={cn(
        "group/demo outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2",
        isFullscreen &&
          "fixed inset-0 z-[100] flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#dbe4ff_0%,#efe7ff_55%,#f6f3ff_100%)] p-3 sm:p-6",
        className,
      )}
    >
      <div
        className={cn(
          "ui-demo-app-shell relative overflow-hidden rounded-[1.35rem]",
          isFullscreen && "h-full max-h-full w-full max-w-6xl",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 15% 10%, rgba(147,197,253,0.45), transparent 55%), radial-gradient(ellipse 70% 55% at 90% 85%, rgba(196,181,253,0.4), transparent 50%), linear-gradient(145deg, rgba(255,255,255,0.55), rgba(237,233,254,0.35))",
          }}
        />

        <div
          className={cn(
            "relative grid min-w-0",
            showPlaylist
              ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,0.7fr)]"
              : "grid-cols-1",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-white/50 bg-white/35 px-4 py-3 backdrop-blur-md">
              <div className="min-w-0">
                <p
                  id={labelId}
                  className="truncate text-[15px] font-semibold tracking-tight text-[var(--color-text-primary)]"
                >
                  Vitrine360 Player
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-primary)]/15">
                    Live demo
                  </span>
                  <StatusDot status={status} />
                </p>
              </div>
              <div
                className="hidden shrink-0 rounded-full bg-white/55 px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] ring-1 ring-white/70 sm:block"
                aria-hidden
              >
                Local only
              </div>
            </div>

            <div
              className={cn(
                "ui-player-canvas relative overflow-hidden",
                showcase || isFullscreen
                  ? "aspect-[16/10] sm:aspect-video"
                  : "aspect-video",
                isFullscreen && "max-h-[min(72vh,760px)]",
              )}
            >
              <MediaSurface
                key={mediaKey}
                item={item}
                playing={status === "PLAYING"}
              />

              <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-4 pb-12 pt-3">
                <p className="text-sm font-semibold tracking-tight text-white sm:text-base">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-white/75">
                  {item.type} · {formatDemoTime(positionMs)} /{" "}
                  {formatDemoTime(durationMs)}
                </p>
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-2.5 pb-2.5 pt-10 sm:px-3 sm:pb-3">
                <ControlBar
                  status={status}
                  muted={muted}
                  volume={effectiveVolume}
                  positionMs={positionMs}
                  durationMs={durationMs}
                  progress={progress}
                  seekTrackRef={seekTrackRef}
                  isFullscreen={isFullscreen}
                  onPlayPause={togglePlayPause}
                  onStop={stop}
                  onNext={next}
                  onPrevious={previous}
                  onRestart={restart}
                  onMute={toggleMute}
                  onVolume={onVolumeChange}
                  onFullscreen={() => void toggleFullscreen()}
                  onSeekStart={() => {
                    seekingRef.current = true;
                  }}
                  onSeekMove={onSeekPointer}
                  onSeekEnd={() => {
                    seekingRef.current = false;
                  }}
                />
              </div>
            </div>
          </div>

          {showPlaylist ? (
            <aside className="border-t border-white/50 bg-white/30 p-3 backdrop-blur-md lg:border-l lg:border-t-0">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Playlist
              </p>
              <ul
                className="mt-2 space-y-1.5"
                role="listbox"
                aria-label="Demo playlist"
              >
                {DEMO_PLAYLIST.map((row, i) => {
                  const active = i === currentIndex;
                  const rowProgress = active ? progress : 0;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectItem(i)}
                        className={cn(
                          "flex w-full min-h-11 items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition-all",
                          active
                            ? "bg-white/80 shadow-sm ring-1 ring-[var(--color-primary)]/30"
                            : "hover:bg-white/55",
                        )}
                      >
                        <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={row.src}
                            alt=""
                            className="h-full w-full object-cover"
                            draggable={false}
                          />
                          {active ? (
                            <span
                              className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-black/25"
                              aria-hidden
                            >
                              <span
                                className="block h-full rounded-full bg-[var(--color-player-primary)]"
                                style={{
                                  width: `${Math.round(rowProgress * 100)}%`,
                                }}
                              />
                            </span>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="block truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
                              {row.title}
                            </span>
                            {active && status === "PLAYING" ? (
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]"
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-medium text-[var(--color-text-muted)]">
                            {String(i + 1).padStart(2, "0")} · {row.type} ·{" "}
                            {formatDemoTime(row.duration * 1000)}
                          </span>
                        </span>
                        {active && status !== "PLAYING" ? (
                          <Play
                            className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]"
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 px-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                Local product demo — no device commands, no database writes.
              </p>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: DemoPlaybackStatus }) {
  const color =
    status === "PLAYING"
      ? "bg-[var(--color-success)]"
      : status === "PAUSED"
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-muted-foreground)]";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
      <span className={cn("h-1.5 w-1.5 rounded-full", color)} aria-hidden />
      {status}
    </span>
  );
}

function MediaSurface({
  item,
  playing,
}: {
  item: DemoPlaylistItem;
  playing: boolean;
}) {
  return (
    <div className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt=""
        className={cn(
          "h-full w-full object-cover transition-transform duration-700 ease-out",
          playing && "scale-[1.02]",
        )}
        draggable={false}
      />
      {item.type === "VIDEO" ? (
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(0,0,0,0.25))]"
          aria-hidden
        />
      ) : null}
      {playing && item.type === "VIDEO" ? (
        <div
          className="pointer-events-none absolute bottom-20 left-4 right-4 h-0.5 overflow-hidden rounded-full bg-white/20 sm:bottom-24"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-white/50" />
        </div>
      ) : null}
    </div>
  );
}

function ControlBar({
  status,
  muted,
  volume,
  positionMs,
  durationMs,
  progress,
  seekTrackRef,
  isFullscreen,
  onPlayPause,
  onStop,
  onNext,
  onPrevious,
  onRestart,
  onMute,
  onVolume,
  onFullscreen,
  onSeekStart,
  onSeekMove,
  onSeekEnd,
}: {
  status: DemoPlaybackStatus;
  muted: boolean;
  volume: number;
  positionMs: number;
  durationMs: number;
  progress: number;
  seekTrackRef: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  onPlayPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onFullscreen: () => void;
  onSeekStart: () => void;
  onSeekMove: (clientX: number) => void;
  onSeekEnd: () => void;
}) {
  const pct = Math.round(progress * 100);

  return (
    <div
      className="glass-player-controls pointer-events-auto mx-auto w-full max-w-md px-2.5 py-1.5 sm:max-w-lg sm:px-3 sm:py-2"
      role="group"
      aria-label="Player controls"
    >
      <div className="flex flex-nowrap items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <IconBtn label="Previous media" onClick={onPrevious}>
          <SkipBack className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn
          label={status === "PLAYING" ? "Pause" : "Play"}
          onClick={onPlayPause}
          primary
        >
          {status === "PLAYING" ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </IconBtn>
        <IconBtn label="Stop" onClick={onStop}>
          <Square className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label="Next media" onClick={onNext}>
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label="Restart" onClick={onRestart}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={onMute}>
          {muted || volume === 0 ? (
            <VolumeX className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Volume2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </IconBtn>
        <label className="mx-0.5 hidden items-center sm:flex">
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="Volume"
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-1 w-14 cursor-pointer accent-[var(--color-player-primary)]"
          />
        </label>
        <IconBtn
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={onFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </IconBtn>
      </div>

      <div className="mt-1.5 flex items-center gap-2 px-0.5">
        <span className="ui-mono shrink-0 text-[10px] tabular-nums text-[var(--color-player-muted)]">
          {formatDemoTime(positionMs)}
        </span>
        <div
          ref={seekTrackRef}
          className="ui-player-timeline relative min-w-0 flex-1 cursor-pointer py-2"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${formatDemoTime(positionMs)} of ${formatDemoTime(durationMs)}`}
          aria-label="Seek"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onSeekStart();
            onSeekMove(e.clientX);
          }}
          onPointerMove={(e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            onSeekMove(e.clientX);
          }}
          onPointerUp={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
            onSeekEnd();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              e.preventDefault();
              onSeekMove(
                (seekTrackRef.current?.getBoundingClientRect().left ?? 0) +
                  (progress + 0.05) *
                    (seekTrackRef.current?.getBoundingClientRect().width ?? 0),
              );
            }
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              onSeekMove(
                (seekTrackRef.current?.getBoundingClientRect().left ?? 0) +
                  (progress - 0.05) *
                    (seekTrackRef.current?.getBoundingClientRect().width ?? 0),
              );
            }
          }}
        >
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/16">
            <div
              className="ui-player-timeline-fill h-full"
              style={{ width: `${pct}%` }}
            />
            <span
              className="ui-player-timeline-thumb"
              style={{ left: `${pct}%` }}
              aria-hidden
            />
          </div>
        </div>
        <span className="ui-mono shrink-0 text-[10px] tabular-nums text-[var(--color-player-muted)]">
          {formatDemoTime(durationMs)}
        </span>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "ui-icon-btn",
        primary ? "ui-icon-btn-primary" : "text-[var(--color-player-text)]",
      )}
    >
      {children}
    </button>
  );
}
