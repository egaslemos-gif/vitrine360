/**
 * RUNTIME-PLAYBACK-02/05 — Renderer Adapter
 *
 * Presentation + media element sync. Emits MEDIA_* to PlaybackController.
 * MUST NOT call next()/previous() or mutate playlist index.
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import { createObjectUrl, getConfig, putAssetBlob } from "@/player/cache/indexed-db";
import { useLiveClock } from "@/features/contents/use-live-clock";
import { ExperiencePlaybackSlide } from "@/player/playback/experience-slide";
import { ensureMediaPlayback } from "@/player/playback/ensure-media-playback";
import { AudioVisual } from "@/player/playback/audio-visual";
import { MediaErrorOverlay } from "@/player/playback/media-error-overlay";
import {
  isStillMedia,
  MEDIA_ERROR_CODES,
  resolveObjectFit,
} from "@/player/playback/media-types";
import type { PlaybackController } from "@/player/playback/playback-controller";
import type { PlaybackState } from "@/domain/playback-state";
import type { EnginePlaybackItem } from "@/player/playback/playlist-map";
import {
  PresentationTimer,
  usesNativeMediaEnded,
  usesPresentationTimer,
} from "@/player/playback/playlist-map";

const stageStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  boxSizing: "border-box",
};

const textSlideTitleStyle: CSSProperties = {
  marginTop: "3vh",
  marginBottom: 0,
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: "100%",
  width: "100%",
  fontWeight: 700,
  lineHeight: 1.15,
  fontFamily: "var(--font-fraunces), Georgia, serif",
  fontSize: "clamp(1.5rem, 6.5vw, 10rem)",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  hyphens: "auto",
};

const textSlideBodyStyle: CSSProperties = {
  marginTop: "2.5vh",
  marginLeft: "auto",
  marginRight: "auto",
  maxWidth: "100%",
  width: "100%",
  opacity: 0.88,
  lineHeight: 1.35,
  fontWeight: 500,
  fontSize: "clamp(1rem, 4.2vw, 5.25rem)",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "pre-wrap",
};

function mediaStyleFor(fitMode?: string): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: resolveObjectFit(fitMode),
    objectPosition: "center center",
    // Honor EXIF so portrait phone photos stay upright (Chrome/TV WebViews).
    imageOrientation: "from-image",
    background: "transparent",
  };
}

export type PlaybackRendererAdapterProps = {
  controller: PlaybackController;
  state: PlaybackState;
  item: EnginePlaybackItem | null;
};

/**
 * Adapter: current item → media DOM; lifecycle → controller.dispatch.
 */
