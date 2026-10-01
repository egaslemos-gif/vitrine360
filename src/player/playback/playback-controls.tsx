/**
 * RUNTIME-PLAYBACK-04 — PlaybackControls
 *
 * Emits PlaybackAction only. Never touches the media element or playlist index.
 */

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { PlaybackAction, PlaybackState } from "@/domain/playback-state";
import {
  nextRepeatMode,
  resolveControlAvailability,
  showPresentationProgress,
} from "@/player/playback/control-availability";
import { formatPlaybackTime } from "@/player/playback/format-time";
import { getFullscreenController } from "@/player/runtime/fullscreen";

const INK = "#2b2550";
const BRAND = "#7057dc";

const glass: CSSProperties = {
  background: "rgba(255, 255, 255, 0.86)",
  backdropFilter: "blur(22px) saturate(1.4)",
  WebkitBackdropFilter: "blur(22px) saturate(1.4)",
  border: "1px solid rgba(255, 255, 255, 0.9)",
  borderRadius: 28,
  boxShadow: "0 18px 48px rgba(60, 40, 140, 0.28)",
};

const btnBase: CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  borderRadius: 999,
  background: "transparent",
  color: INK,
  cursor: "pointer",
  padding: "0 10px",
  fontSize: 16,
  lineHeight: 1,
};

export type PlaybackControlsProps = {
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  itemCount?: number;
  itemTitle?: string | null;
  visible?: boolean;
  className?: string;
  /** Compact secondary row on narrow viewports. */
  compact?: boolean;
  /** When false, fullscreen control is disabled. Defaults true (caller verifies controller). */
  fullscreenAvailable?: boolean;
};

