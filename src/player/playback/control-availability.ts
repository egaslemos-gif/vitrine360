/**
 * RUNTIME-PLAYBACK-04/05 — Which controls are available for media + status.
 * Pure; no DOM. Controller remains defensive regardless.
 */

import type { PlaybackState, RepeatMode } from "@/domain/playback-state";

export type ControlKind =
  | "PLAY_PAUSE"
  | "STOP"
  | "NEXT"
  | "PREVIOUS"
  | "RESTART"
  | "SEEK"
  | "VOLUME"
  | "MUTE"
  | "REPEAT"
  | "FULLSCREEN";

export type ControlAvailability = Record<
  ControlKind,
  { enabled: boolean; visible: boolean }
>;

function isAvType(type: string | null | undefined): boolean {
  const t = (type ?? "").toUpperCase();
  return t === "VIDEO" || t === "AUDIO";
}

function isStillType(type: string | null | undefined): boolean {
  const t = (type ?? "").toUpperCase();
  return t === "IMAGE" || t === "GIF";
}

export function resolveControlAvailability(
  state: PlaybackState,
  opts?: { itemCount?: number; fullscreenAvailable?: boolean },
): ControlAvailability {
  const count = opts?.itemCount ?? 1;
  const hasItem = Boolean(state.currentContentId) && state.status !== "IDLE";
  const type = state.currentContentType;
  const loading = state.status === "LOADING";
  const error = state.status === "ERROR";
  const ended = state.status === "ENDED";
  const av = isAvType(type);
  const experience = (type ?? "").toUpperCase() === "EXPERIENCE";

  // Seek only for native AV with known duration — not IMAGE/GIF/EXPERIENCE.
  const seekable =
    hasItem &&
    av &&
    state.durationMs != null &&
    state.durationMs > 0;

  const navOk = hasItem && count > 0 && !loading;

  return {
    PLAY_PAUSE: {
      visible: true,
      enabled:
        hasItem &&
        !ended &&
        (error ? Boolean(state.error?.recoverable) : true),
    },
    STOP: {
      visible: true,
      enabled:
        hasItem && state.status !== "STOPPED" && state.status !== "IDLE",
    },
    NEXT: { visible: true, enabled: navOk && count > 0 },
    PREVIOUS: { visible: true, enabled: navOk },
    RESTART: { visible: true, enabled: hasItem && !loading },
    SEEK: {
      visible: av,
      enabled:
        seekable &&
        (state.status === "PLAYING" || state.status === "PAUSED"),
    },
    VOLUME: {
      visible: av && !experience,
      enabled: hasItem && av,
    },
    MUTE: {
      visible: av && !experience,
      enabled: hasItem && av,
    },
    REPEAT: { visible: true, enabled: hasItem },
    FULLSCREEN: {
      visible: true,
      enabled: opts?.fullscreenAvailable !== false,
    },
  };
}

/** Presentation progress bar (read-only) for still media — not seek. */
export function showPresentationProgress(state: PlaybackState): boolean {
  return (
    isStillType(state.currentContentType) &&
    state.durationMs != null &&
    state.durationMs > 0 &&
    (state.status === "PLAYING" ||
      state.status === "PAUSED" ||
      state.status === "LOADING")
  );
}

export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === "NONE") return "PLAYLIST";
  if (mode === "PLAYLIST") return "ITEM";
  return "NONE";
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (target == null || typeof target !== "object") return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    closest?: (selector: string) => unknown;
  };
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (typeof el.closest === "function") {
    return Boolean(
      el.closest("input, textarea, select, [contenteditable=true]"),
    );
  }
  return false;
}
