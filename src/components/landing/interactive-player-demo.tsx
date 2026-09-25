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
  useSyncExternalStore,
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

function subscribeNoop() {
  return () => {};
}

/** True only after client mount — avoids SSR/client control-tree mismatch. */
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

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
  const hydrated = useIsClient();

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
    goToIndex(index, { play: status === "PLAYING" || status === "PAUSED" });
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

  if (!hydrated) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[var(--radius-2xl)] border border-white/50 bg-[var(--color-surface)] shadow-[var(--shadow-modal)] ring-1 ring-[var(--color-primary)]/10",
          className,
        )}
        aria-busy="true"
        aria-label="Vitrine360 Player demo loading"
      >
        <div
          className={cn(
            showcase ? "aspect-[16/10] sm:aspect-video" : "aspect-video",
            "bg-[var(--color-background-secondary)]",
          )}
        />
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-labelledby={labelId}
      className={cn(
        "group/demo outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2",
        isFullscreen && "fixed inset-0 z-[100] flex items-center justify-center bg-black p-4",
        className,
      )}
    >
      <div
        className={cn(
          "overflow-hidden rounded-[var(--radius-2xl)] border border-white/50 bg-[var(--color-surface)] shadow-[var(--shadow-modal)]",
          "ring-1 ring-[var(--color-primary)]/10",
          isFullscreen && "h-full max-h-full w-full max-w-6xl",
        )}
      >
        <div
          className={cn(
            "grid",
            showPlaylist
              ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(200px,0.65fr)]"
              : "grid-cols-1",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)]/70 px-4 py-2.5">
              <div className="min-w-0">
                <p
                  id={labelId}
                  className="truncate text-sm font-semibold tracking-tight text-[var(--color-text-primary)]"
                >
                  Vitrine360 Player
                </p>
                <p className="ui-caption mt-0.5 flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                    Live demo
                  </span>
                  <StatusDot status={status} />
                </p>
              </div>
            </div>

            <div
              className={cn(
                "ui-player-canvas relative overflow-hidden",
                showcase || isFullscreen ? "aspect-[16/10] sm:aspect-video" : "aspect-video",
                isFullscreen && "max-h-[min(70vh,720px)]",
              )}
            >
              <MediaSurface key={mediaKey} item={item} playing={status === "PLAYING"} />

              <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/45 to-transparent px-4 pb-10 pt-3">
                <p className="text-sm font-semibold text-white sm:text-base">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-white/70">
                  {item.type} · {formatDemoTime(durationMs)}
                </p>
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-3 pb-3 pt-12 sm:px-4 sm:pb-4">
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
            <aside className="border-t border-[var(--color-border)]/70 bg-[var(--color-background-secondary)]/60 p-3 lg:border-l lg:border-t-0">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                Playlist
              </p>
              <ul className="mt-2 space-y-1" role="listbox" aria-label="Demo playlist">
                {DEMO_PLAYLIST.map((row, i) => {
                  const active = i === currentIndex;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => selectItem(i)}
                        className={cn(
                          "flex w-full min-h-11 items-start gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors",
                          active
                            ? "bg-[var(--color-primary-soft)] ring-1 ring-[var(--color-primary)]/35"
                            : "hover:bg-white/70",
                        )}
                      >
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{
                            background: active ? row.accent : "transparent",
                            color: active ? "#fff" : "var(--color-text-muted)",
                          }}
                          aria-hidden
                        >
                          {active && status === "PLAYING" ? "●" : String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {row.title}
                          </span>
                          <span className="ui-caption">
                            {row.type} · {formatDemoTime(row.duration * 1000)}
                          </span>
                        </span>
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
      className="glass-player-controls mx-auto w-full max-w-xl rounded-full px-3 py-2 sm:px-4 sm:py-2.5"
      role="group"
      aria-label="Player controls"
    >
      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
        <IconBtn label="Previous media" onClick={onPrevious}>
          <SkipBack className="h-4 w-4" aria-hidden />
        </IconBtn>
        <IconBtn
          label={status === "PLAYING" ? "Pause" : "Play"}
          onClick={onPlayPause}
          primary
        >
          {status === "PLAYING" ? (
            <Pause className="h-5 w-5" aria-hidden />
          ) : (
            <Play className="h-5 w-5" aria-hidden />
          )}
        </IconBtn>
        <IconBtn label="Stop" onClick={onStop}>
          <Square className="h-4 w-4" aria-hidden />
        </IconBtn>
        <IconBtn label="Next media" onClick={onNext}>
          <SkipForward className="h-4 w-4" aria-hidden />
        </IconBtn>
        <IconBtn label="Restart" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" aria-hidden />
        </IconBtn>
        <IconBtn label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={onMute}>
          {muted || volume === 0 ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </IconBtn>
        <label className="mx-1 hidden items-center gap-1 sm:flex">
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="Volume"
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-1.5 w-16 cursor-pointer accent-[var(--color-player-primary)]"
          />
        </label>
        <IconBtn
          label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          onClick={onFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden />
          ) : (
            <Maximize2 className="h-4 w-4" aria-hidden />
          )}
        </IconBtn>
      </div>

      <div className="mt-2 flex items-center gap-2 px-1 sm:gap-3">
        <span className="ui-mono shrink-0 text-[10px] text-[var(--color-player-muted)]">
          {formatDemoTime(positionMs)}
        </span>
        <div
          ref={seekTrackRef}
          className="ui-player-timeline relative min-h-5 min-w-0 flex-1 cursor-pointer py-2"
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
        <span className="ui-mono shrink-0 text-[10px] text-[var(--color-player-muted)]">
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
        primary
          ? "ui-icon-btn-primary min-h-11 min-w-11 sm:min-h-12 sm:min-w-12"
          : "min-h-10 min-w-10 text-[var(--color-player-text)] sm:min-h-11 sm:min-w-11",
      )}
    >
      {children}
    </button>
  );
}
