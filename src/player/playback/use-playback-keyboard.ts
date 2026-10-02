/**
 * RUNTIME-PLAYBACK-04 — Keyboard shortcuts → PlaybackAction.
 * Scope: only when player root is focused / contains focus.
 * Skips input/textarea/select/contenteditable.
 *
 * Shortcuts follow desktop media players (VLC / Windows Media Player):
 *   Space ............ play / pause
 *   ← / → ............ seek −5 s / +5 s (media with a known duration), else previous / next item
 *   Shift+← / Shift+→  previous / next item (also PageUp / PageDown, P / N)
 *   ↑ / ↓ ............ volume ±5 % (↑ also unmutes)
 *   Home / End ....... start / end
 *   M ................ mute      F ... fullscreen      R ... restart item
 *   Media keys / TV remote (MediaPlayPause, MediaTrackNext, keyCodes 415/19/413/417/412)
 */

"use client";

import { useEffect, useRef } from "react";
import type { PlaybackAction, PlaybackState } from "@/domain/playback-state";
import { isEditableTarget } from "@/player/playback/control-availability";
import { getFullscreenController } from "@/player/runtime/fullscreen";

export type PlaybackKeyboardOptions = {
  enabled?: boolean;
  /** Root element that must contain focus (or be fullscreen). */
  getRoot: () => HTMLElement | null;
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  onShowControls?: () => void;
};

const SEEK_STEP_MS = 5000;

/** Smart TV remote keyCodes (Tizen / webOS / VIDAA / HbbTV). */
const TV_KEY = { PLAY: 415, PAUSE: 19, STOP: 413, FAST_FORWARD: 417, REWIND: 412 } as const;

export function usePlaybackKeyboard(opts: PlaybackKeyboardOptions): void {
  const { enabled = true, getRoot, state, dispatch, onShowControls } = opts;

  // Latest values without re-binding the window listener on every tick.
  const latest = useRef({ state, dispatch, onShowControls, getRoot });
  useEffect(() => {
    latest.current = { state, dispatch, onShowControls, getRoot };
  });

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (ev: KeyboardEvent) => {
      if (isEditableTarget(ev.target)) return;
      const { state: st, dispatch: send, onShowControls: showControls, getRoot: root } =
        latest.current;

      const rootEl = root();
      if (!rootEl) return;
      const active = document.activeElement;
      const inScope =
        rootEl === active ||
        (active != null && rootEl.contains(active)) ||
        document.fullscreenElement === rootEl ||
        (document.fullscreenElement != null &&
          rootEl.contains(document.fullscreenElement));
      if (!inScope) return;

      const key = ev.key;
      const show = () => showControls?.();

      // A focused control (button / slider) already handles Space/Enter and the arrow keys
      // itself — do not run the global shortcut as well (it would act twice).
      const target = ev.target instanceof HTMLElement ? ev.target : null;
      const onControl = target?.closest("button, [role=slider], input") != null;
      if (onControl && (key === " " || key === "Spacebar" || key === "Enter")) return;
      if (onControl && target?.closest("[role=slider], input") != null && key.startsWith("Arrow")) return;

      const hasKnownDuration = st.durationMs != null && st.durationMs > 0;
      const canSeek =
        hasKnownDuration &&
        (st.currentContentType === "VIDEO" || st.currentContentType === "AUDIO");

      const isExperience = st.currentContentType === "EXPERIENCE";
      if (
        isExperience &&
        (key === " " || key === "Spacebar" || key === "MediaPlayPause" || key === "MediaStop" ||
          ev.keyCode === TV_KEY.PLAY || ev.keyCode === TV_KEY.PAUSE || ev.keyCode === TV_KEY.STOP)
      ) {
        // EXPERIENCE cannot be suspended (sandbox): no fake pause.
        ev.preventDefault();
        show();
        return;
      }

      if (key === " " || key === "Spacebar" || key === "MediaPlayPause") {
        ev.preventDefault();
        show();
        if (st.status === "PLAYING") send({ type: "PAUSE" });
        else send({ type: "PLAY" });
        return;
      }
      if (ev.keyCode === TV_KEY.PLAY) {
        ev.preventDefault();
        show();
        send({ type: "PLAY" });
        return;
      }
      if (ev.keyCode === TV_KEY.PAUSE) {
        ev.preventDefault();
        show();
        send({ type: "PAUSE" });
        return;
      }
      if (key === "MediaStop" || ev.keyCode === TV_KEY.STOP) {
        ev.preventDefault();
        show();
        send({ type: "STOP" });
        return;
      }
      if (key === "MediaTrackNext" || ev.keyCode === TV_KEY.FAST_FORWARD || key === "PageDown" || key === "n" || key === "N") {
        ev.preventDefault();
        show();
        send({ type: "NEXT" });
        return;
      }
      if (key === "MediaTrackPrevious" || ev.keyCode === TV_KEY.REWIND || key === "PageUp" || key === "p" || key === "P") {
        ev.preventDefault();
        show();
        send({ type: "PREVIOUS" });
        return;
      }
      if (key === "ArrowLeft") {
        ev.preventDefault();
        show();
        if (canSeek && !ev.shiftKey) {
          send({ type: "SEEK", positionMs: Math.max(0, st.positionMs - SEEK_STEP_MS) });
        } else {
          send({ type: "PREVIOUS" });
        }
        return;
      }
      if (key === "ArrowRight") {
        ev.preventDefault();
        show();
        if (canSeek && !ev.shiftKey) {
          send({
            type: "SEEK",
            positionMs: Math.min(st.durationMs ?? 0, st.positionMs + SEEK_STEP_MS),
          });
        } else {
          send({ type: "NEXT" });
        }
        return;
      }
      if (key === "ArrowUp") {
        ev.preventDefault();
        show();
        if (st.muted) send({ type: "SET_MUTED", muted: false });
        send({ type: "SET_VOLUME", volume: Math.min(1, st.volume + 0.05) });
        return;
      }
      if (key === "ArrowDown") {
        ev.preventDefault();
        show();
        send({ type: "SET_VOLUME", volume: Math.max(0, st.volume - 0.05) });
        return;
      }
      if (key === "Home") {
        ev.preventDefault();
        show();
        send({ type: "SEEK", positionMs: 0 });
        return;
      }
      if (key === "End" && st.durationMs != null) {
        ev.preventDefault();
        show();
        send({ type: "SEEK", positionMs: st.durationMs });
        return;
      }
      if (key === "m" || key === "M") {
        ev.preventDefault();
        show();
        send({ type: "SET_MUTED", muted: !st.muted });
        return;
      }
      if (key === "f" || key === "F") {
        ev.preventDefault();
        show();
        const fs = getFullscreenController();
        if (!fs) return;
        if (fs.snapshot().active) void fs.exit();
        else void fs.request({ userActivation: true, source: "user" });
        return;
      }
      if (key === "r" || key === "R") {
        ev.preventDefault();
        show();
        send({ type: "RESTART" });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