export function PlaybackControls({
  state,
  dispatch,
  itemCount = 1,
  itemTitle,
  visible = true,
  className,
  compact = false,
  fullscreenAvailable = true,
}: PlaybackControlsProps) {
  const avail = resolveControlAvailability(state, {
    itemCount,
    fullscreenAvailable,
  });
  const seekId = useId();
  const volId = useId();
  const [previewMs, setPreviewMs] = useState<number | null>(null);
  const draggingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const isPlaying = state.status === "PLAYING";
  const showPause = isPlaying;
  const positionLabel = formatPlaybackTime(
    previewMs != null ? previewMs : state.positionMs,
  );
  const durationLabel = formatPlaybackTime(state.durationMs);
  const duration = state.durationMs;
  const displayPos = previewMs != null ? previewMs : state.positionMs;
  const progress =
    duration != null && duration > 0
      ? Math.min(100, Math.max(0, (displayPos / duration) * 100))
      : 0;

  const volumePct = Math.round(state.volume * 100);

  const commitSeek = useCallback(
    (ms: number) => {
      if (duration == null || !(duration > 0)) return;
      if (!Number.isFinite(ms)) return;
      dispatch({ type: "SEEK", positionMs: ms });
    },
    [dispatch, duration],
  );

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || duration == null || !(duration > 0)) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  const onSeekPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!avail.SEEK.enabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    const ms = seekFromClientX(e.clientX);
    if (ms != null) setPreviewMs(ms);
  };

  const onSeekPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const ms = seekFromClientX(e.clientX);
    if (ms != null) setPreviewMs(ms);
  };

  const onSeekPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const ms = seekFromClientX(e.clientX);
    setPreviewMs(null);
    if (ms != null) commitSeek(ms);
  };

  useEffect(() => {
    if (!draggingRef.current) {
      const id = window.setTimeout(() => setPreviewMs(null), 0);
      return () => window.clearTimeout(id);
    }
  }, [state.positionMs]);

  const toggleFullscreen = () => {
    const fs = getFullscreenController();
    if (!fs) return;
    if (fs.snapshot().active) void fs.exit();
    else void fs.request({ userActivation: true, source: "user" });
  };

  const playPause = () => {
    if (showPause) dispatch({ type: "PAUSE" });
    else dispatch({ type: "PLAY" });
  };

  const volumeIcon = state.muted || state.volume === 0
    ? "🔇"
    : state.volume < 0.4
      ? "🔈"
      : state.volume < 0.75
        ? "🔉"
        : "🔊";

  if (!visible) {
    return (
      <div
        aria-hidden
        data-playback-controls="hidden"
        style={{ display: "none" }}
      />
    );
  }

  return (
    <div
      className={className}
      data-playback-controls="visible"
      data-playback-status={state.status}
      style={{
        ...glass,
        display: "flex",
        flexDirection: "column",
        gap: compact ? 8 : 10,
        padding: compact ? "10px 12px" : "12px 16px",
        width: "min(920px, calc(100% - 24px))",
        pointerEvents: "auto",
        color: INK,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {(itemTitle || state.currentContentType) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            fontSize: compact ? 11 : 12,
            opacity: 0.85,
            letterSpacing: "0.02em",
            minWidth: 0,
          }}
        >
          <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {itemTitle ?? "—"}
          </span>
          <span style={{ flexShrink: 0 }}>
            {state.currentContentType ?? "—"}
            {itemCount > 0
              ? ` · ${state.currentItemIndex + 1} of ${itemCount}`
              : ""}
            {state.status === "LOADING" ? " · LOADING" : ""}
            {state.status === "ERROR" ? " · ERROR" : ""}
          </span>
        </div>
      )}

      {avail.SEEK.visible ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, minWidth: 42 }}
            aria-hidden
          >
            {positionLabel}
          </span>
          <div
            ref={trackRef}
            id={seekId}
            role="slider"
            tabIndex={avail.SEEK.enabled ? 0 : -1}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration ?? 0}
            aria-valuenow={Math.round(displayPos)}
            aria-valuetext={`${positionLabel} of ${durationLabel}`}
            aria-disabled={!avail.SEEK.enabled}
            onPointerDown={onSeekPointerDown}
            onPointerMove={onSeekPointerMove}
            onPointerUp={onSeekPointerUp}
            onPointerCancel={onSeekPointerUp}
            onKeyDown={(e) => {
              if (!avail.SEEK.enabled || duration == null) return;
              const step = Math.max(1000, duration * 0.05);
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                commitSeek(Math.max(0, state.positionMs - step));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                commitSeek(Math.min(duration, state.positionMs + step));
              } else if (e.key === "Home") {
                e.preventDefault();
                commitSeek(0);
              } else if (e.key === "End") {
                e.preventDefault();
                commitSeek(duration);
              }
            }}
            style={{
              position: "relative",
              flex: 1,
              height: 44,
              display: "flex",
              alignItems: "center",
              cursor: avail.SEEK.enabled ? "pointer" : "not-allowed",
              opacity: avail.SEEK.enabled ? 1 : 0.4,
              outline: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 6,
                borderRadius: 999,
                background: "rgba(112, 87, 220, 0.16)",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                width: `${progress}%`,
                height: 6,
                borderRadius: 999,
                background: BRAND,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `calc(${progress}% - 8px)`,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 2px 8px rgba(60, 40, 140, 0.35), 0 0 0 3px rgba(112, 87, 220, 0.3)",
              }}
            />
          </div>
          <span
            style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, minWidth: 42, textAlign: "right" }}
            aria-hidden
          >
            {durationLabel}
          </span>
        </div>
      ) : null}

      {!avail.SEEK.visible && showPresentationProgress(state) ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 10 }}
          data-presentation-progress
          aria-label="Presentation progress"
        >
          <span
            style={{ fontVariantNumeric: "tabular-nums", fontSize: 12, minWidth: 42 }}
            aria-hidden
          >
            {positionLabel}
          </span>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={duration ?? 0}
            aria-valuenow={Math.round(state.positionMs)}
            style={{
              position: "relative",
              flex: 1,
              height: 6,
              borderRadius: 999,
              background: "rgba(112, 87, 220, 0.16)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "rgba(112, 87, 220, 0.7)",
              }}
            />
          </div>
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              fontSize: 12,
              minWidth: 42,
              textAlign: "right",
            }}
            aria-hidden
          >
            {durationLabel}
          </span>
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <ControlButton
            label="Previous"
            disabled={!avail.PREVIOUS.enabled}
            compact={compact}
            onClick={() => dispatch({ type: "PREVIOUS" })}
          >
            ⏮
          </ControlButton>
          <ControlButton
            label={showPause ? "Pause" : "Play"}
            primary
            disabled={!avail.PLAY_PAUSE.enabled}
            compact={compact}
            onClick={playPause}
            pressed={showPause}
          >
            {showPause ? "⏸" : "▶"}
          </ControlButton>
          <ControlButton
            label="Next"
            disabled={!avail.NEXT.enabled}
            compact={compact}
            onClick={() => dispatch({ type: "NEXT" })}
          >
            ⏭
          </ControlButton>
          {!compact ? (
            <>
              <ControlButton
                label="Stop"
                disabled={!avail.STOP.enabled}
                onClick={() => dispatch({ type: "STOP" })}
                compact={compact}
              >
                ⏹
              </ControlButton>
              <ControlButton
                label="Restart"
                disabled={!avail.RESTART.enabled}
                onClick={() => dispatch({ type: "RESTART" })}
                compact={compact}
              >
                ↺
              </ControlButton>
            </>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {avail.MUTE.visible ? (
            <ControlButton
              label={state.muted ? "Unmute" : "Mute"}
              disabled={!avail.MUTE.enabled}
              pressed={state.muted}
              compact={compact}
              onClick={() =>
                dispatch({ type: "SET_MUTED", muted: !state.muted })
              }
            >
              {volumeIcon}
            </ControlButton>
          ) : null}
          {avail.VOLUME.visible && !compact ? (
            <label
              htmlFor={volId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minHeight: 44,
                padding: "0 6px",
                opacity: avail.VOLUME.enabled ? 1 : 0.4,
              }}
            >
              <span className="sr-only">Volume</span>
              <input
                id={volId}
                type="range"
                min={0}
                max={100}
                step={1}
                value={state.muted ? 0 : volumePct}
                disabled={!avail.VOLUME.enabled}
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={state.muted ? 0 : volumePct}
                aria-valuetext={`${state.muted ? 0 : volumePct} percent`}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100;
                  dispatch({ type: "SET_VOLUME", volume: v });
                  if (state.muted && v > 0) {
                    dispatch({ type: "SET_MUTED", muted: false });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Home") {
                    e.preventDefault();
                    dispatch({ type: "SET_VOLUME", volume: 0 });
                  } else if (e.key === "End") {
                    e.preventDefault();
                    dispatch({ type: "SET_VOLUME", volume: 1 });
                  }
                }}
                style={{ width: 110, accentColor: BRAND }}
              />
            </label>
          ) : null}
          {avail.REPEAT.visible && !compact ? (
            <ControlButton
              label={`Repeat ${state.repeatMode}`}
              disabled={!avail.REPEAT.enabled}
              compact={compact}
              onClick={() =>
                dispatch({
                  type: "SET_REPEAT_MODE",
                  mode: nextRepeatMode(state.repeatMode),
                })
              }
            >
              {state.repeatMode === "NONE"
                ? "↷"
                : state.repeatMode === "ITEM"
                  ? "¹"
                  : "↻"}
            </ControlButton>
          ) : null}
          {avail.FULLSCREEN.visible ? (
            <ControlButton
              label="Fullscreen"
              disabled={!avail.FULLSCREEN.enabled}
              compact={compact}
              onClick={toggleFullscreen}
            >
              ⛶
            </ControlButton>
          ) : null}
        </div>
      </div>

      {state.status === "ERROR" && state.error ? (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "#c92a4a",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <span>{state.error.message || "Playback error"}</span>
          {state.error.recoverable ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "PLAY" })}
              style={{
                ...btnBase,
                minHeight: 36,
                background: "rgba(112, 87, 220, 0.12)",
                fontSize: 12,
              }}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <style>{`
        [data-playback-controls] button:focus-visible,
        [data-playback-controls] [role=slider]:focus-visible,
        [data-playback-controls] input:focus-visible {
          outline: 2px solid #7057dc;
          outline-offset: 2px;
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          border: 0;
        }
      `}</style>
    </div>
  );
}

function ControlButton({
  label,
  children,
  onClick,
  disabled,
  primary,
  pressed,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  pressed?: boolean;
  compact?: boolean;
}) {
  const size = compact ? (primary ? 44 : 36) : (primary ? 52 : 44);
  const fontSize = compact ? (primary ? 16 : 14) : (primary ? 18 : 16);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      {...(typeof pressed === "boolean" ? { "aria-pressed": pressed } : {})}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...btnBase,
        background: primary ? BRAND : "rgba(112, 87, 220, 0.09)",
        boxShadow: primary ? "0 8px 18px rgba(112, 87, 220, 0.38)" : "none",
        color: primary ? "#fff" : btnBase.color,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: size,
        minHeight: size,
        borderRadius: 999,
        fontSize,
        padding: compact ? "0 6px" : "0 10px",
      }}
    >
      {children}
    </button>
  );
}
