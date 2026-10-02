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
import {
  ensureMediaPlayback,
  disposeMediaElement,
  enableSoundOnElement,
  readUserActivation,
} from "@/player/playback/ensure-media-playback";
import { useMediaSignalStore, type MediaSignalStore } from "@/player/playback/media-signal";
import { AudioVisual } from "@/player/playback/audio-visual";
import { MediaErrorOverlay } from "@/player/playback/media-error-overlay";
import {
  classifyMediaError,
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
    // Fix for older WebKit based TVs (WebOS/Tizen/Vidaa)
    // @ts-expect-error: WebkitImageOrientation is not in React.CSSProperties
    WebkitImageOrientation: "from-image",
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
  const prevGenerationRef = useRef<number>(generation);
  // Target of a seek that is still in flight (cleared on `seeked`); never a permanent memory.
  const seekInFlightRef = useRef<number | null>(null);
  const signals = useMediaSignalStore();
  const timerRef = useRef<PresentationTimer | null>(null);
  if (timerRef.current == null) {
    timerRef.current = new PresentationTimer();
  }

  // P4/P5 FIX: Force-dispose the previous media element when generation changes.
  // This prevents audio/video from continuing to play in the background when the
  // playlist advances to the next item.
  if (prevGenerationRef.current !== generation) {
    prevGenerationRef.current = generation;
    if (mediaRef.current) {
      disposeMediaElement(mediaRef.current);
      mediaRef.current = null;
    }
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
      // Always pause (also when already paused): this cancels a pending `autoplay` start.
      el.pause();
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
          // Un-muting without user activation makes browsers pause the element: only apply
          // it when the browser can honour it (the explicit gesture path handles the rest).
          if (state.muted || readUserActivation() !== false) el.muted = state.muted;
        } catch {
          /* ignore */
        }
      }
    }
  }, [status, state.volume, state.muted, generation, controller]);

  // A new item/generation never inherits the seek still in flight of the previous element.
  useEffect(() => {
    seekInFlightRef.current = null;
  }, [generation]);

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
    // FIXED window (item.durationMs > 0): the timeline is the playlist window, the media is
    // looped inside it — map the window position onto the media's own (natural) length.
    const fixedWindow =
      !!item &&
      (item.type === "VIDEO" || item.type === "AUDIO") &&
      usesPresentationTimer(item);
    const naturalMs =
      Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : 0;
    const targetMs =
      fixedWindow && naturalMs > 0
        ? state.positionMs % naturalMs
        : state.positionMs;
    // Same seek still being applied by the element -> wait for `seeked`; any new intent
    // (even to the same position as an earlier, completed seek) is applied.
    if (
      seekInFlightRef.current !== null &&
      Math.abs(seekInFlightRef.current - targetMs) < 50
    ) {
      return;
    }
    let drift = Math.abs(el.currentTime * 1000 - targetMs);
    if (fixedWindow && naturalMs > 0) drift = Math.min(drift, naturalMs - drift);
    if (drift > 400) {
      try {
        const done = () => {
          seekInFlightRef.current = null;
          el.removeEventListener("seeked", done);
        };
        seekInFlightRef.current = targetMs;
        el.addEventListener("seeked", done);
        el.currentTime = targetMs / 1000;
      } catch {
        seekInFlightRef.current = null;
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

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined" && item) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.__v360_media_debug) w.__v360_media_debug = {};
      w.__v360_media_debug.generation = generation;
      w.__v360_media_debug.contentId = item.contentId;
    }
  }, [generation, item?.contentId]);

  if (!item || status === "IDLE") {
    return null;
  }

  const rendererKey = `${item.playlistItemId}:${item.contentId}:g${generation}`;
  // FIXED window longer than the media → keep looping inside it (never freeze on the last frame).
  const loopInWindow =
    (item.type === "VIDEO" || item.type === "AUDIO") && usesPresentationTimer(item);

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      data-renderer-adapter
      aria-hidden="true"
    >
      <Slide
        key={rendererKey}
        item={item}
        generation={generation}
        status={status}
        volume={state.volume}
        muted={state.muted}
        positionMs={state.positionMs}
        durationMs={state.durationMs}
        loop={loopInWindow}
        mediaRef={mediaRef}
        onMediaEvent={onMediaEvent}
        controller={controller}
        signals={signals}
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
  controller,
  signals,
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
  controller: PlaybackController;
  signals: MediaSignalStore | null;
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
  
  const localMediaRef = useRef<HTMLMediaElement | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (!w.__v360_media_debug) {
        w.__v360_media_debug = {
          audioCount: 0,
          videoCount: 0,
          activeMediaCount: 0,
          created: 0,
          disposed: 0,
          history: []
        };
      }
      
      const debug = w.__v360_media_debug;
      debug.created++;
      if (item.type === "AUDIO") debug.audioCount++;
      if (item.type === "VIDEO") debug.videoCount++;
      debug.activeMediaCount = debug.audioCount + debug.videoCount;
      debug.mediaType = item.type;
      debug.history.push(`[CREATED] ${item.type} | Gen: ${generation} | Active: ${debug.activeMediaCount}`);
      
      // We attach an interval to track currentTime and readyState of the current media
      const interval = setInterval(() => {
         const el = localMediaRef.current;
         if (el) {
           debug.currentTime = el.currentTime;
           debug.readyState = el.readyState;
         }
      }, 500);

      return () => {
        clearInterval(interval);
        debug.disposed++;
        if (item.type === "AUDIO") debug.audioCount = Math.max(0, debug.audioCount - 1);
        if (item.type === "VIDEO") debug.videoCount = Math.max(0, debug.videoCount - 1);
        debug.activeMediaCount = debug.audioCount + debug.videoCount;
        debug.history.push(`[DISPOSED] ${item.type} | Gen: ${generation} | Active: ${debug.activeMediaCount}`);
        
        if (localMediaRef.current) {
          disposeMediaElement(localMediaRef.current);
        }
      };
    }
    
    // Non-development environment fallback
    return () => {
      if (localMediaRef.current) {
        disposeMediaElement(localMediaRef.current);
      }
    };
  }, [item.type, generation]);

  const logVideoDiag = useCallback((eventName: string, extra?: string) => {
    if (process.env.NODE_ENV !== "development") return; // diagnostics only in dev
    if (item.type !== "VIDEO") return;
    const el = localMediaRef.current as HTMLVideoElement | null;
    let base = `[MEDIA] [VIDEO-DIAG] ${eventName} event disparado`;
    if (extra) base += ` | ${extra}`;
    if (!el) {
      console.log(base);
      return;
    }
    const safeSrc = (el.src || "").replace(/token=[^&]+/, "token=***");
    const safeCurrentSrc = (el.currentSrc || "").replace(/token=[^&]+/, "token=***");
    console.log(`${base} | src=${safeSrc} | currentSrc=${safeCurrentSrc} | readyState=${el.readyState} | networkState=${el.networkState} | w=${el.videoWidth} h=${el.videoHeight} | dur=${el.duration} | cur=${el.currentTime} | paused=${el.paused} | muted=${el.muted} | autoplay=${el.autoplay} | preload=${el.preload} | err.code=${el.error?.code} err.msg=${el.error?.message}`);
  }, [item.type]);



  const emitPlayFail = useCallback(() => {
    onMediaEvent({
      type: "MEDIA_ERROR",
      code: MEDIA_ERROR_CODES.MEDIA_PLAY_ERROR,
      message: "Playback could not start",
      recoverable: true,
      generation,
    });
  }, [generation, onMediaEvent]);

  // A cached still can fire <img onLoad> before this effect runs; READY must never be
  // overtaken by LOADING, so an early READY is parked until LOADING has been sent.
  const loadingSentRef = useRef(false);
  const pendingReadyRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    onMediaEvent({ type: "MEDIA_LOADING" });
    loadingSentRef.current = true;
    const pending = pendingReadyRef.current;
    pendingReadyRef.current = null;
    pending?.();
  }, [generation, onMediaEvent]);

  const latestPlayback = useRef({ status, muted, volume, emitPlayFail });
  useEffect(() => {
    latestPlayback.current = { status, muted, volume, emitPlayFail };
  });

  // Native events may arrive late (after STOP, after a seek while paused, from a previous
  // item). Only start playback while the controller still wants it for THIS generation.
  const startIfWanted = useCallback(
    (el: HTMLMediaElement) => {
      const s = controller.getState();
      if (s.generation !== generation) return;
      if (s.status !== "LOADING" && s.status !== "PLAYING") return;
      ensureMediaPlayback(el, {
        onUnrecoverable: emitPlayFail,
        desiredMuted: s.muted,
        desiredVolume: s.volume,
      });
    },
    [controller, generation, emitPlayFail],
  );

  // Observable (presentation-only) signals: what the element really does.
  const detachSignalsRef = useRef<(() => void) | null>(null);
  const syncSignalsRef = useRef<() => void>(() => undefined);
  const bindSignals = useCallback(
    (el: HTMLMediaElement) => {
      if (!signals) return () => undefined;
      const wantsPlay = () => {
        const st = controller.getState().status;
        return st === "PLAYING" || st === "LOADING";
      };
      const enableSound = () => {
        const st = controller.getState();
        enableSoundOnElement(el, {
          desiredMuted: st.muted,
          desiredVolume: st.volume,
          onUnrecoverable: latestPlayback.current.emitPlayFail,
        });
      };
      signals.setGestureHandler(enableSound);
      const gestureTypes = ["pointerdown", "keydown", "touchend"];
      let armed = false;
      const onGesture = () => {
        for (const t of gestureTypes) window.removeEventListener(t, onGesture, true);
        armed = false;
        if (mediaRef.current === el && wantsPlay()) enableSound();
      };
      const armGesture = () => {
        if (armed) return;
        armed = true;
        for (const t of gestureTypes) window.addEventListener(t, onGesture, true);
      };
      const sync = () => {
        if (mediaRef.current !== el) return;
        const st = controller.getState();
        const silent = !st.muted && el.muted;
        signals.patch({
          effectiveMuted: el.muted,
          audioBlocked: silent && wantsPlay(),
        });
      };
      syncSignalsRef.current = sync;
      const onPauseEv = () => {
        if (mediaRef.current !== el || el.ended) return;
        if (wantsPlay() && el.paused) {
          signals.patch({ playBlocked: true, buffering: false });
          armGesture();
        }
      };
      const onPlayingEv = () => {
        signals.patch({ playBlocked: false, buffering: false });
        sync();
      };
      const onWaitingEv = () => {
        if (mediaRef.current !== el) return;
        if (controller.getState().status === "PLAYING" && !el.paused && el.readyState < 3) {
          signals.patch({ buffering: true });
        }
      };
      const onProgressEv = () => {
        if (el.readyState >= 3 && !el.paused) signals.patch({ buffering: false });
      };
      const handlers: [string, () => void][] = [
        ["volumechange", sync],
        ["pause", onPauseEv],
        ["playing", onPlayingEv],
        ["waiting", onWaitingEv],
        ["stalled", onWaitingEv],
        ["canplay", onProgressEv],
        ["seeked", onProgressEv],
        ["timeupdate", onProgressEv],
      ];
      for (const [n, h] of handlers) el.addEventListener(n, h);
      sync();
      return () => {
        for (const [n, h] of handlers) el.removeEventListener(n, h);
        for (const t of gestureTypes) window.removeEventListener(t, onGesture, true);
        signals.setGestureHandler(null);
        syncSignalsRef.current = () => undefined;
        signals.reset();
      };
    },
    [signals, controller, mediaRef],
  );

  // Keep the effective-audio signal honest when the user's mute intent changes.
  useEffect(() => {
    syncSignalsRef.current();
  }, [muted, status]);

  // Stable ref callback: React only calls it on mount/unmount of the element. An inline ref
  // is re-invoked on every render (each timeupdate), which re-ran ensureMediaPlayback()
  // and fought the muted-autoplay fallback.
  const setMediaEl = useCallback(
    (el: HTMLVideoElement | null) => {
      detachSignalsRef.current?.();
      detachSignalsRef.current = null;
      localMediaRef.current = el;
      mediaRef.current = el;
      if (!el) return;
      detachSignalsRef.current = bindSignals(el);
      const cur = latestPlayback.current;
      if (cur.status === "PLAYING") {
        ensureMediaPlayback(el, {
          onUnrecoverable: cur.emitPlayFail,
          desiredMuted: cur.muted,
          desiredVolume: cur.volume,
        });
      } else if (cur.status === "PAUSED" || cur.status === "STOPPED") {
        // Mounted while the user already paused/stopped: never auto-start.
        el.autoplay = false;
        el.pause();
      }
    },
    [mediaRef, bindSignals],
  );

  // Native failure -> observable classification (no URLs / messages from the browser).
  const emitNativeError = useCallback(
    (el: HTMLMediaElement) => {
      const c = classifyMediaError({
        errorCode: el.error?.code ?? null,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
      });
      signals?.patch({ errorKind: c.kind });
      onMediaEvent({
        type: "MEDIA_ERROR",
        code: c.code,
        message: "Media unavailable",
        recoverable: true,
        generation,
      });
    },
    [signals, onMediaEvent, generation],
  );

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      if (!assetId) {
        const payloadUrl = item.payload?.url;
        setUrl(typeof payloadUrl === "string" ? payloadUrl : null);
        return;
      }

      // PLAYBACK-HISENSE-VIDEO-01: Smart TVs (Hisense Vidaa) fail to stream video via blob URL.
      // If we are online, bypass IndexedDB and force a direct HTTP byte-range request.
      if (item.type === "VIDEO" && navigator.onLine) {
        try {
          const config = await getConfig();
          if (config?.deviceToken) {
            const directPath = `/api/device/media/${encodeURIComponent(assetId)}?token=${config.deviceToken}`;
            if (!cancelled) setUrl(directPath);
            return;
          }
        } catch {
          /* fallback to normal logic */
        }
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
        let blob = await res.blob();
        if (cancelled) return;
        
        // Force image/gif MIME type to ensure Chromium/Opera animate the blob correctly
        if (assetUrl?.toLowerCase().endsWith(".gif") && blob.type !== "image/gif") {
          blob = new Blob([blob], { type: "image/gif" });
        }

        if (assetChecksum) {
          void putAssetBlob(assetId, blob, assetChecksum).catch(() => undefined);
        }
        const blobUrl = URL.createObjectURL(blob);
        if (process.env.NODE_ENV === "development" && item.type === "VIDEO") {
          console.log(`[VIDEO-DIAG] BLOB CREATED | blob.type=${blob.type} | blob.size=${blob.size} | objectURL=${blobUrl.substring(0, 40)}...`);
        }
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
      // READY is emitted from <img onLoad> so decode/network time does not eat the slide.
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
          onLoad={() => {
            const emitReady = () =>
              onMediaEvent({
                type: "MEDIA_READY",
                durationMs: item.durationMs > 0 ? item.durationMs : 8000,
                generation,
              });
            if (loadingSentRef.current) emitReady();
            else pendingReadyRef.current = emitReady;
          }}
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
          ref={setMediaEl}
          onLoadStart={() => logVideoDiag("loadstart")}
          onLoadedMetadata={(e) => {
            logVideoDiag("loadedmetadata");
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
            startIfWanted(el);
          }}
          onLoadedData={(e) => {
            logVideoDiag("loadeddata");
            startIfWanted(e.currentTarget);
          }}
          onCanPlay={(e) => {
            logVideoDiag("canplay");
            if (process.env.NODE_ENV === "development" && e.currentTarget instanceof HTMLVideoElement) {
              const canMp4 = e.currentTarget.canPlayType("video/mp4");
              logVideoDiag(`canPlayType("video/mp4") = "${canMp4}"`);
            }
            startIfWanted(e.currentTarget);
          }}
          onTimeUpdate={(e) => {
            // FIXED window: the timer owns the timeline (media loops inside the window).
            if (!nativeEnded) return;
            onMediaEvent({
              type: "MEDIA_TIME_UPDATE",
              positionMs: Math.round(e.currentTarget.currentTime * 1000),
              generation,
            });
          }}
          onCanPlayThrough={() => logVideoDiag("canplaythrough")}
          onPlay={() => logVideoDiag("play")}
          onPlaying={() => logVideoDiag("playing")}
          onPause={() => logVideoDiag("pause")}
          onWaiting={() => logVideoDiag("waiting")}
          onStalled={() => logVideoDiag("stalled")}
          onSuspend={() => logVideoDiag("suspend")}
          onEnded={() => {
            logVideoDiag("ended");
            if (nativeEnded) {
              onMediaEvent({ type: "MEDIA_ENDED", generation });
            }
          }}
          onError={(e) => {
            logVideoDiag("error");
            emitNativeError(e.currentTarget);
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
        {/* We use <video> instead of <audio> because modern browsers (Chromium, Safari) strictly block muted <audio> autoplay, which breaks the playlist loop. <video muted playsInline> is permitted to autoplay. */}
        <video
          key={url}
          src={url}
          autoPlay
          muted={muted}
          preload="auto"
          controls={false}
          playsInline
          loop={loop}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0.01, pointerEvents: "none" }}
          aria-hidden
          ref={setMediaEl}
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
            startIfWanted(el);
          }}
          onLoadedData={(e) =>
            startIfWanted(e.currentTarget)
          }
          onCanPlay={(e) =>
            startIfWanted(e.currentTarget)
          }
          onTimeUpdate={(e) => {
            // FIXED window: the timer owns the timeline (media loops inside the window).
            if (!nativeEnded) return;
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
          onError={(e) => {
            emitNativeError(e.currentTarget);
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
              fontSize: "clamp(24px, min(7vh, 8vw), 88px)",
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
            fontSize: "clamp(48px, min(32vh, 20vw), 320px)",
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
            fontSize: "clamp(24px, min(7vh, 8vw), 88px)",
          }}
        >
          {now.toLocaleDateString()}
        </p>
      ) : null}
    </div>
  );
}
