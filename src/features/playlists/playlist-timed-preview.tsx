"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  PreviewViewport,
  type PreviewAspect,
} from "@/components/ui/preview-viewport";
import { TypeBadge } from "@/components/ui/type-badge";
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";

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
  { value: "16/9", label: "16:9" },
  { value: "4/3", label: "4:3" },
  { value: "9/16", label: "9:16" },
  { value: "1/1", label: "1:1" },
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
  const startedRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const index = Math.min(
    Math.max(selectedIndex, 0),
    Math.max(items.length - 1, 0),
  );
  const current = items[index];
  const elapsed = playing ? tick : 0;

  useEffect(() => {
    if (!playing || !current) return;

    startedRef.current = Date.now();
    const resetId = window.setTimeout(() => setTick(0), 0);

    if (current.type === "VIDEO" && current.durationMs === 0) {
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
      if (playing && current?.type === "VIDEO" && current.durationMs === 0) {
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
    <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 px-3 py-2">
        <AspectSelector value={aspectRatio} onChange={setAspectRatio} />
        <TypeBadge contentType={current?.type} />
      </div>

      <PreviewViewport aspectRatio={aspectRatio}>
        <div className="relative h-full w-full text-white">
          <div className={`player-slide-${current?.transition || "fade"} h-full w-full`}>
            <Slide item={current!} videoRef={videoRef} playing={playing} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/40 to-transparent px-4 py-2 text-[11px] font-medium tracking-wider text-white">
            <span className="flex items-center gap-2 rounded-md bg-black/40 px-2 py-1 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              PREVIEW {index + 1}/{items.length}
            </span>
          </div>
        </div>
      </PreviewViewport>

      <div className="flex flex-col bg-[var(--color-card)]">
        <div className="group relative h-1 w-full cursor-pointer bg-[var(--color-muted)]">
          <div
            className="absolute inset-y-0 left-0 bg-[var(--color-primary)] transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex w-1/3 min-w-0 flex-col">
            <span className="truncate pr-4 text-xs font-semibold text-[var(--color-foreground)]">
              {current?.title || "Sem título"}
            </span>
            <span className="text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
              {formatMs(elapsed)} / {formatMs(current?.durationMs ?? 0)}
            </span>
          </div>

          <div className="flex w-1/3 items-center justify-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Anterior"
              onClick={() => go(-1)}
              className="h-8 w-8 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
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
              className="h-8 w-8 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <SkipForward className="h-4 w-4" fill="currentColor" />
            </Button>
          </div>

          <div className="flex w-1/3 items-center justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPlaying(false);
                setTick(0);
                onIndexChange(0);
              }}
              className="h-8 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reiniciar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AspectSelector({
  value,
  onChange,
}: {
  value: PreviewAspect;
  onChange: (v: PreviewAspect) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="preview-aspect" className="text-xs whitespace-nowrap">
        Aspecto
      </Label>
      <select
        id="preview-aspect"
        value={value}
        onChange={(e) => onChange(e.target.value as PreviewAspect)}
        className="h-8 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-xs"
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
}: {
  item: PreviewItem;
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
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
          muted
          playsInline
          loop={item.durationMs > 60_000}
          autoPlay={playing}
        />
      </div>
    );
  }

  if (item.type === "CLOCK") {
    const now = new Date();
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#0b1220]">
        <p className="text-5xl font-semibold tabular-nums md:text-6xl">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="mt-3 text-lg text-white/70">{now.toLocaleDateString()}</p>
      </div>
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