export function PlaybackRendererAdapter({
  controller,
  state,
  item,
}: PlaybackRendererAdapterProps) {
  const generation = state.generation;
  const status = state.status;
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const seekAppliedRef = useRef<number | null>(null);
  const timerRef = useRef<PresentationTimer | null>(null);
  if (timerRef.current == null) {
    timerRef.current = new PresentationTimer();
  }

  // Single presentation timer owner (RP-03). PAUSE/STOP/ERROR ⇒ not PLAYING ⇒ stop.
  useEffect(() => {
    const timer = timerRef.current!;
    if (!item || !usesPresentationTimer(item) || status !== "PLAYING") {
      timer.stop();
      return;
    }

    const duration =
      state.durationMs != null && state.durationMs > 0
        ? state.durationMs
        : Math.max(item.durationMs || 8000, 2000);
    const gen = generation;
    const startPosition = controller.getState().positionMs;

    timer.start({
      generation: gen,
      durationMs: duration,
      startPositionMs: startPosition,
      now: () => Date.now(),
      onTick: (elapsed, tickGen) => {
        if (controller.getGeneration() !== tickGen) return;
        if (controller.getState().status !== "PLAYING") {
          timer.pause();
          return;
        }
        controller.tickImageElapsed(elapsed, tickGen);
      },
    });

    return () => {
      timer.stop();
    };
  }, [item, status, generation, state.durationMs, controller]);

  useEffect(() => {
    const timer = timerRef.current;
    return () => {
      timer?.stop();
    };
  }, []);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;

    const onPlayFail = () => {
      controller.dispatch({
        type: "MEDIA_ERROR",
        code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
        message: "Playback could not start",
        recoverable: true,
        generation: controller.getGeneration(),
      });
    };

    if (status === "PAUSED" || status === "STOPPED") {
      try {
        el.volume = state.volume;
        el.muted = state.muted;
      } catch {
        /* ignore */
      }
      if (!el.paused) el.pause();
      if (status === "STOPPED") {
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
      }
    } else if (status === "PLAYING") {
      // Do not force muted/volume while starting — that undoes muted autoplay
      // fallback after browser reload (audio stays paused forever).
      if (el.paused) {
        ensureMediaPlayback(el, {
          onUnrecoverable: onPlayFail,
          desiredMuted: state.muted,
          desiredVolume: state.volume,
        });
      } else {
        try {
          el.volume = state.volume;
          el.muted = state.muted;
        } catch {
          /* ignore */
        }
      }
    }
  }, [status, state.volume, state.muted, generation, controller]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (status !== "PLAYING" && status !== "PAUSED") return;
    if (
      usesPresentationTimer(item ?? { type: "", durationMs: 0 }) &&
      item &&
      item.type !== "VIDEO" &&
      item.type !== "AUDIO"
    ) {
      return;
    }
    const targetSec = state.positionMs / 1000;
    if (
      seekAppliedRef.current !== null &&
      Math.abs(seekAppliedRef.current - state.positionMs) < 50
    ) {
      return;
    }
    if (Math.abs(el.currentTime * 1000 - state.positionMs) > 400) {
      try {
        el.currentTime = targetSec;
        seekAppliedRef.current = state.positionMs;
      } catch {
        /* ignore */
      }
    }
  }, [state.positionMs, status, generation, item]);

  const onMediaEvent = useCallback(
    (action: MediaEventAction) => {
      controller.dispatch(action);
    },
    [controller],
  );

  if (!item || status === "IDLE") {
    return null;
  }

  const rendererKey = `${item.playlistItemId}:${item.contentId}:g${generation}`;

  return (
    <div style={{ position: "absolute", inset: 0 }} data-renderer-adapter>
      <Slide
        key={rendererKey}
        item={item}
        generation={generation}
        status={status}
        volume={state.volume}
        muted={state.muted}
        positionMs={state.positionMs}
        durationMs={state.durationMs}
        loop={
          item.durationMs > 0 &&
          (item.type === "VIDEO" || item.type === "AUDIO")
        }
        mediaRef={mediaRef}
        onMediaEvent={onMediaEvent}
      />
      {status === "ERROR" && state.error ? (
        <MediaErrorOverlay
          code={state.error.code}
          recoverable={state.error.recoverable}
          onRetry={() => controller.dispatch({ type: "PLAY" })}
        />
      ) : null}
    </div>
  );
}

type MediaEventAction =
  | { type: "MEDIA_LOADING" }
  | { type: "MEDIA_READY"; durationMs?: number | null; generation: number }
  | { type: "MEDIA_TIME_UPDATE"; positionMs: number; generation: number }
  | { type: "MEDIA_ENDED"; generation: number }
  | {
      type: "MEDIA_ERROR";
      code: string;
      message: string;
      recoverable?: boolean;
      generation: number;
    };

