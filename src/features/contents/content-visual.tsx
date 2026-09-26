"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentPreviewModel } from "@/features/contents/content-preview-types";
import { useLiveClock } from "@/features/contents/use-live-clock";

export type ContentVisualProps = {
  content: Pick<
    ContentPreviewModel,
    "id" | "title" | "type" | "durationMs" | "payload" | "mediaUrl" | "mimeType"
  >;
  /** Injected clock for CLOCK preview; defaults to now. */
  previewNow?: Date;
};

const stageClass =
  "flex h-full w-full min-w-0 flex-col items-center justify-center overflow-hidden bg-[#0b1220] text-white";

const textPadClass = "px-4 sm:px-8 md:px-10";
const titleBaseClass =
  "mt-4 w-full max-w-3xl min-w-0 break-words font-semibold leading-tight [overflow-wrap:anywhere]";
const bodyBaseClass =
  "mt-4 w-full max-w-2xl min-w-0 break-words text-sm leading-relaxed text-white/80 sm:text-base md:text-lg whitespace-pre-wrap [overflow-wrap:anywhere]";
const brandClass =
  "max-w-full text-[10px] tracking-[0.2em] text-white/40 sm:text-xs sm:tracking-[0.35em]";

function plain(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function textAlign(align: unknown): "left" | "center" | "right" {
  if (align === "left" || align === "right" || align === "center") return align;
  return "center";
}

function fontSizeClass(fontSize: unknown): string {
  if (fontSize === "small") return "text-base sm:text-lg md:text-xl";
  if (fontSize === "medium") return "text-xl sm:text-2xl md:text-3xl";
  if (fontSize === "xlarge") {
    return "text-2xl sm:text-4xl md:text-5xl lg:text-6xl break-words";
  }
  // default large
  return "text-xl sm:text-3xl md:text-4xl break-words";
}

function ImageVisual({
  title,
  mediaUrl,
  mimeType,
}: {
  title: string;
  mediaUrl: string | null;
  mimeType: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const gif = mimeType === "image/gif";

  if (!mediaUrl || failed) {
    return (
      <div className={`${stageClass} bg-black px-8 text-center`}>
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
          {gif ? "IMAGE · GIF · media em falta" : "IMAGE · media em falta"}
        </p>
        <p className="mt-4 text-2xl font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {!loaded ? (
        <p className="absolute text-sm text-white/50">A carregar…</p>
      ) : null}
      {gif ? (
        <span className="absolute left-3 top-3 z-20 rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          GIF
        </span>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl}
        alt={title}
        className="relative z-10 h-full w-full object-contain"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function VideoVisual({
  title,
  mediaUrl,
  durationMs,
}: {
  title: string;
  mediaUrl: string | null;
  durationMs: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [mediaUrl]);

  if (!mediaUrl || failed) {
    return (
      <div className={`${stageClass} bg-black px-8 text-center`}>
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
          VIDEO · media em falta
        </p>
        <p className="mt-4 text-2xl font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={mediaUrl}
        className="h-full w-full object-contain"
        playsInline
        controls
        preload="metadata"
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider text-white/80">
        {durationMs === 0 ? "Duração natural" : `${durationMs} ms`}
      </div>
    </div>
  );
}

function AudioVisual({
  title,
  mediaUrl,
  durationMs,
}: {
  title: string;
  mediaUrl: string | null | undefined;
  durationMs: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = audioRef.current;
    return () => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [mediaUrl]);

  if (!mediaUrl || failed) {
    return (
      <div className={`${stageClass} bg-[#0b1220] px-8 text-center`}>
        <p className="text-xs uppercase tracking-[0.25em] text-white/40">
          AUDIO · media em falta
        </p>
        <p className="mt-4 text-2xl font-semibold">{title}</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#0b1220] via-[#132033] to-[#1a2740] px-8 text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-white/40">
        VITRINE360 · AUDIO
      </p>
      <p className="mt-4 text-2xl font-semibold text-white">{title}</p>
      <audio
        ref={audioRef}
        src={mediaUrl}
        className="mt-8 w-full max-w-md"
        controls
        preload="metadata"
        autoPlay
        onError={() => setFailed(true)}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-wider text-white/80">
        {durationMs === 0 ? "Duração natural" : `${durationMs} ms`}
      </div>
    </div>
  );
}

function ClockVisual({
  payload,
}: {
  payload: Record<string, unknown>;
  previewNow?: Date;
}) {
  const showDate = payload.showDate !== false;
  const showTime = payload.showTime !== false;
  const format = plain(payload.format) || "24h";
  const hour12 = format === "12h";
  const showSeconds = payload.showSeconds === true;
  const style = payload.style === "analog" ? "analog" : "digital";
  const now = useLiveClock(showSeconds || style === "analog");

  if (style === "analog") {
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const hourDeg = h * 30 + m * 0.5;
    const minDeg = m * 6 + s * 0.1;
    const secDeg = s * 6;
    return (
      <div className={stageClass}>
        <div className="relative h-40 w-40 rounded-full border-4 border-white/40 md:h-48 md:w-48">
          <div
            className="absolute left-1/2 top-1/2 h-[28%] w-1 origin-bottom rounded bg-white"
            style={{ transform: `translate(-50%, -100%) rotate(${hourDeg}deg)` }}
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 h-[38%] w-0.5 origin-bottom rounded bg-white/90"
            style={{ transform: `translate(-50%, -100%) rotate(${minDeg}deg)` }}
            aria-hidden
          />
          {showSeconds ? (
            <div
              className="absolute left-1/2 top-1/2 h-[42%] w-px origin-bottom bg-[var(--color-primary)]"
              style={{
                transform: `translate(-50%, -100%) rotate(${secDeg}deg)`,
              }}
              aria-hidden
            />
          ) : null}
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
        </div>
        {showDate ? (
          <p className="mt-4 text-lg text-white/70">{now.toLocaleDateString()}</p>
        ) : null}
      </div>
    );
  }

  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: showSeconds ? "2-digit" : undefined,
    hour12,
  });

  return (
    <div className={stageClass}>
      {showTime ? (
        <p className="text-5xl font-semibold tabular-nums md:text-6xl">{timeStr}</p>
      ) : null}
      {showDate ? (
        <p className={`text-lg text-white/70 ${showTime ? "mt-3" : ""}`}>
          {now.toLocaleDateString()}
        </p>
      ) : null}
      {!showDate && !showTime ? (
        <p className="text-sm text-white/50">Relógio sem campos activos</p>
      ) : null}
    </div>
  );
}

function QrStubVisual({
  title,
  payload,
}: {
  title: string;
  payload: Record<string, unknown>;
}) {
  const url = plain(payload.url);
  const label = plain(payload.label);

  return (
    <div className={`${stageClass} bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] ${textPadClass} text-center`}>
      <p className={brandClass}>VITRINE360 · QR_CODE</p>
      <h2
        className={`${titleBaseClass} text-2xl sm:text-3xl md:text-4xl`}
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        {title}
      </h2>
      {label ? (
        <p className={`${bodyBaseClass} text-white/70`}>{label}</p>
      ) : null}
      {url ? (
        <p className="mt-4 max-w-xl break-all text-xs text-white/60 sm:text-sm">{url}</p>
      ) : null}
      <p className="mt-8 rounded-md border border-dashed border-white/30 px-4 py-3 text-xs uppercase tracking-wider text-white/50">
        QR visual ainda não disponível
      </p>
    </div>
  );
}

function TextLikeVisual({
  title,
  type,
  payload,
}: {
  title: string;
  type: string;
  payload: Record<string, unknown>;
}) {
  if (type === "NOTICE") {
    const message = plain(payload.message);
    return (
      <div className={`${stageClass} bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] ${textPadClass} text-center`}>
        <p className={brandClass}>VITRINE360 · NOTICE</p>
        <h2
          className={`${titleBaseClass} text-2xl sm:text-3xl md:text-4xl`}
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {title}
        </h2>
        {message ? <p className={bodyBaseClass}>{message}</p> : null}
      </div>
    );
  }

  if (type === "EVENT") {
    const description = plain(payload.description);
    const date = plain(payload.date);
    const time = plain(payload.time);
    const location = plain(payload.location);
    return (
      <div className={`${stageClass} bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] ${textPadClass} text-center`}>
        <p className={brandClass}>VITRINE360 · EVENT</p>
        <h2
          className={`${titleBaseClass} text-2xl sm:text-3xl md:text-4xl`}
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {title}
        </h2>
        {description ? <p className={bodyBaseClass}>{description}</p> : null}
        <div className="mt-6 w-full max-w-2xl space-y-1 break-words text-sm text-white/60">
          {date ? <p>Data: {date}</p> : null}
          {time ? <p>Hora: {time}</p> : null}
          {location ? <p>Local: {location}</p> : null}
        </div>
      </div>
    );
  }

  if (type === "NEWS") {
    const body = plain(payload.body);
    const source = plain(payload.source);
    return (
      <div className={`${stageClass} bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] ${textPadClass} text-center`}>
        <p className={brandClass}>VITRINE360 · NEWS</p>
        <h2
          className={`${titleBaseClass} text-2xl sm:text-3xl md:text-4xl`}
          style={{ fontFamily: "var(--font-fraunces), serif" }}
        >
          {title}
        </h2>
        {body ? <p className={bodyBaseClass}>{body}</p> : null}
        {source ? (
          <p className="mt-4 max-w-full break-words text-sm text-white/50">
            Fonte: {source}
          </p>
        ) : null}
      </div>
    );
  }

  // TEXT (default text-like)
  const body = plain(payload.body);
  const align = textAlign(payload.align);
  const sizeClass = fontSizeClass(payload.fontSize);

  return (
    <div
      className={`${stageClass} bg-[linear-gradient(160deg,#0b1220_0%,#132033_55%,#1a2740_100%)] ${textPadClass}`}
      style={{ textAlign: align }}
    >
      <p className={brandClass}>VITRINE360 · TEXT</p>
      <h2
        className={`${titleBaseClass} ${sizeClass}`}
        style={{ fontFamily: "var(--font-fraunces), serif" }}
      >
        {title}
      </h2>
      {body ? <p className={bodyBaseClass}>{body}</p> : null}
    </div>
  );
}

/**
 * Presentational Content renderer for admin Preview.
 * No Player / IndexedDB / Device / Playlist dependencies.
 */
export function ContentVisual({ content, previewNow }: ContentVisualProps) {
  const { type, title, payload, mediaUrl, durationMs, mimeType } = content;
  void previewNow;

  if (type === "IMAGE") {
    return (
      <ImageVisual title={title} mediaUrl={mediaUrl} mimeType={mimeType} />
    );
  }
  if (type === "VIDEO") {
    return (
      <VideoVisual title={title} mediaUrl={mediaUrl} durationMs={durationMs} />
    );
  }
  if (type === "AUDIO") {
    return (
      <AudioVisual title={title} mediaUrl={mediaUrl} durationMs={durationMs} />
    );
  }
  if (type === "CLOCK") {
    return <ClockVisual payload={payload} />;
  }
  if (type === "QR_CODE") {
    return <QrStubVisual title={title} payload={payload} />;
  }
  if (
    type === "TEXT" ||
    type === "NOTICE" ||
    type === "EVENT" ||
    type === "NEWS"
  ) {
    return <TextLikeVisual title={title} type={type} payload={payload} />;
  }

  return (
    <div className={`${stageClass} px-8 text-center`}>
      <p className="text-xs uppercase tracking-[0.25em] text-white/40">
        {type}
      </p>
      <p className="mt-4 text-2xl font-semibold">{title}</p>
    </div>
  );
}
