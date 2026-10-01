"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PreviewViewport,
  type PreviewAspect,
} from "@/components/ui/preview-viewport";
import { TypeBadge } from "@/components/ui/type-badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { ContentVisual } from "@/features/contents/content-visual";
import { cn } from "@/lib/utils";

export type PreviewItem = {
  id: string;
  title: string;
  type: string;
  durationMs: number;
  transition?: string;
  fitMode?: string;
  payload: Record<string, unknown>;
  mediaUrl: string | null;
};

const ASPECT_OPTIONS: { value: PreviewAspect; label: string }[] = [
  { value: "16/9", label: "16:9 (1920×1080)" },
  { value: "4/3", label: "4:3 (1024×768)" },
  { value: "9/16", label: "9:16 (1080×1920)" },
  { value: "1/1", label: "1:1 (1080×1080)" },
];

export function PlaylistTimedPreview({
  items,
  selectedIndex,
  onIndexChange,
}: {
  items: PreviewItem[];
  selectedIndex: number;
  onIndexChange: (index: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<PreviewAspect>("16/9");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedFallback, setExpandedFallback] = useState(false);
  const startedRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const index = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(items.length - 1, 0),
  );
  const current = items[index];
  const elapsed = playing ? tick : 0;
  const fullscreenActive = isFullscreen || expandedFallback;

  useEffect(() => {
    function onFsChange() {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) setExpandedFallback(false);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    if (!expandedFallback) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedFallback(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandedFallback]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        setExpandedFallback(false);
        return;
      }
      if (expandedFallback) {
        setExpandedFallback(false);
        return;
      }
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        setIsFullscreen(true);
        return;
      }
      setExpandedFallback(true);
    } catch {
      setExpandedFallback((v) => !v);
    }
  }, [expandedFallback]);

  useEffect(() => {
    if (!playing || !current) return;

    startedRef.current = Date.now();
    const resetId = window.setTimeout(() => setTick(0), 0);

    if (
      (current.type === "VIDEO" || current.type === "AUDIO") &&
      current.durationMs === 0
    ) {
      return () => window.clearTimeout(resetId);
    }

    const id = window.setInterval(() => {
      const ms = Date.now() - startedRef.current;
      setTick(ms);
      if (ms >= current.durationMs) {
        onIndexChange((index + 1) % items.length);
      }
    }, 100);

    return () => {
      window.clearTimeout(resetId);
      window.clearInterval(id);
    };
  }, [playing, current, items.length, index, onIndexChange]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handleEnded = () => {
      if (
        playing &&
        (current?.type === "VIDEO" || current?.type === "AUDIO") &&
        current.durationMs === 0
      ) {
        onIndexChange((index + 1) % items.length);
      }
    };

    el.addEventListener("ended", handleEnded);

    if (playing && current?.type === "VIDEO") {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }

    return () => el.removeEventListener("ended", handleEnded);
  }, [playing, current, index, items.length, onIndexChange]);

  if (!items.length) {
    return (
      <div className="space-y-3">
        <AspectSelector value={aspectRatio} onChange={setAspectRatio} />
        <PreviewViewport aspectRatio={aspectRatio} label="Pré-visualização">
          <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--color-muted)]/40 p-6 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Adicione itens para pré-visualizar a sequência.
            </p>
          </div>
        </PreviewViewport>
      </div>
    );
  }

  const progress = current
    ? Math.min(100, (elapsed / Math.max(current.durationMs, 1)) * 100)
    : 0;

  function go(delta: number) {
    if (!items.length) return;
    onIndexChange((index + delta + items.length) % items.length);
    setTick(0);
  }

  function formatMs(ms: number) {
    const totalSeconds = Math.round(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/90 shadow-[var(--shadow-card)]",
        expandedFallback &&
          "fixed inset-0 z-[120] rounded-none border-0 bg-black",
        isFullscreen && "h-full bg-black",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          fullscreenActive && "border-white/10 bg-black/80 text-white",
        )}
      >
        <AspectSelector
          value={aspectRatio}
          onChange={setAspectRatio}
          dark={fullscreenActive}
        />
        <div className="flex items-center gap-2">
          <TypeBadge contentType={current?.type} />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={
              fullscreenActive
                ? "Sair de ecrã inteiro"
                : "Pré-visualizar em ecrã inteiro"
            }
            title={
              fullscreenActive
                ? "Sair de ecrã inteiro"
                : "Pré-visualizar em ecrã inteiro"
            }
            onClick={() => void toggleFullscreen()}
            className={cn(
              "h-8 w-8",
              fullscreenActive
                ? "text-white hover:bg-white/10 hover:text-white"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
            )}
          >
            {fullscreenActive ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "relative min-h-0 flex-1",
          fullscreenActive && "flex items-center justify-center bg-black p-2 sm:p-4",
        )}
      >
        <div
          className={cn(
            "w-full",
            fullscreenActive && "mx-auto max-h-full max-w-6xl",
          )}
        >
          <PreviewViewport
            aspectRatio={aspectRatio}
            className={fullscreenActive ? "[&>div]:border-white/10" : undefined}
          >
            <div className="relative h-full w-full text-white">
              <div
                className={`player-slide-${current?.transition || "fade"} h-full w-full`}
              >
                <Slide
                  item={current!}
                  videoRef={videoRef}
                  playing={playing}
                  onNaturalEnd={() => onIndexChange((index + 1) % items.length)}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/20 to-transparent px-4 py-2 text-[11px] font-medium tracking-wider text-white">
                <span className="flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[var(--color-foreground)] shadow-sm backdrop-blur">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-success)]" />
                  PREVIEW {index + 1}/{items.length}
                </span>
              </div>
            </div>
          </PreviewViewport>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col",
          fullscreenActive ? "bg-black/90 text-white" : "bg-[var(--color-card)]",
        )}
      >
        <div
          className={cn(
            "group relative h-1.5 cursor-pointer overflow-hidden rounded-full",
            fullscreenActive ? "w-full bg-white/15" : "mx-4 mt-3 bg-[var(--color-primary-soft)]",
          )}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[var(--color-primary)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col sm:w-1/3 sm:flex-none">
            <span
              className={cn(
                "truncate pr-2 text-xs font-semibold",
                fullscreenActive
                  ? "text-white"
                  : "text-[var(--color-foreground)]",
              )}
            >
              {current?.title || "Sem título"}
            </span>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                fullscreenActive
                  ? "text-white/60"
                  : "text-[var(--color-muted-foreground)]",
              )}
            >
              {formatMs(elapsed)} / {formatMs(current?.durationMs ?? 0)}
            </span>
          </div>

          <div className="flex items-center justify-center gap-1 sm:w-1/3">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className={cn(
                "h-8 w-8",
                fullscreenActive
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
              )}
            >
              <SkipBack className="h-4 w-4" fill="currentColor" />
            </Button>

            <Button
              type="button"
              size="icon"
              variant={playing ? "default" : "secondary"}
              aria-label={playing ? "Pausar" : "Reproduzir"}
              onClick={() => {
                setTick(0);
                setPlaying((p) => !p);
              }}
              className="h-10 w-10 rounded-full shadow-sm"
            >
              {playing ? (
                <Pause className="h-4 w-4" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-4 w-4" fill="currentColor" />
              )}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Seguinte"
              onClick={() => go(1)}
              className={cn(
                "h-8 w-8",
                fullscreenActive
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
              )}
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-1 sm:w-1/3 sm:flex-none">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPlaying(false);
                setTick(0);
                onIndexChange(0);
              }}
              className={cn(
                "h-8 text-xs",
                fullscreenActive
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
              )}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reiniciar</span>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={
                fullscreenActive
                  ? "Sair de ecrã inteiro"
                  : "Pré-visualizar em ecrã inteiro"
              }
              onClick={() => void toggleFullscreen()}
              className={cn(
                "h-8 w-8 sm:hidden",
                fullscreenActive
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-[var(--color-muted-foreground)]",
              )}
            >
              {fullscreenActive ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        {!fullscreenActive && items.length > 1 ? (
          <div className="border-t border-[var(--color-border-subtle)] px-3 py-3 sm:px-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Na playlist · {items.length} itens
            </p>
            <ol className="flex gap-2 overflow-x-auto pb-1">
              {items.map((it, i) => (
                <li key={it.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={i === index ? "true" : undefined}
                    onClick={() => {
                      setTick(0);
                      onIndexChange(i);
                    }}
                    className={cn(
                      "flex max-w-[190px] items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors",
                      i === index
                        ? "border-[var(--color-primary)]/35 bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
                        : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-row-hover)]",
                    )}
                  >
                    <span className="tabular-nums opacity-60">{i + 1}</span>
                    <span className="truncate">{it.title || "Sem título"}</span>
                    <span className="tabular-nums opacity-60">{formatMs(it.durationMs)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AspectSelector({
  value,
  onChange,
  dark,
}: {
  value: PreviewAspect;
  onChange: (v: PreviewAspect) => void;
  dark?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Label
        htmlFor="preview-aspect"
        className={cn(
          "text-xs whitespace-nowrap",
          dark && "text-white/70",
        )}
      >
        Aspecto
      </Label>
      <select
        id="preview-aspect"
        value={value}
        onChange={(e) => onChange(e.target.value as PreviewAspect)}
        className={cn(
          "h-8 max-w-[10rem] truncate rounded-md border px-2 text-xs sm:max-w-none",
          dark
            ? "border-white/20 bg-black/40 text-white"
            : "border-[var(--color-border)] bg-[var(--color-card)]",
        )}
        aria-label="Proporção do viewport de pré-visualização"
      >
        {ASPECT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Slide({
  item,
  videoRef,
  playing,
  onNaturalEnd,
}: {
  item: PreviewItem;
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
  onNaturalEnd?: () => void;
}) {
  const body =
    (item.payload.body as string) ||
    (item.payload.message as string) ||
    (item.payload.description as string) ||
    "";

  if (item.type === "IMAGE" && item.mediaUrl) {
    return (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.mediaUrl}
          alt={item.title}
          className="relative z-10 h-full w-full object-contain"
        />
      </div>
    );
  }

  if (item.type === "VIDEO" && item.mediaUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={item.mediaUrl}
          className="h-full w-full object-contain"
          playsInline
          loop={item.durationMs > 60_000}
          autoPlay={playing}
        />
      </div>
    );
  }

  if (item.type === "AUDIO" && item.mediaUrl) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0b1220] via-[#132033] to-[#1a2740] px-6 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
          VITRINE360 · AUDIO
        </p>
        <p className="text-xl font-semibold text-white">{item.title}</p>
        <div className="flex h-10 w-full max-w-xs items-end justify-center gap-1">
          {[28, 48, 36, 62, 40, 54, 32, 58, 44, 50].map((h, i) => (
            <span
              key={i}
              className={cn(
                "w-1.5 rounded-full bg-[var(--color-type-audio)]/80",
                playing && "animate-pulse",
              )}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <audio
          src={item.mediaUrl}
          autoPlay={playing}
          controls
          className="w-full max-w-md"
          onEnded={() => {
            if (playing && item.durationMs === 0) onNaturalEnd?.();
          }}
        />
      </div>
    );
  }

  if (item.type === "CLOCK") {
    return (
      <ContentVisual
        content={{
          id: item.id,
          type: "CLOCK",
          title: item.title,
          durationMs: item.durationMs,
          payload: item.payload ?? {},
          mediaUrl: null,
          mimeType: null,
        }}
      />
    );
  }

  if (item.type === "IMAGE" || item.type === "VIDEO") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#0b1220] px-8 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
          {item.type} · media em falta
        </p>
        <p className="mt-4 text-2xl font-semibold">{item.title}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] px-10 text-center">
      <p className="text-xs tracking-[0.35em] text-white/40">VITRINE360</p>
      <h2
        className="mt-5 max-w-3xl text-3xl font-semibold leading-tight md:text-4xl"
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        {item.title}
      </h2>
      {body ? (
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg">
          {body}
        </p>
      ) : null}
    </div>
  );
}