function Slide({
  item,
  generation,
  status,
  volume,
  muted,
  positionMs,
  durationMs,
  loop,
  mediaRef,
  onMediaEvent,
}: {
  item: EnginePlaybackItem;
  generation: number;
  status: PlaybackState["status"];
  volume: number;
  muted: boolean;
  positionMs: number;
  durationMs: number | null;
  loop: boolean;
  mediaRef: MutableRefObject<HTMLMediaElement | null>;
  onMediaEvent: (action: MediaEventAction) => void;
}) {
  const asset = item.assets[0];
  const assetId = asset?.id;
  const assetUrl = asset?.url;
  const offlineUrl = asset?.offlineUrl;
  const assetChecksum = asset?.checksum ?? "";
  const [url, setUrl] = useState<string | null>(null);
  const nativeEnded = usesNativeMediaEnded(item);
  const still = isStillMedia(item);
  const fit = mediaStyleFor(item.fitMode);

  const emitPlayFail = useCallback(() => {
    onMediaEvent({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation,
    });
  }, [generation, onMediaEvent]);

  useEffect(() => {
    onMediaEvent({ type: "MEDIA_LOADING" });
  }, [generation, onMediaEvent]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      if (!assetId) {
        const payloadUrl = item.payload?.url;
        setUrl(typeof payloadUrl === "string" ? payloadUrl : null);
        return;
      }
      const objectUrl = await createObjectUrl(assetId).catch(() => null);
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      if (objectUrl) {
        revoked = objectUrl;
        setUrl(objectUrl);
        return;
      }
      if (assetUrl && /^https?:\/\//i.test(assetUrl)) {
        setUrl(assetUrl);
        return;
      }
      try {
        const config = await getConfig();
        const path =
          offlineUrl ?? `/api/device/media/${encodeURIComponent(assetId)}`;
        if (!config?.deviceToken) {
          setUrl(assetUrl ?? null);
          return;
        }

        // Smart TVs (Hisense Vidaa, old WebOS) fail to stream video via blob URL
        // because they require HTTP byte-range requests directly from the <video> tag.
        if (item.type === "VIDEO" && !offlineUrl) {
          setUrl(`${path}?token=${config.deviceToken}`);
          return;
        }

        const res = await fetch(path, {
          headers: { Authorization: `Bearer ${config.deviceToken}` },
        });
        if (!res.ok) throw new Error(`media ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        if (assetChecksum) {
          void putAssetBlob(assetId, blob, assetChecksum).catch(() => undefined);
        }
        const blobUrl = URL.createObjectURL(blob);
        revoked = blobUrl;
        setUrl(blobUrl);
      } catch {
        if (!cancelled) setUrl(assetUrl ?? null);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked && revoked.startsWith("blob:")) {
        URL.revokeObjectURL(revoked);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  // Still media + non-AV slides become READY when mounted (timer owns duration).
  useEffect(() => {
    if (item.type === "VIDEO" || item.type === "AUDIO") return;
    if (still && !url) return;
    if (still && url) {
      onMediaEvent({
        type: "MEDIA_READY",
        durationMs: item.durationMs > 0 ? item.durationMs : 8000,
        generation,
      });
      return;
    }
    if (!still) {
      onMediaEvent({
        type: "MEDIA_READY",
        durationMs: item.durationMs > 0 ? item.durationMs : 8000,
        generation,
      });
    }
  }, [item.type, item.durationMs, url, generation, onMediaEvent, still]);

  // volume/muted applied via ensureMediaPlayback while starting.

  if (still && url) {
    return (
      <div style={{ ...stageStyle, background: "#000" }} data-media-kind="still">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={item.title}
          className="player-media"
          style={{ ...fit, zIndex: 1 }}
          onError={() => {
            onMediaEvent({
              type: "MEDIA_ERROR",
              code: MEDIA_ERROR_CODES.MEDIA_LOAD_ERROR,
              message: "Media unavailable",
              recoverable: true,
              generation,
            });
          }}
        />
      </div>
    );
  }

  if (item.type === "VIDEO" && url) {
    return (
      <div style={{ ...stageStyle, background: "#000" }} data-media-kind="video">
        <video
          key={url}
          src={url}
          className="player-media"
          style={fit}
          autoPlay
          playsInline
          muted={muted}
          preload="auto"
          loop={loop}
          ref={(el) => {
            mediaRef.current = el;
            if (el && status === "PLAYING") {
              ensureMediaPlayback(el, {
                onUnrecoverable: emitPlayFail,
                desiredMuted: muted,
                desiredVolume: volume,
              });
            }
          }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            const natural =
              Number.isFinite(el.duration) && el.duration > 0
                ? Math.round(el.duration * 1000)
                : null;
            onMediaEvent({
              type: "MEDIA_READY",
              durationMs: nativeEnded
                ? natural
                : item.durationMs > 0
                  ? item.durationMs
                  : natural,
              generation,
            });
            ensureMediaPlayback(el, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            });
          }}
          onLoadedData={(e) =>
            ensureMediaPlayback(e.currentTarget, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            })
          }
          onCanPlay={(e) =>
            ensureMediaPlayback(e.currentTarget, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            })
          }
          onTimeUpdate={(e) => {
            onMediaEvent({
              type: "MEDIA_TIME_UPDATE",
              positionMs: Math.round(e.currentTarget.currentTime * 1000),
              generation,
            });
          }}
          onEnded={() => {
            if (nativeEnded) {
              onMediaEvent({ type: "MEDIA_ENDED", generation });
            }
          }}
          onError={() => {
            onMediaEvent({
              type: "MEDIA_ERROR",
              code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
              message: "Media unavailable",
              recoverable: true,
              generation,
            });
          }}
        />
      </div>
    );
  }

  if (item.type === "AUDIO" && url) {
    const artist =
      typeof item.payload.artist === "string" ? item.payload.artist : null;
    const album =
      typeof item.payload.album === "string" ? item.payload.album : null;
    return (
      <div style={{ position: "absolute", inset: 0 }} data-media-kind="audio">
        <AudioVisual
          title={item.title}
          artist={artist}
          album={album}
          positionMs={positionMs}
          durationMs={durationMs}
          status={status}
        />
        <audio
          key={url}
          src={url}
          autoPlay
          muted={muted}
          preload="auto"
          controls={false}
          loop={loop}
          style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
          aria-hidden
          ref={(el) => {
            mediaRef.current = el;
            if (el && status === "PLAYING") {
              ensureMediaPlayback(el, {
                onUnrecoverable: emitPlayFail,
                desiredMuted: muted,
                desiredVolume: volume,
              });
            }
          }}
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            const natural =
              Number.isFinite(el.duration) && el.duration > 0
                ? Math.round(el.duration * 1000)
                : null;
            onMediaEvent({
              type: "MEDIA_READY",
              durationMs: nativeEnded
                ? natural
                : item.durationMs > 0
                  ? item.durationMs
                  : natural,
              generation,
            });
            ensureMediaPlayback(el, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            });
          }}
          onLoadedData={(e) =>
            ensureMediaPlayback(e.currentTarget, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            })
          }
          onCanPlay={(e) =>
            ensureMediaPlayback(e.currentTarget, {
              onUnrecoverable: emitPlayFail,
              desiredMuted: muted,
              desiredVolume: volume,
            })
          }
          onTimeUpdate={(e) => {
            onMediaEvent({
              type: "MEDIA_TIME_UPDATE",
              positionMs: Math.round(e.currentTarget.currentTime * 1000),
              generation,
            });
          }}
          onEnded={() => {
            if (nativeEnded) {
              onMediaEvent({ type: "MEDIA_ENDED", generation });
            }
          }}
          onError={() => {
            onMediaEvent({
              type: "MEDIA_ERROR",
              code: MEDIA_ERROR_CODES.MEDIA_DECODE_ERROR,
              message: "Media unavailable",
              recoverable: true,
              generation,
            });
          }}
        />
      </div>
    );
  }

  if (item.type === "CLOCK") {
    return <LiveClockSlide payload={item.payload ?? {}} />;
  }

  if (item.type === "EXPERIENCE") {
    return <ExperiencePlaybackSlide item={item} />;
  }

  // Still without URL yet — wait (LOADING). Avoid TEXT fallback for GIF/IMAGE.
  if (still) {
    return (
      <div
        style={{
          ...stageStyle,
          background: "#070b14",
          color: "rgba(255,255,255,0.55)",
        }}
        data-media-kind="still-loading"
      >
        A carregar…
      </div>
    );
  }

  const body =
    (item.payload.body as string) ||
    (item.payload.message as string) ||
    (item.payload.description as string) ||
    "";

  return (
    <div
      style={{
        ...stageStyle,
        flexDirection: "column",
        textAlign: "center",
        padding: "max(2vh, 12px) max(4vw, 12px)",
        background:
          "linear-gradient(160deg,#0b1220 0%,#132033 55%,#1a2740 100%)",
        width: "100%",
        height: "100%",
      }}
    >
      <p
        style={{
          margin: 0,
          letterSpacing: "0.2em",
          opacity: 0.45,
          fontWeight: 600,
          fontSize: "clamp(0.7rem, 2.2vw, 2.25rem)",
          maxWidth: "100%",
          overflowWrap: "anywhere",
        }}
      >
        VITRINE360
      </p>
      <h1 style={textSlideTitleStyle}>{item.title}</h1>
      {body ? <p style={textSlideBodyStyle}>{body}</p> : null}
    </div>
  );
}

function LiveClockSlide({ payload }: { payload: Record<string, unknown> }) {
  const showDate = payload.showDate !== false;
  const showTime = payload.showTime !== false;
  const showSeconds = payload.showSeconds === true;
  const style = payload.style === "analog" ? "analog" : "digital";
  const format = typeof payload.format === "string" ? payload.format : "24h";
  const hour12 = format === "12h";
  const now = useLiveClock(showSeconds || style === "analog");

  if (style === "analog") {
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const hourDeg = h * 30 + m * 0.5;
    const minDeg = m * 6 + s * 0.1;
    const secDeg = s * 6;
    return (
      <div
        style={{
          ...stageStyle,
          flexDirection: "column",
          background: "#0b1220",
          textAlign: "center",
          padding: "4vh 6vw",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "min(42vh, 280px)",
            height: "min(42vh, 280px)",
            borderRadius: "9999px",
            border: "4px solid rgba(255,255,255,0.4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 4,
              height: "28%",
              background: "#fff",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -100%) rotate(${hourDeg}deg)`,
              borderRadius: 2,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 3,
              height: "38%",
              background: "rgba(255,255,255,0.9)",
              transformOrigin: "bottom center",
              transform: `translate(-50%, -100%) rotate(${minDeg}deg)`,
              borderRadius: 2,
            }}
          />
          {showSeconds ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 1,
                height: "42%",
                background: "#34d399",
                transformOrigin: "bottom center",
                transform: `translate(-50%, -100%) rotate(${secDeg}deg)`,
              }}
            />
          ) : null}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 10,
              height: 10,
              borderRadius: "9999px",
              background: "#fff",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        {showDate ? (
          <p
            style={{
              marginTop: "3vh",
              opacity: 0.78,
              fontWeight: 500,
              fontSize: "clamp(40px, 7vh, 88px)",
            }}
          >
            {now.toLocaleDateString()}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        ...stageStyle,
        flexDirection: "column",
        background: "#0b1220",
        textAlign: "center",
        padding: "4vh 6vw",
      }}
    >
      {showTime ? (
        <p
          style={{
            margin: 0,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: "0.04em",
            fontVariantNumeric: "tabular-nums",
            fontFamily: "ui-monospace, Consolas, monospace",
            fontSize: "clamp(120px, 32vh, 320px)",
          }}
        >
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: showSeconds ? "2-digit" : undefined,
            hour12,
          })}
        </p>
      ) : null}
      {showDate ? (
        <p
          style={{
            marginTop: "3vh",
            opacity: 0.78,
            fontWeight: 500,
            fontSize: "clamp(40px, 7vh, 88px)",
          }}
        >
          {now.toLocaleDateString()}
        </p>
      ) : null}
    </div>
  );
}
