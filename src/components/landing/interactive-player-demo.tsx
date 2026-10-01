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
  /** "dark" renders the demo shell on dark surfaces (landing hero). */
  tone?: "light" | "dark";
  /** "below" puts the playlist as a thumbnail row under the video (landing hero). */
  playlistLayout?: "side" | "below";
};

export function InteractivePlayerDemo({
  className,
  size = "hero",
  showPlaylist = true,
  tone = "light",
  playlistLayout = "side",
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

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement === rootRef.current));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

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
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        return;
      }
      if (root.requestFullscreen) {
        await root.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
      setIsFullscreen((f) => !f);
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
  // Colour-only switch: layout keeps using isFullscreen.
  const dark = isFullscreen || tone === "dark";
  const upNext = DEMO_PLAYLIST[(currentIndex + 1) % DEMO_PLAYLIST.length]!;
  const below = playlistLayout === "below" && !isFullscreen;
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
          "fixed inset-0 z-[100] flex h-[100dvh] w-screen flex-col bg-[#07070c]",
        className,
      )}
    >
      <div
        data-tone={dark ? "dark" : "light"}
        className={cn(
          "ui-demo-app-shell relative w-full overflow-hidden ring-1",
          tone === "dark" && !isFullscreen
            ? "bg-[#12121c] ring-white/10"
            : "bg-white ring-black/5",
          isFullscreen &&
            "flex h-full min-h-0 w-full max-w-none flex-1 flex-col rounded-none border-0 shadow-none ring-0 backdrop-blur-none bg-[#0a0a0f]",
        )}
      >
        {!dark ? (
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.4]"
            aria-hidden
            style={{
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.7), rgba(248,248,251,0.2))",
            }}
          />
        ) : null}

        {/* Header moved outside the grid to span full width and avoid stretching issues */}
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b px-4 py-3 sm:py-3.5",
            dark
              ? "border-white/10 bg-black/40 backdrop-blur-md shrink-0"
              : "border-black/[0.04] bg-white/80 backdrop-blur-md relative z-10",
          )}
        >
          <div className="min-w-0">
            <p
              id={labelId}
              className={cn(
                "truncate text-[13px] font-semibold tracking-tight",
                dark ? "text-white" : "text-[#131316]"
              )}
            >
              Vitrine360 Player
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-[0.08em]",
                dark ? "bg-white/10 text-white/70" : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
              )}>
                Demo ao vivo
              </span>
              <StatusDot status={status} light={dark} />
            </p>
          </div>
          <div
            className={cn(
              "hidden shrink-0 text-[10px] font-medium sm:block",
              dark ? "text-white/40" : "text-[var(--color-text-muted)]"
            )}
            aria-hidden
          >
            Apenas local
          </div>
        </div>

        <div
          className={cn(
            "relative min-w-0",
            showPlaylist && !isFullscreen && !below
              ? "flex flex-col xl:grid xl:grid-cols-[minmax(0,2.35fr)_minmax(220px,1fr)] xl:items-start"
              : "flex flex-col",
            isFullscreen &&
              "h-full min-h-0 flex-1 grid grid-rows-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]",
          )}
        >
          <div
            className={cn(
              "min-w-0 relative w-full",
              isFullscreen ? "flex min-h-0 flex-col" : "xl:flex xl:flex-col p-2 sm:p-3 xl:p-4",
            )}
          >
            <div
              className={cn(
                "ui-player-canvas relative overflow-hidden w-full",
                isFullscreen
                  ? "min-h-0 flex-1"
                  : dark ? "aspect-video rounded-[10px] shadow-sm border border-white/10" : "aspect-video rounded-[10px] shadow-sm border border-black/5",
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

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pb-3 pt-16 sm:px-4 sm:pb-4">
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

            {!isFullscreen ? (
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", dark ? "text-white/45" : "text-[var(--color-text-muted)]")}>
                    {status === "PLAYING" ? "Em reprodução" : "Pronto a reproduzir"}
                  </p>
                  <p className={cn("mt-0.5 truncate text-sm font-semibold", dark ? "text-white" : "text-[#131316]")}>
                    {item.title}
                  </p>
                </div>
                <p className={cn("hidden min-w-0 shrink text-right text-xs sm:block", dark ? "text-white/55" : "text-[var(--color-text-secondary)]")}>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">A seguir</span>
                  <span className="mt-0.5 block max-w-[220px] truncate font-medium">{upNext.title}</span>
                </p>
              </div>
            ) : null}
          </div>

          {showPlaylist ? (
            <aside
              className={cn(
                "flex flex-col relative",
                !isFullscreen && "xl:self-start",
                isFullscreen
                  ? "border-l border-white/5 bg-black/40 backdrop-blur-md"
                  : below
                    ? "border-t border-white/10 bg-transparent"
                    : dark
                      ? "bg-transparent xl:border-l xl:border-white/10"
                      : "bg-transparent xl:border-l xl:border-black/[0.04]",
              )}
            >
              <div
                className={cn(
                  "flex flex-col",
                  !isFullscreen ? "p-3 xl:p-4" : "p-3"
                )}
              >
                <p className={cn(
                  "shrink-0 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] xl:mb-1",
                  dark ? "text-white/50" : "text-[var(--color-text-muted)]"
                )}>
                  Playlist
                </p>
                <ul
                  className={cn(
                    below
                      ? "mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
                      : "mt-2 xl:mt-3 space-y-1.5 xl:space-y-2",
                    "overflow-x-hidden pr-0.5",
                    isFullscreen ? "min-h-0 flex-1 overflow-y-auto" : below ? "" : "flex flex-col",
                  )}
                role="listbox"
                aria-label="Playlist de demonstração"
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
                            below
                              ? "flex w-full flex-col items-stretch gap-2 rounded-[10px] p-2 text-left transition-colors"
                              : "flex w-full min-h-[48px] xl:min-h-[56px] items-center gap-3 xl:gap-4 rounded-[10px] px-2.5 xl:px-3 py-2 text-left transition-colors",
                            dark
                              ? active ? "bg-white/10" : "hover:bg-white/5"
                              : active ? "bg-[var(--color-primary)]/[0.06]" : "hover:bg-black/[0.02]",
                          )}
                        >
                          <span className={cn(
                            "relative shrink-0 overflow-hidden bg-black/5",
                            below
                              ? "aspect-video w-full rounded-[8px]"
                              : "h-[36px] w-[64px] rounded-[6px] lg:h-[42px] lg:w-[74px] lg:rounded-[8px]",
                          )}>
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
                            <span className={cn(
                              "line-clamp-2 text-[13px] leading-snug xl:text-[14px]",
                              active ? "font-semibold" : "font-medium",
                              dark ? "text-white" : active ? "text-[var(--color-primary)]" : "text-[#131316]"
                            )}>
                              {row.title}
                            </span>
                            {active && status === "PLAYING" ? (
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-success)]",
                                  dark && "shadow-[0_0_6px_var(--color-success)]"
                                )}
                                aria-hidden
                              />
                            ) : null}
                          </span>
                          <span className={cn(
                            "mt-0.5 block text-[11px] font-medium",
                            dark ? "text-white/50" : "text-[var(--color-text-muted)]"
                          )}>
                            {String(i + 1).padStart(2, "0")} · {row.type} ·{" "}
                            {formatDemoTime(row.duration * 1000)}
                          </span>
                        </span>
                        {active && status !== "PLAYING" ? (
                          <Play
                            className={cn(
                              "h-3.5 w-3.5 shrink-0",
                              dark ? "text-white/70" : "text-[var(--color-primary)]/70"
                            )}
                            aria-hidden
                          />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className={cn(
                "mt-4 xl:mt-5 pt-3 xl:pt-3 border-t",
                dark ? "border-white/5" : "border-black/[0.04]"
              )}>
                <p className={cn(
                  "shrink-0 px-1 text-[10px] leading-relaxed text-center",
                  dark ? "text-white/30" : "text-[var(--color-text-muted)]/60"
                )}>
                  Demonstração local — sem comandos a dispositivos nem escritas na base de dados.
                </p>
              </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatusDot({
  status,
  light,
}: {
  status: DemoPlaybackStatus;
  light?: boolean;
}) {
  const color =
    status === "PLAYING"
      ? "bg-[var(--color-success)]"
      : status === "PAUSED"
        ? "bg-[var(--color-warning)]"
        : "bg-[var(--color-muted-foreground)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider",
        light ? "text-white/65" : "text-[var(--color-text-secondary)]",
      )}
    >
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
    <div className="absolute inset-0 bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.src}
        alt=""
        className={cn(
          "h-full w-full object-contain transition-transform duration-700 ease-out",
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
      className={cn(
        "pointer-events-auto mx-auto w-full rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur-xl border transition-all",
        isFullscreen 
          ? "max-w-2xl bg-black/50 border-white/10" 
          : "max-w-md sm:max-w-lg bg-white/70 border-white shadow-[0_8px_32px_rgba(0,0,0,0.12)]",
      )}
      role="group"
      aria-label="Controlos do player"
    >
      <div className="flex flex-nowrap items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <IconBtn label="Previous media" onClick={onPrevious} isFullscreen={isFullscreen}>
          <SkipBack className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn
          label={status === "PLAYING" ? "Pause" : "Play"}
          onClick={onPlayPause}
          primary
          isFullscreen={isFullscreen}
        >
          {status === "PLAYING" ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
        </IconBtn>
        <IconBtn label="Stop" onClick={onStop} isFullscreen={isFullscreen}>
          <Square className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label="Next media" onClick={onNext} isFullscreen={isFullscreen}>
          <SkipForward className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label="Restart" onClick={onRestart} isFullscreen={isFullscreen}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </IconBtn>
        <IconBtn label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={onMute} isFullscreen={isFullscreen}>
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
          isFullscreen={isFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          )}
        </IconBtn>
      </div>

      <div className="mt-1.5 flex items-center gap-2 px-0.5">
        <span className={cn(
          "ui-mono shrink-0 text-[10px] tabular-nums",
          isFullscreen ? "text-white/60" : "text-[var(--color-text-muted)]"
        )}>
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
        <span className={cn(
          "ui-mono shrink-0 text-[10px] tabular-nums",
          isFullscreen ? "text-white/60" : "text-[var(--color-text-muted)]"
        )}>
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
  className,
  isFullscreen,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  children: ReactNode;
  className?: string;
  isFullscreen?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors",
        primary
          ? "bg-[var(--color-primary)] text-white shadow-sm hover:bg-[var(--color-primary-hover)]"
          : isFullscreen
            ? "text-white/60 hover:bg-white/10 hover:text-white"
            : "text-[var(--color-text-secondary)] hover:bg-black/5 hover:text-[var(--color-foreground)]",
        className,
      )}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}
